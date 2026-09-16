import { randomUUID } from 'node:crypto';
import { getDb } from '../db';
import { settle } from './repository';
import { readMedia, deleteMedia } from './storage';
import { inspectMedia, InvalidMedia } from './inspect';
import { sweepUnusedLogos } from './cleanup';
type JobRow = { id: string; shop_id: string; asset_id: string; kind: 'verify'|'delete'; pathname: string; media_kind: string; size_bytes: string; attempts: number; upload_deadline: Date; token_issued: boolean };

export async function claimJob() {
  const db = getDb();
  return db.begin(async tx => {
    const [job] = await tx<JobRow[]>`select j.*,a.pathname,a.kind as media_kind,a.size_bytes,a.upload_deadline,a.token_issued from media_jobs j join media_assets a on a.id=j.asset_id where (j.state in ('queued','retry') and j.available_at<=now()) or (j.state='running' and j.lease_until<now()) order by j.available_at,j.created_at for update of j skip locked limit 1`;
    if (!job) return null;
    const lease = randomUUID();
    await tx`update media_job_attempts set finished_at=now(),outcome='lease_expired' where job_id=${job.id} and finished_at is null`;
    await tx`update media_jobs set state='running',attempts=attempts+1,lease_token=${lease},lease_until=now()+interval '2 minutes',updated_at=now() where id=${job.id}`;
    await tx`insert into media_job_attempts (job_id,lease_token) values (${job.id},${lease})`;
    return { ...job, lease, attempts: Number(job.attempts) + 1 };
  });
}
export async function runOne() {
  const job = await claimJob(); if (!job) return false;
  const db = getDb();
  const heartbeat = setInterval(() => { void db`update media_jobs set lease_until=now()+interval '2 minutes' where id=${job.id} and lease_token=${job.lease} and state='running' and lease_until>now()`.catch(() => {}); }, 30_000);
  try {
    let metadata: Awaited<ReturnType<typeof inspectMedia>> | null = null;
    if (job.kind === 'delete') await deleteMedia(job.pathname);
    else {
      const file = await readMedia(job.pathname); if (!file) throw new Error('storage_pending');
      if (file.size !== Number(job.size_bytes)) { await file.stream.cancel(); throw new InvalidMedia('size_mismatch'); }
      const reader = file.stream.getReader(); const parts: Uint8Array[] = []; let size = 0;
      const timer = setTimeout(() => { void reader.cancel(); }, 60_000);
      try { while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.length; if (size > Number(job.size_bytes)) { await reader.cancel(); throw new InvalidMedia('size_mismatch'); } parts.push(chunk.value); } }
      finally { clearTimeout(timer); }
      if (size !== Number(job.size_bytes)) throw new InvalidMedia('size_mismatch');
      metadata = await inspectMedia(Buffer.concat(parts), job.media_kind);
    }
    await db.begin(async tx => {
      await tx`select id from shops where id=${job.shop_id} for update`;
      const [current] = await tx`select * from media_jobs where id=${job.id} and lease_token=${job.lease} and state='running' and lease_until>now() for update`;
      if (!current) return; // Late worker results cannot charge quota or resurrect deleted files.
      if (job.kind === 'delete') {
        await tx`update media_assets set state=${current.terminal_status === 'failed' ? 'rejected' : 'deleted'} where id=${job.asset_id}`;
        await settle(tx, job.asset_id, false);
      } else {
        await tx`update media_assets set state='ready',metadata=${tx.json(metadata!)} where id=${job.asset_id}`;
        await settle(tx, job.asset_id, true);
      }
      await tx`update media_jobs set state=${job.kind === 'delete' ? current.terminal_status : 'succeeded'},lease_token=null,lease_until=null,updated_at=now() where id=${job.id}`;
      await tx`update media_job_attempts set finished_at=now(),outcome='completed' where lease_token=${job.lease}`;
    });
  } catch (error) {
    const permanent = error instanceof InvalidMedia;
    await db.begin(async tx => {
      await tx`select id from shops where id=${job.shop_id} for update`;
      const [current] = await tx`select * from media_jobs where id=${job.id} and lease_token=${job.lease} and state='running' and lease_until>now() for update`;
      if (!current) return;
      const cleanup = job.kind === 'verify' && (permanent || job.attempts >= 3);
      const code = permanent ? 'invalid_file' : 'service_unavailable';
      const safeAfter = cleanup && job.token_issued ? new Date(new Date(job.upload_deadline).getTime() + 86400000) : new Date();
      await tx`update media_jobs set kind=${cleanup ? 'delete' : job.kind},state='retry',terminal_status=${cleanup ? 'failed' : current.terminal_status},error_code=${code},available_at=greatest(${safeAfter},now()+${cleanup ? 0 : Math.min(3600, 5 * 2 ** Math.min(job.attempts, 10))}*interval '1 second'),lease_token=null,lease_until=null,updated_at=now() where id=${job.id}`;
      if (cleanup) await tx`update media_assets set state='deleting' where id=${job.asset_id}`;
      await tx`update media_job_attempts set finished_at=now(),outcome=${code} where lease_token=${job.lease}`;
    });
  } finally { clearInterval(heartbeat); }
  return true;
}

export async function sweepExpired() {
  const db = getDb();
  // Per-shop locking uses the same order as API writes.
  const candidates = await db`select distinct shop_id from media_assets where (state='uploading' and upload_deadline<now()-interval '24 hours') or (expires_at<now() and state='ready') limit 50`;
  for (const row of candidates) await db.begin(async tx => {
    await tx`select id from shops where id=${row.shop_id} for update`;
    await tx`delete from media_projects where shop_id=${row.shop_id} and expires_at<now()`;
    const assets = await tx`select * from media_assets a where shop_id=${row.shop_id} and ((state='uploading' and upload_deadline<now()-interval '24 hours') or (expires_at<now() and state='ready')) and not exists (select 1 from media_project_assets p where p.asset_id=a.id) and not exists (select 1 from motion_jobs m where (m.source_asset_id=a.id or m.clip_asset_id=a.id or m.output_asset_id=a.id) and m.state in ('analyzing','review','queued','running','retry')) for update`;
    for (const asset of assets) {
      await tx`update media_assets set state='deleting' where id=${asset.id}`;
      await tx`insert into media_jobs(shop_id,asset_id,kind) values (${row.shop_id},${asset.id},'delete') on conflict (asset_id) do update set kind='delete',state='queued',terminal_status='cancelled',available_at=now(),lease_token=null,lease_until=null,updated_at=now()`;
    }
  });
  await sweepUnusedLogos();
}
