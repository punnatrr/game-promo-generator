"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { StatusMessage } from "@/app/components/ui/status-message";

type Game = { id:string; slug:string; name:string; iconUrl:string|null; aliases:string[] };
type Lead = {
  id:string; status:string; original_text:string; source_type:string; source_url:string|null;
  author_name:string|null; intent:string; lead_score:number; temperature:string;
  game_id:string|null; game_name:string|null; game_slug:string|null; icon_url:string|null;
  detected_currency:string|null; detected_amount:number|null; detected_package:string|null;
  detected_location:string|null; ai_summary:string|null; analysis_status:string;
  created_at:string; first_seen_at:string; follow_up_at:string|null; follow_up_note:string|null;
};
type LeadDetail = {
  lead:Lead & Record<string,unknown>;
  notes:Array<{id:string;body:string;created_at:string}>;
  replies:Array<{id:string;content:string;tone:string;created_at:string}>;
  history:Array<{id:string;old_status:string|null;new_status:string;created_at:string}>;
  occurrences:Array<{id:string;source_type:string;source_url:string|null;discovered_at:string}>;
};
type ListState = {items:Lead[];page:number;limit:number;total:number};

const STATUSES=["NEW","REVIEWED","CONTACTED","WAITING","FOLLOW_UP","WON","LOST"] as const;
const STATUS_LABELS:Record<string,string>={
  NEW:"ใหม่",REVIEWED:"ตรวจแล้ว",CONTACTED:"ติดต่อแล้ว",WAITING:"รอลูกค้า",
  FOLLOW_UP:"ติดตาม",WON:"ปิดการขาย",LOST:"ไม่สำเร็จ",IGNORED:"ไม่นำเสนอ",
};
const INTENT_LABELS:Record<string,string>={
  BUY_TOPUP:"ต้องการเติม",ASK_PRICE:"ถามราคา",LOOKING_FOR_STORE:"หาร้าน",
  ASK_PACKAGE:"ถามแพ็ก",COMPARE_PRICE:"เทียบราคา",ASK_AVAILABILITY:"ถามว่ามีไหม",
  ASK_PAYMENT:"ถามการชำระเงิน",ASK_PROMOTION:"ถามโปร",OTHER:"อื่น ๆ",
};

async function result(response:Response){
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||"ดำเนินการไม่สำเร็จ");
  return data;
}
function ago(value:string){
  const delta=Math.max(0,Date.now()-new Date(value).getTime());
  const minute=Math.floor(delta/60000);
  if(minute<1)return "เมื่อสักครู่";
  if(minute<60)return minute+" นาทีที่แล้ว";
  const hour=Math.floor(minute/60);
  if(hour<24)return hour+" ชม.ที่แล้ว";
  return Math.floor(hour/24)+" วันที่แล้ว";
}
function scoreClass(score:number){
  if(score>=80)return "border-red-400/40 bg-red-400/10 text-red-100";
  if(score>=60)return "border-orange-300/30 bg-orange-300/10 text-orange-100";
  return "border-white/10 bg-white/[0.04] text-white/75";
}

