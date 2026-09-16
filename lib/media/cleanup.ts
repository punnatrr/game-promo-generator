import { del } from '@vercel/blob';
import { getDb } from '../db';
import { localMedia } from './storage';

// Only never-referenced logos are eligible. Every historical brand revision counts.
export async function sweepUnusedLogos() {
  if (localMedia() || !process.env.BLOB_READ_WRITE_TOKEN) return;
  const db = getDb();
  const candidates = await db`select l.id,l.owner_user_id,l.blob_pathname from brand_logos l where l.created_at<now()-interval '2 days' and not exists (select 1 from brand_profiles p where p.profile->>'logoId'=l.id::text) limit 20`;
  for (const logo of candidates) {
    const eligible = await db.begin(async tx => {
      // M1 attachment takes FOR SHARE on this logo, so a concurrent save must
      // finish before this reference check, or see ready=false afterwards.
      const [exists] = await tx`select id from brand_logos where id=${logo.id} for update`;
      if (!exists) return false;
      const [ref] = await tx`select 1 from brand_profiles where profile->>'logoId'=${logo.id}::text limit 1`;
      if (ref) return false;
      await tx`update brand_logos set ready=false where id=${logo.id}`;
      return true;
    });
    if (!eligible) continue;
    try {
      await del(logo.blob_pathname);
      await db`delete from brand_logos where id=${logo.id} and not ready and not exists (select 1 from brand_profiles p where p.profile->>'logoId'=${logo.id}::text)`;
    } catch { /* Keep the registered path for a later cleanup attempt. */ }
  }
}
