"use client";
import {useState,type FormEvent} from 'react';
import {Button} from '@/app/components/ui/button';
import {TextField} from '@/app/components/ui/text-field';
import type {SavedPlan} from '@/lib/ads/model';
export function MetaExportPanel({plan}:{plan:SavedPlan}){
  const [pageId,setPageId]=useState(''),[storyId,setStoryId]=useState(''),[start,setStart]=useState(''),[kind,setKind]=useState('Photo Page Post Ad');
  const [ageMin,setAgeMin]=useState(18),[ageMax,setAgeMax]=useState(65),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const unsupported=plan.brief.goal!=='messages'||plan.brief.warmAudience||Boolean(plan.brief.audience.trim())||!['ไทย','ประเทศไทย','TH','Thailand'].includes(plan.brief.country);
  async function download(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setMessage('');try{
    const response=await fetch(`/api/ads-plans/${plan.id}/meta-export`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pageId,storyId,start,creativeType:kind,ageMin,ageMax,confirmed})});
    if(!response.ok){const data=await response.json();throw new Error(data.error||'ส่งออกไม่สำเร็จ');}
    const url=URL.createObjectURL(await response.blob());const a=document.createElement('a');a.href=url;a.download=`meta-${plan.id}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('สร้างไฟล์แล้ว นำเข้าเพื่อตรวจใน Meta โดยยังไม่กดเผยแพร่');
  }catch(e){setMessage(e instanceof Error?e.message:'ส่งออกไม่สำเร็จ');}finally{setBusy(false);}}
  return <section className="rounded-2xl border border-purple-300/30 bg-purple-400/5 p-4"><h4 className="font-bold">ไฟล์นำเข้า Meta · รุ่นทดสอบ</h4><p className="mt-2 text-sm leading-6 text-white/65">ตามแม่แบบที่ให้มา: Messenger · 1 แคมเปญ / 1 ชุด / 1 โฆษณา · ทุกระดับปิดไว้ (PAUSED)</p>
    <p className="mt-3 text-sm leading-6 text-amber-100">รุ่นนี้ใช้โพสต์ที่เผยแพร่บนเพจแล้ว ภาพและข้อความจะมาจาก Post ID นั้น ไม่ได้นำภาพจากคลังหรือข้อความแผนไปสร้างโพสต์ใหม่</p>
    {!plan.accepted_at?<p className="mt-4 text-sm text-purple-200">ยืนยันว่าตรวจแผนแล้ว เพื่อเปิดขั้นตอนส่งออก</p>:unsupported?<p className="mt-4 text-sm text-amber-200">รองรับแผนคนทัก กลุ่มกว้างในไทย ยังไม่รองรับกลุ่มเฉพาะหรือยิงซ้ำ สร้างแผนใหม่ให้ตรงเงื่อนไขก่อนส่งออก</p>:<form onSubmit={download} className="mt-5 space-y-4" onChange={()=>setConfirmed(false)}>
      <fieldset disabled={busy} className="space-y-4">
        <TextField label="Page ID ของร้าน" required pattern="[0-9]{5,30}" value={pageId} onChange={e=>setPageId(e.target.value)}/>
        <TextField label="Post ID แบบตัวเลข (ไม่ใช่ pfbid)" required pattern="[0-9]{5,30}" value={storyId} onChange={e=>setStoryId(e.target.value)}/>
        <label className="block text-sm">ชนิดโพสต์<select className="mt-2 w-full rounded-xl bg-[#101018] p-3" value={kind} onChange={e=>setKind(e.target.value)}><option value="Photo Page Post Ad">โพสต์ภาพ</option><option value="Video Page Post Ad">โพสต์วิดีโอ</option><option value="Link Page Post Ad">โพสต์ลิงก์</option></select></label>
        <TextField label="เริ่มเมื่อไร (เวลาไทย / Bangkok)" type="datetime-local" required value={start} onChange={e=>setStart(e.target.value)}/>
        <p className="text-xs leading-6 text-muted">เริ่มล่วงหน้าอย่างน้อย 15 นาที สิ้นสุดหลัง {plan.brief.days} วัน งบตลอดช่วง {plan.brief.budget.toLocaleString('th-TH')} บาท · ไม่ใช่งบรายวัน</p>
        <div className="grid grid-cols-2 gap-3"><TextField label="อายุต่ำสุด" type="number" required min={18} max={65} value={ageMin} onChange={e=>setAgeMin(Number(e.target.value))}/><TextField label="อายุสูงสุด" type="number" required min={18} max={65} value={ageMax} onChange={e=>setAgeMax(Number(e.target.value))}/></div>
      </fieldset>
      <label className="flex items-start gap-3 text-xs leading-6"><input type="checkbox" className="mt-1.5" checked={confirmed} disabled={busy} onChange={e=>{e.stopPropagation();setConfirmed(e.target.checked);}}/>ยืนยันว่าเพจ/โพสต์เป็นของร้าน เนื้อหาตรงแผน กลุ่มเป้าหมายไทย บัญชีใช้ THB และเขตเวลา Asia/Bangkok และจะตรวจผลนำเข้าก่อนเผยแพร่</label>
      <Button type="submit" fullWidth disabled={!confirmed||busy} loading={busy}>ดาวน์โหลดไฟล์ Meta CSV</Button>
    </form>}
    {message&&<p role="status" className="mt-3 text-sm leading-6 text-purple-100">{message}</p>}
    <p className="mt-4 text-xs leading-6 text-muted">ไฟล์เป็น UTF-16 คั่นด้วยแท็บตามต้นฉบับ ไม่มีรหัสแคมเปญเดิม ยังไม่ผ่านการทดสอบนำเข้าในบัญชี Meta จริง หาก Meta แจ้งช่องที่ต้องเพิ่ม ให้เก็บข้อความข้อผิดพลาดมาแก้รูปแบบก่อนเปิดใช้</p>
  </section>;
}
