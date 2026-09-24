"use client";
import Link from 'next/link';
import { PageHeader, EmptyState } from "@/app/components/ui/workspace";
import { useCallback, useEffect, useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';
import { Button } from '@/app/components/ui/button';
import { TextField } from '@/app/components/ui/text-field';
import { StatusMessage } from '@/app/components/ui/status-message';
import { bytesLabel, FILE_TYPES, STATE_LABELS, type Library, type MediaProject } from '@/lib/media/model';

async function responseData(res: Response) {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'ดำเนินการไม่สำเร็จ กรุณาลองใหม่');
  return data;
}
export default function LibraryPage() {
  const [data, setData] = useState<Library | null>(null);
  const [tab, setTab] = useState<'assets'|'projects'|'jobs'>('assets');
  const [feedback, setFeedback] = useState<{ tone: 'success'|'error'; message: string } | null>(null);
  const [auth, setAuth] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const authRef = useRef(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [editing, setEditing] = useState<MediaProject | null>(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [asOf, setAsOf] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const res = await fetch('/api/assets', { cache: 'no-store', signal });
    if (res.status === 401) { setAuth(true); authRef.current = true; }
    const next = await responseData(res) as Library; setData(next); setAsOf(Date.now()); return next;
  }, []);
  useEffect(() => {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      let delay = 30_000;
      try { if (!document.hidden) { const next = await refresh(controller.signal); if (next.jobs.some(j => ['queued','running','retry'].includes(j.state))) delay = 5000; } }
      catch (error) { if (!controller.signal.aborted) setFeedback({ tone: 'error', message: error instanceof Error ? error.message : 'โหลดคลังไม่สำเร็จ' }); }
      finally { if (!controller.signal.aborted && !authRef.current) timer = setTimeout(load, delay); }
    };
    void load(); return () => { controller.abort(); clearTimeout(timer); };
  }, [refresh]);
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);
  async function act(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setFeedback(null);
    try { await action(); await refresh(); }
    catch (error) { setFeedback({ tone: 'error', message: error instanceof Error ? error.message : 'ดำเนินการไม่สำเร็จ' }); }
    finally { busyRef.current = false; setBusy(false); setProgress(null); }
  }
  async function uploadFile(file?: File) {
    if (!file || !data) return;
    await act(async () => {
      if (!Object.hasOwn(FILE_TYPES, file.type)) throw new Error('รองรับ PNG, JPG, WebP, MP4, MOV และ WebM');
      const max = file.type.startsWith('image/') ? data.limits.image : data.limits.video;
      if (file.size > max) throw new Error(`ไฟล์นี้ต้องไม่เกิน ${bytesLabel(max)}`);
      const ticket = await responseData(await fetch('/api/assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: file.name, contentType: file.type, size: file.size, requestKey: crypto.randomUUID() }) }));
      if (ticket.local) await responseData(await fetch(`/api/assets/${ticket.id}/local-upload`, { method: 'PUT', body: file }));
      else {
        await upload(ticket.pathname, file, { access: 'private', handleUploadUrl: '/api/assets/upload', multipart: file.size > 5 * 1024 * 1024, onUploadProgress: event => setProgress(Math.round(event.percentage)) });
        await responseData(await fetch(`/api/assets/${ticket.id}/complete`, { method: 'POST' }));
      }
      setFeedback({ tone: 'success', message: 'รับไฟล์แล้ว กำลังรอตรวจสอบ คุณกลับมาดูผลภายหลังได้' });
    });
    if (fileInput.current) fileInput.current.value = '';
  }
  function editProject(project: MediaProject) { setEditing(project); setTitle(project.title); setSelected(project.asset_ids); setTab('assets'); }
  const ready = data?.assets.filter(a => a.state === 'ready' && new Date(a.expires_at).getTime() > asOf) || [];
  const pending = data?.jobs.filter(j => ['queued','running','retry'].includes(j.state)) || [];
  const visibleAssets = data?.assets.filter(a => (filter === 'all' || a.kind === filter) && a.name.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim())) || [];
  return <main className="min-h-screen bg-background px-5 py-9 text-white sm:px-8">
    <div className="mx-auto max-w-6xl">

      <PageHeader title="คลังไฟล์และชุดงาน" description="อัปโหลดภาพและคลิป เลือกไฟล์เพื่อจัดชุดงาน แล้วนำไปสร้างวิดีโอ" />
      {auth ? <section className="rounded-3xl border border-white/10 p-8"><h2 className="text-xl font-bold">เข้าสู่ระบบเพื่อเปิดคลังของคุณ</h2><Link href="/sign-in" className="mt-4 inline-block text-purple-200 underline">เข้าสู่ระบบ</Link></section> : <>
        {feedback && <StatusMessage tone={feedback.tone} className="mb-5">{feedback.message}</StatusMessage>}
        {!data ? <div className="rounded-3xl border border-white/10 p-8"><p role="status" className="text-white/60">{feedback ? 'ยังเปิดคลังงานไม่ได้' : 'กำลังโหลดคลังงาน...'}</p>{feedback && <Button variant="secondary" onClick={() => void act(async () => { await refresh(); })}>ลองอีกครั้ง</Button>}</div> : <>
          <section aria-label="ภาพรวมคลัง" className="mb-7 grid gap-3 sm:grid-cols-3">
            <Metric label="ไฟล์พร้อมใช้" value={`${ready.length} ไฟล์`} hint="ภาพและคลิปที่ตรวจสอบแล้ว" />
            <Metric label="งานที่กำลังดำเนินการ" value={`${pending.length} งาน`} hint="ปิดหน้าเว็บแล้วกลับมาดูได้" />
            <Metric label="พื้นที่ใช้แล้ว" value={bytesLabel(data.usage.used)} hint={`จาก ${bytesLabel(data.usage.limit)} · จองไว้ ${bytesLabel(data.usage.reserved)}`} />
          </section>
          <div className="mb-6 flex gap-2 border-b border-white/10 pb-3" role="group" aria-label="หมวดคลัง">{([['assets','ไฟล์ของฉัน'],['projects','ชุดงาน'],['jobs','สถานะงาน']] as const).map(([key,label]) => <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)} className={`rounded-xl px-4 py-2.5 text-sm font-bold ${tab === key ? 'bg-purple-300 text-black' : 'text-muted hover:bg-white/5'}`}>{label}</button>)}</div>
          {tab === 'assets' && <>
            <section className="mb-6 flex flex-wrap items-center justify-between gap-5 rounded-3xl border border-dashed border-purple-300/30 bg-purple-300/[0.035] p-6"><div><h2 className="font-bold">เพิ่มภาพหรือคลิปของร้าน</h2><p className="mt-2 text-xs leading-6 text-muted">ภาพไม่เกิน {bytesLabel(data.limits.image)} · คลิปไม่เกิน {bytesLabel(data.limits.video)} และ 2 นาที<br />เก็บ {data.limits.retentionDays} วัน การอัปโหลดไม่ใช้โควตาภาพเดิม</p></div><div><input ref={fileInput} id="library-file" aria-label="เลือกภาพหรือคลิปเพื่ออัปโหลด" type="file" accept={Object.keys(FILE_TYPES).join(',')} disabled={busy || !data.storageAvailable} onChange={e => void uploadFile(e.target.files?.[0])} className="sr-only" /><Button disabled={busy || !data.storageAvailable} onClick={() => fileInput.current?.click()}>{busy && progress !== null ? `อัปโหลด ${progress}%` : busy ? 'กำลังดำเนินการ...' : '＋ เพิ่มไฟล์'}</Button>{!data.storageAvailable && <p className="mt-2 max-w-60 text-xs text-amber-200">พื้นที่เก็บไฟล์ยังไม่พร้อมใช้งาน</p>}</div></section>
            <div className="filter-toolbar"><h2 className="text-lg font-bold">ไฟล์ของฉัน</h2><TextField label="ค้นหาชื่อไฟล์" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="ค้นหาภาพหรือคลิป" /><label className="text-sm text-white/60">แสดง <select value={filter} onChange={e => setFilter(e.target.value)} className="ml-2 rounded-lg border border-white/10 bg-[#15151d] p-2"><option value="all">ทั้งหมด</option><option value="image">ภาพ</option><option value="video">คลิป</option></select></label></div>
            {visibleAssets.length === 0 ? <EmptyState title={data.assets.length ? "ไม่พบไฟล์ที่ตรงกัน" : "เริ่มคลังงานด้วยไฟล์แรก"} description={data.assets.length ? "ลองเปลี่ยนคำค้นหรือแสดงไฟล์ทั้งหมด" : "อัปโหลดภาพหรือคลิปที่ต้องการเก็บไว้ใช้ต่อ"} action={data.assets.length ? "ล้างตัวกรอง" : "เพิ่มไฟล์"} onAction={() => { if (data.assets.length) { setQuery(''); setFilter('all'); } else if (!busy && data.storageAvailable) fileInput.current?.click(); }} /> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visibleAssets.map(asset => {
              const expired = new Date(asset.expires_at).getTime() <= asOf; const usable = asset.state === 'ready' && !expired;
              return <article key={asset.id} className={`min-w-0 rounded-2xl border p-5 ${selected.includes(asset.id) ? 'border-purple-300/70 bg-purple-300/5' : 'border-white/10 bg-white/[0.025]'}`}><div className="mb-4 flex items-center justify-between"><span className="rounded-xl bg-white/5 px-3 py-2 text-xs font-bold text-purple-200">{asset.kind === 'image' ? 'ภาพ' : 'คลิป'}</span><label className="text-xs text-white/60"><input type="checkbox" disabled={!usable || busy} checked={selected.includes(asset.id)} onChange={e => setSelected(current => e.target.checked ? [...current, asset.id] : current.filter(v => v !== asset.id))} className="mr-2 accent-purple-400" />เลือกเข้าชุดงาน</label></div><h3 className="break-words font-bold">{asset.name}</h3><p className="mt-2 text-xs text-muted">{bytesLabel(asset.size_bytes)}{asset.metadata ? ` · ${asset.metadata.width} × ${asset.metadata.height}${asset.metadata.duration ? ` · ${asset.metadata.duration.toFixed(1)} วินาที` : ''}` : ''}</p><p className={`mt-4 text-sm ${usable ? 'text-emerald-300' : 'text-amber-200'}`}>{expired ? 'หมดอายุแล้ว' : STATE_LABELS[asset.state]}</p><p className="mt-1 text-xs text-muted">เก็บถึง {new Date(asset.expires_at).toLocaleDateString('th-TH')}</p><div className="mt-5 flex flex-wrap gap-4 text-xs">{usable && asset.kind === "image" && <Link href={`/dashboard/motion?asset=${asset.id}`} className="text-purple-200 underline">ใช้สร้างวิดีโอ</Link>}{usable && <a href={`/api/assets/${asset.id}`} className="text-purple-200 underline">ดาวน์โหลด</a>}<button disabled={busy || asset.state === 'deleting'} onClick={() => { if (window.confirm('ลบไฟล์นี้ออกจากคลัง? ไฟล์ที่อยู่ในชุดงานต้องลบชุดงานก่อน')) void act(async () => { await responseData(await fetch(`/api/assets/${asset.id}`, { method: 'DELETE' })); setSelected(v => v.filter(i => i !== asset.id)); setFeedback({ tone: 'success', message: 'รับคำขอลบแล้ว ระบบจะคืนพื้นที่หลังลบสำเร็จ โดยอาจรอสิทธิ์อัปโหลดหมดอายุก่อน' }); }); }} className="text-muted underline disabled:opacity-40">{asset.state === 'uploading' ? 'ยกเลิกอัปโหลด' : 'ลบไฟล์'}</button></div></article>;
            })}</div>}
            {(selected.length > 0 || editing) && <form onSubmit={event => { event.preventDefault(); void act(async () => { await responseData(await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editing?.id || crypto.randomUUID(), version: editing?.current_version || 0, title, assetIds: selected }) })); setSelected([]); setTitle(''); setEditing(null); setTab('projects'); setFeedback({ tone: 'success', message: 'บันทึกชุดงานพร้อมข้อมูลแบรนด์เวอร์ชันนี้แล้ว' }); }); }} className="sticky bottom-3 mt-6 rounded-2xl border border-purple-300/30 bg-[#181321]/95 p-5 shadow-xl backdrop-blur"><p className="mb-3 text-sm text-purple-200">{editing ? `แก้ไขชุดงาน · เวอร์ชันใหม่ต่อจาก ${editing.current_version}` : 'สร้างชุดงาน'} · เลือก {selected.length}/10 ไฟล์</p><div className="flex flex-wrap items-end gap-3"><div className="min-w-0 flex-1"><TextField label="ชื่อชุดงาน" required maxLength={100} value={title} disabled={busy} onChange={e => setTitle(e.target.value)} placeholder="เช่น โปรโมชั่นเกมประจำสัปดาห์" /></div><Button type="submit" disabled={busy || selected.length < 1 || selected.length > 10}>บันทึกชุดงาน</Button><button type="button" disabled={busy} onClick={() => { setSelected([]); setEditing(null); setTitle(''); }} className="px-2 py-3 text-sm text-muted">ยกเลิก</button></div></form>}
          </>}
          {tab === 'projects' && (data.projects.length === 0 ? <Empty title="ยังไม่มีชุดงาน" text="เลือกไฟล์ที่พร้อมใช้จากคลัง แล้วบันทึกรวมเป็นชุดงาน" /> : <div className="grid gap-4 sm:grid-cols-2">{data.projects.map(project => <article key={project.id} className="rounded-2xl border border-white/10 bg-white/[0.025] p-6"><p className="mb-3 text-xs text-purple-300">เวอร์ชัน {project.current_version} · แบรนด์เวอร์ชัน {project.brand_version}</p><h2 className="break-words text-xl font-bold">{project.title}</h2><p className="mt-3 text-sm text-muted">{project.asset_ids.length} ไฟล์ · เก็บถึง {new Date(project.expires_at).toLocaleDateString('th-TH')}</p><div className="mt-5 flex gap-4"><Button variant="secondary" disabled={busy} onClick={() => editProject(project)}>แก้ไขเป็นเวอร์ชันใหม่</Button><button disabled={busy} onClick={() => { if (window.confirm('ลบชุดงานและทุกเวอร์ชัน? ไฟล์ต้นฉบับยังอยู่ในคลัง')) void act(async () => { await responseData(await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })); if (editing?.id === project.id) { setEditing(null); setSelected([]); setTitle(''); } }); }} className="text-xs text-muted underline">ลบชุดงาน</button></div></article>)}</div>)}
          {tab === 'jobs' && (data.jobs.length === 0 ? <Empty title="ยังไม่มีงานเบื้องหลัง" text="เมื่ออัปโหลดไฟล์ ระบบจะแสดงผลการตรวจสอบที่นี่" /> : <div className="space-y-3">{data.jobs.map(job => <article key={job.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5"><div><h2 className="break-words font-bold">{data.assets.find(a => a.id === job.asset_id)?.name || 'ไฟล์ที่ลบแล้ว'}</h2><p className="mt-2 text-xs text-muted">{job.kind === 'delete' ? 'ลบไฟล์และคืนพื้นที่' : 'ตรวจสอบไฟล์'} · ดำเนินการ {job.attempts} ครั้ง</p>{job.error_code && <p className="mt-2 text-xs text-amber-200">{['failed', 'cancelled'].includes(job.state) ? 'ลบไฟล์และคืนพื้นที่เรียบร้อยแล้ว' : job.error_code === 'invalid_file' ? 'รูปแบบไฟล์เสียหายหรือเกินข้อจำกัด ระบบกำลังจัดการคืนพื้นที่' : 'บริการไม่พร้อม ระบบจะลองใหม่ตามลำดับ'}</p>}</div><span className="text-sm text-purple-200">{STATE_LABELS[job.state] || job.state}</span></article>)}</div>)}
          <p className="mt-8 text-xs leading-6 text-muted">คลังนี้แยกจากประวัติภาพเดิม · ชุดงานเก็บไฟล์และข้อมูลแบรนด์ตามเวอร์ชัน · สร้างวิดีโอจากภาพได้ที่ Motion Studio</p>
        </>}
      </>}
    </div>
  </main>;
}
function Metric({ label, value, hint }: { label: string; value: string; hint: string }) { return <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"><p className="text-xs text-muted">{label}</p><p className="mt-3 text-2xl font-semibold">{value}</p><p className="mt-2 text-xs text-muted">{hint}</p></div>; }
function Empty({ title, text }: { title: string; text: string }) { return <EmptyState title={title} description={text} href="/dashboard/library" action="เปิดคลังไฟล์" />; }