export default function LeadRadarPage(){
  const [state,setState]=useState<ListState|null>(null);
  const [games,setGames]=useState<Game[]>([]);
  const [selected,setSelected]=useState<string|null>(null);
  const [detail,setDetail]=useState<LeadDetail|null>(null);
  const [status,setStatus]=useState("");
  const [gameId,setGameId]=useState("");
  const [query,setQuery]=useState("");
  const [minScore,setMinScore]=useState("");
  const [showAdd,setShowAdd]=useState(false);
  const [leadText,setLeadText]=useState("");
  const [sourceUrl,setSourceUrl]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  const params=useMemo(()=>{
    const p=new URLSearchParams();
    if(status)p.set("status",status);
    if(gameId)p.set("gameId",gameId);
    if(query.trim())p.set("q",query.trim());
    if(minScore)p.set("minScore",minScore);
    return p;
  },[status,gameId,query,minScore]);

  const refresh=useCallback(async()=>{
    const data=await result(await fetch("/api/leads?"+params.toString(),{cache:"no-store"}));
    setState(data);
    if(selected && !data.items.some((lead:Lead)=>lead.id===selected))setSelected(null);
  },[params,selected]);

  const loadDetail=useCallback(async(id:string)=>{
    const data=await result(await fetch("/api/leads/"+id,{cache:"no-store"}));
    setDetail(data);
  },[]);

  useEffect(()=>{
    const controller=new AbortController();
    Promise.all([
      fetch("/api/leads?"+params.toString(),{cache:"no-store",signal:controller.signal}).then(result),
      fetch("/api/games",{cache:"no-store",signal:controller.signal}).then(result),
    ]).then(([leads,gameData])=>{
      if(controller.signal.aborted)return;
      setState(leads);
      setGames(gameData.games||[]);
    }).catch(error=>{if(!controller.signal.aborted)setMessage(error.message);});
    return()=>controller.abort();
  },[params]);

  useEffect(()=>{
    if(!selected){setDetail(null);return;}
    void loadDetail(selected).catch(error=>setMessage(error.message));
  },[selected,loadDetail]);

  async function act(action:()=>Promise<void>){
    if(busy)return;
    setBusy(true);setMessage("");
    try{await action();}catch(error){setMessage(error instanceof Error?error.message:"ดำเนินการไม่สำเร็จ");}
    finally{setBusy(false);}
  }

  async function addLead(event:FormEvent){
    event.preventDefault();
    await act(async()=>{
      const data=await result(await fetch("/api/leads",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({text:leadText,sourceUrl:sourceUrl||null,sourceType:sourceUrl?"URL_PASTE":"MANUAL"}),
      }));
      setLeadText("");setSourceUrl("");setShowAdd(false);
      await refresh();
      setSelected(data.id);
    });
  }

  async function changeStatus(next:string){
    if(!selected)return;
    await act(async()=>{
      await result(await fetch("/api/leads/"+selected+"/status",{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:next}),
      }));
      await Promise.all([refresh(),loadDetail(selected)]);
    });
  }

  async function generateReply(){
    if(!selected)return;
    await act(async()=>{
      await result(await fetch("/api/leads/"+selected+"/generate-reply",{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tone:"SHORT_FRIENDLY"}),
      }));
      await loadDetail(selected);
    });
  }

  async function copyReply(){
    const reply=detail?.replies[0]?.content;
    if(!reply)return;
    await navigator.clipboard.writeText(reply);
    setMessage("คัดลอกคำตอบแล้ว");
  }

  return <main className="min-h-[calc(100vh-72px)]">
    <div className="border-b border-white/10 px-4 py-4 sm:px-6">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-purple-300">Game Lead Radar</p>
          <h1 className="mt-1 text-2xl font-bold">ค้นหาลูกค้าหาเกม</h1>
          <p className="mt-1 text-sm text-muted">ดูว่าใครกำลังหาเกมอะไร และควรตอบคนไหนก่อน</p>
        </div>
        <div className="flex gap-2">
          <Link className="action-link secondary" href="/dashboard/leads/follow-up">ติดตาม</Link>
          <Button onClick={()=>setShowAdd(true)}>+ เพิ่ม Lead</Button>
        </div>
      </div>
    </div>

    {message&&<div className="mx-auto max-w-[1600px] px-4 pt-4 sm:px-6"><StatusMessage tone={message.includes("คัดลอก")?"success":"error"}>{message}</StatusMessage></div>}

    {showAdd&&<div className="mx-auto max-w-[1600px] px-4 pt-4 sm:px-6">
      <form onSubmit={addLead} className="rounded-2xl border border-purple-300/25 bg-purple-400/[0.06] p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_320px_auto]">
          <textarea autoFocus required maxLength={12000} rows={3} value={leadText} onChange={e=>setLeadText(e.target.value)}
            className="ui-field w-full resize-y px-4 py-3" placeholder="วางข้อความ เช่น มีร้านเติม 1,000 VP ราคาไม่แรงไหมครับ"/>
          <input type="url" value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)} className="ui-field w-full px-4 py-3"
            placeholder="ลิงก์ต้นทาง (ไม่บังคับ)"/>
          <div className="flex gap-2 md:flex-col"><Button type="submit" loading={busy}>วิเคราะห์</Button><Button variant="ghost" onClick={()=>setShowAdd(false)}>ยกเลิก</Button></div>
        </div>
        <p className="mt-2 text-xs text-muted">การใส่ URL จะเก็บไว้สำหรับเปิดต้นทางเท่านั้น ระบบไม่ scrape Facebook และไม่ส่งข้อความอัตโนมัติ</p>
      </form>
    </div>}

    <div className="mx-auto grid max-w-[1600px] gap-0 px-0 py-4 lg:grid-cols-[240px_minmax(360px,1fr)_minmax(360px,520px)] lg:px-6">
      <aside className="border-b border-white/10 p-4 lg:border-b-0 lg:border-r">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          <button onClick={()=>setStatus("")} className={"rounded-xl px-3 py-2 text-left text-sm "+(!status?"bg-purple-400/15 text-purple-100":"text-muted hover:bg-white/5")}>Lead ทั้งหมด</button>
          <button onClick={()=>{setStatus("");setMinScore("80");}} className="rounded-xl px-3 py-2 text-left text-sm text-muted hover:bg-white/5">🔥 Hot Leads</button>
          <button onClick={()=>setStatus("NEW")} className="rounded-xl px-3 py-2 text-left text-sm text-muted hover:bg-white/5">ใหม่</button>
          <button onClick={()=>setStatus("FOLLOW_UP")} className="rounded-xl px-3 py-2 text-left text-sm text-muted hover:bg-white/5">ต้องติดตาม</button>
          <button onClick={()=>setStatus("WON")} className="rounded-xl px-3 py-2 text-left text-sm text-muted hover:bg-white/5">ปิดการขาย</button>
        </div>
        <div className="mt-5 space-y-3">
          <input value={query} onChange={e=>setQuery(e.target.value)} className="ui-field w-full px-3 py-2 text-sm" placeholder="ค้นหา Lead"/>
          <select value={gameId} onChange={e=>setGameId(e.target.value)} className="ui-field w-full px-3 py-2 text-sm">
            <option value="">ทุกเกม</option>{games.map(game=><option key={game.id} value={game.id}>{game.name}</option>)}
          </select>
          <select value={minScore} onChange={e=>setMinScore(e.target.value)} className="ui-field w-full px-3 py-2 text-sm">
            <option value="">ทุกคะแนน</option><option value="80">80+ Hot</option><option value="60">60+</option><option value="40">40+</option>
          </select>
        </div>
      </aside>

      <section className="min-h-[560px] border-b border-white/10 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <p className="text-sm font-semibold">Lead Inbox</p><p className="text-xs text-muted">{state?.total??0} รายการ</p>
        </div>
        {!state?<div className="p-5 text-sm text-muted">กำลังโหลด Lead…</div>:state.items.length===0?
          <div className="p-6"><div className="empty-state"><span className="empty-icon">＋</span><h2>ยังไม่มี Lead</h2><p>เพิ่มข้อความลูกค้า หรือ Import จากแหล่งข้อมูลที่ได้รับอนุญาต</p><Button onClick={()=>setShowAdd(true)}>เพิ่ม Lead</Button></div></div>:
          <div className="divide-y divide-white/10">{state.items.map(lead=><button key={lead.id} onClick={()=>setSelected(lead.id)}
            className={"block w-full p-4 text-left transition hover:bg-white/[0.035] "+(selected===lead.id?"bg-purple-400/[0.07]":"")}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2">
                <span className="status-badge">{STATUS_LABELS[lead.status]||lead.status}</span>
                <strong className="text-sm">{lead.game_name||"ยังไม่ระบุเกม"}</strong>
                {lead.analysis_status==="NEEDS_REVIEW"&&<span className="text-xs text-yellow-200">Needs Review</span>}
              </div>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/85">{lead.original_text}</p>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                <span>{INTENT_LABELS[lead.intent]||lead.intent}</span>
                {lead.detected_amount&&<span>{lead.detected_amount} {lead.detected_currency||""}</span>}
                <span>{lead.source_type}</span><span>{ago(lead.first_seen_at)}</span>
              </div></div>
              <span className={"shrink-0 rounded-xl border px-3 py-2 text-lg font-bold "+scoreClass(Number(lead.lead_score))}>{lead.lead_score}</span>
            </div>
          </button>)}</div>}
      </section>

      <aside className="min-h-[560px]">
        {!selected||!detail?<div className="p-8 text-center text-sm text-muted">เลือก Lead เพื่อดูรายละเอียดและคำตอบที่แนะนำ</div>:
        <div>
          <div className="border-b border-white/10 p-5">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-purple-300">{detail.lead.game_name||"ยังไม่ระบุเกม"}</p><h2 className="mt-1 text-xl font-bold">{INTENT_LABELS[detail.lead.intent]||detail.lead.intent}</h2></div><span className={"rounded-xl border px-3 py-2 font-bold "+scoreClass(Number(detail.lead.lead_score))}>{detail.lead.lead_score}/100</span></div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7">{detail.lead.original_text}</p>
            {detail.lead.ai_summary&&<div className="mt-4 rounded-xl bg-white/[0.04] p-3 text-sm leading-6"><span className="text-xs text-muted">AI Summary</span><p className="mt-1">{detail.lead.ai_summary}</p></div>}
          </div>

          <div className="space-y-5 p-5">
            <section><h3 className="text-sm font-bold">ข้อมูลที่ตรวจพบ</h3><dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-muted">แพ็ก</dt><dd>{detail.lead.detected_amount?String(detail.lead.detected_amount)+" "+(detail.lead.detected_currency||""):"—"}</dd></div>
              <div><dt className="text-xs text-muted">พื้นที่</dt><dd>{detail.lead.detected_location||"—"}</dd></div>
              <div><dt className="text-xs text-muted">Source</dt><dd>{detail.lead.source_type}</dd></div>
              <div><dt className="text-xs text-muted">วิเคราะห์</dt><dd>{detail.lead.analysis_status}</dd></div>
            </dl></section>

            <section className="border-t border-white/10 pt-5"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-bold">คำตอบแนะนำ</h3><Button variant="secondary" disabled={busy} onClick={generateReply}>สร้างคำตอบ</Button></div>
              {detail.replies[0]?<div className="mt-3 rounded-xl border border-purple-300/20 bg-purple-400/[0.07] p-4"><p className="whitespace-pre-wrap text-sm leading-7">{detail.replies[0].content}</p><Button className="mt-3" fullWidth onClick={copyReply}>Copy Reply</Button></div>:<p className="mt-3 text-sm text-muted">ยังไม่มีคำตอบ ระบบจะใช้ราคาจริงในฐานข้อมูลเท่านั้น ถ้าไม่มีราคาจะไม่เดาราคา</p>}
            </section>

            <section className="border-t border-white/10 pt-5"><h3 className="text-sm font-bold">ทำต่อ</h3><div className="mt-3 grid grid-cols-2 gap-2">
              {detail.lead.source_url?<a className="action-link secondary" target="_blank" rel="noreferrer" href={detail.lead.source_url}>เปิดต้นทาง</a>:<span className="action-link secondary opacity-40">ไม่มีลิงก์</span>}
              <select value={detail.lead.status} disabled={busy} onChange={e=>void changeStatus(e.target.value)} className="ui-field px-3 py-2 text-sm">
                {STATUSES.map(value=><option key={value} value={value}>{STATUS_LABELS[value]}</option>)}
              </select>
            </div></section>

            {detail.history.length>0&&<details className="border-t border-white/10 pt-5"><summary className="text-sm font-bold">ประวัติสถานะ</summary><div className="mt-3 space-y-2 text-xs text-muted">{detail.history.slice(0,8).map(item=><p key={item.id}>{STATUS_LABELS[item.new_status]||item.new_status} · {new Date(item.created_at).toLocaleString("th-TH")}</p>)}</div></details>}
          </div>
        </div>}
      </aside>
    </div>
  </main>;
}
