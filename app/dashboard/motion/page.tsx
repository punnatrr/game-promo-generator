"use client";
import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { TextField } from '@/app/components/ui/text-field';
import { StatusMessage } from '@/app/components/ui/status-message';
import { Skeleton } from '@/app/components/ui/workspace';
import { AssetPicker } from '@/app/components/creator/asset-picker';
import { CreatorShell, CreatorWorkspace, CreatorSettingsPanel, CreatorCanvas, CreatorPrimaryAction, CreatorGenerationState, CreatorResultActions } from '@/app/components/creator/creator-shell';
import type { Asset, Library } from '@/lib/media/model';
import { DEFAULT_PLAN, fitPoster, MOTION_LABELS, parsePlan, type MotionJob, type MotionPlan, type Studio } from '@/lib/motion/model';
async function result(response: Response) { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'ดำเนินการไม่สำเร็จ กรุณาลองใหม่'); return data; }
export default function MotionPage() {
  const [studio, setStudio] = useState<Studio | null>(null), [library, setLibrary] = useState<Library | null>(null);
  const [selected, setSelected] = useState(''), [title, setTitle] = useState(''), [jobId, setJobId] = useState('');
  const [plan, setPlan] = useState<MotionPlan>(DEFAULT_PLAN), [busy, setBusy] = useState(false), [confirmed, setConfirmed] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'error' | 'success'; message: string } | null>(null);
  const [asOf, setAsOf] = useState(0), [needsLogin, setNeedsLogin] = useState(false);
  const gate = useRef(false), auth = useRef(false), draftKey = useRef<{ payload: string; id: string } | null>(null), synced = useRef(''), draftSettings = useRef<MotionPlan | null>(null);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const responses = await Promise.all([fetch('/api/motion', { cache: 'no-store', signal }), fetch('/api/assets', { cache: 'no-store', signal })]);
    if (responses.some(r => r.status === 401)) { auth.current = true; setNeedsLogin(true); return; }
    const [next, assets] = await Promise.all(responses.map(result)); setStudio(next); setLibrary(assets); setAsOf(Date.now());
  }, []);
  useEffect(() => {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    const poll = async () => { try { if (!document.hidden) await refresh(controller.signal); } catch (error) { if (!controller.signal.aborted) setFeedback({ tone: 'error', message: error instanceof Error ? error.message : 'โหลดข้อมูลไม่ได้' }); } finally { if (!controller.signal.aborted && !auth.current) timer = setTimeout(poll, 5000); } };
    const asset = new URLSearchParams(window.location.search).get('asset');
    if (asset) queueMicrotask(() => setSelected(asset));
    void poll(); return () => { controller.abort(); clearTimeout(timer); };
  }, [refresh]);
  const job = studio?.jobs.find(j => j.id === jobId);
  const source = library?.assets.find(a => a.id === (job?.source_asset_id || selected));
  useEffect(() => {
    if (!job || job.state !== 'review' || synced.current === job.id + ':' + job.revision) return;
    const next = job;
    queueMicrotask(() => { synced.current = next.id + ':' + next.revision; setPlan(draftSettings.current ? { ...next.plan, ...draftSettings.current, boxes: draftSettings.current.boxes.length ? draftSettings.current.boxes : next.plan.boxes } : next.plan); draftSettings.current = null; setConfirmed(false); });
  }, [job]);
  async function act(work: () => Promise<void>) { if (gate.current) return; gate.current = true; setBusy(true); setFeedback(null); try { await work(); await refresh(); } catch (error) { setFeedback({ tone: 'error', message: error instanceof Error ? error.message : 'ดำเนินการไม่สำเร็จ' }); } finally { gate.current = false; setBusy(false); } }
  function edit(next: MotionPlan) { setPlan(next); setConfirmed(false); }
  function choose(id: string) { setSelected(id); const asset = library?.assets.find(a => a.id === id); if (asset?.metadata) { const ratio = asset.metadata.width / asset.metadata.height; setPlan({ ...DEFAULT_PLAN, ratio: ratio > 1.25 ? '16:9' : ratio < .8 ? '9:16' : '1:1' }); } }
  function review(next: MotionJob) { synced.current = next.id + ':' + next.revision; setJobId(next.id); setSelected(next.source_asset_id); setTitle(next.title); setPlan(next.plan); setConfirmed(false); setFeedback(null); }
  function newVersion() { setJobId(''); setConfirmed(false); draftKey.current = null; synced.current = ''; setFeedback(null); }
  const processing = Boolean(job && ['analyzing', 'queued', 'running', 'retry'].includes(job.state));
  const editable = !job || job.state === 'review';
  const sourceReady = source?.state === 'ready' && Date.parse(source.expires_at) > asOf;
  const left = <CreatorSettingsPanel>
    <h2 className="studio-section-title">ภาพต้นฉบับ</h2>
    {library ? <AssetPicker library={library} asOf={asOf} value={selected} onChange={choose} onUploaded={refresh} disabled={busy || Boolean(job)} /> : needsLogin ? <p className="text-sm text-muted">เข้าสู่ระบบเพื่อเลือกภาพและบันทึกวิดีโอ</p> : <Skeleton label="กำลังโหลดภาพในคลัง" />}
    <fieldset disabled={busy || !editable} className="mt-6 space-y-5">
      <label className="block text-sm">การเคลื่อนไหว<select className="ui-field mt-2 w-full border p-3" value={plan.effect} onChange={e => edit({ ...plan, effect: e.target.value as MotionPlan['effect'] })}><option value="float">ภาพลอยเบา ๆ · แนะนำ</option><option value="still">ภาพนิ่งและไฮไลต์ตามลำดับ</option></select></label>
      <div className="grid grid-cols-2 gap-4"><label className="text-sm">ความยาว<select className="ui-field mt-2 w-full border p-3" value={plan.duration} onChange={e => edit({ ...plan, duration: Number(e.target.value) as MotionPlan['duration'] })}>{[6, 10, 15].map(v => <option key={v} value={v}>{v} วินาที</option>)}</select></label><label className="text-sm">ขนาดวิดีโอ<select className="ui-field mt-2 w-full border p-3" value={plan.ratio} onChange={e => edit({ ...plan, ratio: e.target.value as MotionPlan['ratio'] })}><option>9:16</option><option>1:1</option><option>16:9</option></select></label></div>
      <details className="advanced-settings"><summary>ตั้งค่าเพิ่มเติม · ชื่อและกรอบไฮไลต์</summary><div className="mt-4"><TextField label="ชื่อวิดีโอ" value={title} maxLength={100} onChange={e => setTitle(e.target.value)} placeholder={source?.name || 'วิดีโอจากภาพ'} />
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold">กรอบไฮไลต์ {plan.boxes.length}/6</h3><button type="button" disabled={plan.boxes.length>=6||busy} onClick={()=>edit({...plan,boxes:[...plan.boxes,{x:10,y:60,width:80,height:20,kind:'price'}]})} className="rounded-lg border border-purple-300/40 px-3 py-2 text-xs text-purple-200 disabled:opacity-40">＋ เพิ่มกรอบ</button></div>
            <p className="mt-2 text-xs leading-6 text-muted">ตำแหน่งเป็นเปอร์เซ็นต์จากซ้ายและบนของภาพ กรอบจะแสดงเรียงทีละตำแหน่ง โดยไม่เขียนราคาใหม่</p>
            {plan.boxes.map((box,index)=><fieldset key={index} disabled={busy} className="mt-4 rounded-xl border border-white/10 p-4"><legend className="px-2 text-xs text-purple-200">กรอบ {index+1}</legend><div className="mb-3 flex justify-between gap-3"><select aria-label={`ประเภทกรอบ ${index+1}`} value={box.kind} onChange={e=>edit({...plan,boxes:plan.boxes.map((b,i)=>i===index?{...b,kind:e.target.value as typeof box.kind}:b)})} className="min-w-0 rounded-lg bg-[#15151d] p-2 text-xs"><option value="price">แพ็กเกจ / ราคา</option><option value="visual">ตัวละคร / ภาพหลัก</option></select><button type="button" onClick={()=>edit({...plan,boxes:plan.boxes.filter((_,i)=>i!==index)})} className="text-xs text-muted underline">ลบกรอบ</button></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{([['x','ซ้าย'],['y','บน'],['width','กว้าง'],['height','สูง']] as const).map(([key,label])=><label key={key} className="text-xs text-white/65">{label} %<input type="number" min={0} max={100} step={1} value={box[key]} onChange={e=>edit({...plan,boxes:plan.boxes.map((b,i)=>i===index?{...b,[key]:Number(e.target.value)}:b)})} className="mt-1 w-full rounded-lg bg-[#15151d] p-2"/></label>)}</div></fieldset>)}

      </div></details>
    </fieldset>
    {job?.state === 'review' && <label className="mt-5 flex items-start gap-3 text-sm text-muted"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} className="mt-1" />ตรวจภาพและกรอบไฮไลต์แล้ว ใช้โควตา 1 คลิปเมื่อสร้างสำเร็จ</label>}
    <CreatorPrimaryAction quota={studio ? studio.entitlement.enabled ? `เหลือ ${Math.max(0, studio.entitlement.limit - studio.entitlement.used - studio.entitlement.reserved)} คลิปเดือนนี้` : 'บัญชีนี้ยังไม่ได้เปิดสิทธิ์สร้างวิดีโอ' : undefined}>
      {needsLogin ? <Link className="action-link w-full" href="/sign-in?next=%2Fdashboard%2Fmotion">เข้าสู่ระบบเพื่อสร้างวิดีโอ</Link> : !job ? <Button fullWidth loading={busy} loadingLabel="กำลังเตรียมตัวอย่าง…" disabled={!sourceReady || !studio?.entitlement.enabled} onClick={() => void act(async () => { const name = title.trim() || source?.name.slice(0, 100) || 'วิดีโอจากภาพ'; const payload = JSON.stringify({ sourceAssetId: selected, title: name }); if (draftKey.current?.payload !== payload) draftKey.current = { payload, id: crypto.randomUUID() }; draftSettings.current = plan; const next = await result(await fetch('/api/motion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: draftKey.current.id, sourceAssetId: selected, title: name }) })); setJobId(next.id); })}>เตรียมตัวอย่างวิดีโอ</Button> : job.state === 'review' ? <Button fullWidth loading={busy} loadingLabel="กำลังส่งงาน…" disabled={!confirmed || !studio?.entitlement.enabled || !studio.storageAvailable} onClick={() => void act(async () => { parsePlan(plan); await result(await fetch(`/api/motion/${job.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: job.revision, plan, confirmed: true }) })); setFeedback({ tone: 'success', message: 'รับงานแล้ว วิดีโอจะแสดงในพื้นที่ด้านขวาเมื่อเสร็จ' }); })}>สร้างวิดีโอ</Button> : <Button fullWidth variant="secondary" disabled={busy || processing} onClick={newVersion}>{processing ? MOTION_LABELS[job.state] : 'สร้างอีกเวอร์ชัน'}</Button>}
      {!job && !needsLogin && <p className="mt-2 text-xs text-muted">ตรวจตัวอย่างก่อนสร้าง · ยังไม่ใช้โควตาในขั้นนี้</p>}
      {job?.state === 'review' && <p className="mt-2 text-xs text-muted">{job.analysis_source === 'vision' ? 'AI แนะนำกรอบแล้ว ปรับเพิ่มได้ในตั้งค่าเพิ่มเติม' : 'ตรวจภาพตัวอย่างก่อนยืนยัน วิดีโอไม่มีเสียง'}</p>}
      {studio && !studio.storageAvailable && <p className="mt-2 text-sm text-amber-200">พื้นที่เก็บวิดีโอยังไม่พร้อมใช้งาน</p>}
    </CreatorPrimaryAction>
    {feedback && <StatusMessage tone={feedback.tone} className="mt-4">{job?.state === "succeeded" && feedback.tone === "success" ? "สร้างวิดีโอสำเร็จ ดาวน์โหลดหรือสร้างอีกเวอร์ชันได้เลย" : feedback.message}{!studio && <button className="ml-2 underline" onClick={() => void act(refresh)}>ลองใหม่</button>}</StatusMessage>}
  </CreatorSettingsPanel>;
  return <CreatorShell title="สร้างวิดีโอจากภาพ" description="เปลี่ยนภาพโปรโมชันให้เป็นคลิป พร้อมดูตัวอย่างในหน้าเดียว">
    <CreatorWorkspace>{left}<CreatorCanvas busy={busy || processing}>
      {job?.state === 'succeeded' && job.output_ready ? <><video key={job.output_asset_id} className="studio-video-result" controls playsInline src={`/api/assets/${job.output_asset_id}?inline=1`} /><CreatorResultActions downloadHref={`/api/assets/${job.output_asset_id}`} onNewVersion={newVersion} /><p className="canvas-caption">บันทึกวิดีโอในคลังให้อัตโนมัติแล้ว</p></> : <>
        {sourceReady && source ? <div className="studio-preview"><MotionPreview key={source.id} asset={source} plan={plan} /><p className="canvas-caption">ตัวอย่างการเคลื่อนไหว · ภาพและราคาเดิมอยู่ครบ</p></div> : <CreatorGenerationState title={source && ['uploading','queued','running','retry'].includes(source.state) ? 'กำลังตรวจไฟล์ที่อัปโหลด' : 'เลือกภาพเพื่อเริ่มสร้าง'} description={source && ['uploading','queued','running','retry'].includes(source.state) ? 'เมื่อไฟล์พร้อม ภาพจะแสดงที่นี่' : 'อัปโหลดโปสเตอร์หรือเลือกภาพที่พร้อมใช้จากคลังทางซ้าย'} processing={Boolean(source && ['uploading','queued','running','retry'].includes(source.state))} />}
        {(processing || busy) && <div className="canvas-state-banner" role="status">{busy ? 'กำลังเตรียมงาน…' : MOTION_LABELS[job!.state]} · กลับมาดูผลในหน้านี้ได้</div>}
        {job && ['failed', 'cancelled'].includes(job.state) && <StatusMessage tone="error">{MOTION_LABELS[job.state]} <button className="underline" onClick={newVersion}>สร้างอีกเวอร์ชัน</button></StatusMessage>}
        {job?.state === 'succeeded' && !job.output_ready && <CreatorGenerationState title="ไฟล์ผลลัพธ์หมดอายุหรือถูกลบแล้ว" description="เลือกสร้างอีกเวอร์ชันจากภาพต้นฉบับได้" />}
      </>}
    </CreatorCanvas></CreatorWorkspace>
    {studio && studio.jobs.length > 0 && <section className="studio-recent"><h2>งานล่าสุด</h2><div>{studio.jobs.map(item => <div className="studio-recent-item" key={item.id}><button disabled={busy} onClick={() => review(item)}><span>{item.title}</span><small>{MOTION_LABELS[item.state]}</small></button>{['analyzing','review','queued','retry'].includes(item.state) && <button className="recent-cancel" disabled={busy} onClick={() => { if (window.confirm('ยกเลิกงานวิดีโอนี้?')) void act(async () => { await result(await fetch(`/api/motion/${item.id}`, { method: 'DELETE' })); }); }}>ยกเลิก</button>}</div>)}</div></section>}
  </CreatorShell>;
}

function MotionPreview({asset,plan}:{asset:Asset;plan:MotionPlan}) {
  const [natural,setNatural]=useState<{width:number;height:number}|null>(null);
  const [playing,setPlaying]=useState(false),[elapsed,setElapsed]=useState(0);
  useEffect(()=>{if(!playing)return;let raf=0;const start=performance.now();const tick=(now:number)=>{setElapsed(((now-start)/1000)%plan.duration);raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);},[playing,plan.duration]);
  const frame=fitPoster(natural?.width||asset.metadata?.width||1,natural?.height||asset.metadata?.height||1,plan.ratio);
  const y=playing&&plan.effect==='float'?6*Math.sin(2*Math.PI*elapsed/plan.duration):0;
  return <><div className="relative mx-auto w-full max-w-80 overflow-hidden rounded-xl border border-white/15 bg-background" style={{aspectRatio:`${frame.width}/${frame.height}`}}><div className="absolute" style={{width:`${frame.posterWidth/frame.width*100}%`,height:`${frame.posterHeight/frame.height*100}%`,left:`${(frame.width-frame.posterWidth)/2/frame.width*100}%`,top:`${((frame.height-frame.posterHeight)/2+y)/frame.height*100}%`}}><Image onLoad={e=>setNatural({width:e.currentTarget.naturalWidth,height:e.currentTarget.naturalHeight})} unoptimized fill sizes="320px" src={`/api/assets/${asset.id}/preview`} alt={`ภาพต้นฉบับ ${asset.name}`} className="object-contain"/>{plan.boxes.map((box,i)=><span key={i} className="pointer-events-none absolute border-2" style={{left:`${box.x}%`,top:`${box.y}%`,width:`${box.width}%`,height:`${box.height}%`,borderColor:box.kind==='price'?'#fde047':'#c4b5fd',opacity:!playing||Math.floor(elapsed/plan.duration*plan.boxes.length)===i?1:0}}>{!playing&&<span className="absolute -top-4 left-0 bg-black/80 px-1 text-[10px] text-white">{i+1}</span>}</span>)}</div></div><button type="button" onClick={()=>setPlaying(v=>!v)} className="mt-3 w-full rounded-xl border border-white/15 py-2 text-sm text-purple-200">{playing?'หยุดตัวอย่าง':'เล่นตัวอย่างแผน'}</button></>;
}
