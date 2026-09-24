"use client";
import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { Button } from "@/app/components/ui/button";
import { StatusMessage } from "@/app/components/ui/status-message";
import { bytesLabel, FILE_TYPES, type Library } from "@/lib/media/model";
export function AssetPicker({ library, value, onChange, onUploaded, disabled, asOf, kind = "image" }: { library: Library; value: string; onChange: (id: string) => void; onUploaded: () => Promise<void>; disabled?: boolean; asOf: number; kind?: "image" | "video" }) {
  const input = useRef<HTMLInputElement>(null), pending = useRef(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  async function data(response: Response) { const body = await response.json(); if (!response.ok) throw new Error(body.error || "อัปโหลดไม่สำเร็จ กรุณาลองใหม่"); return body; }
  async function add(file?: File) {
    if (!file || pending.current) return;
    pending.current = true; setBusy(true); setMessage(""); setProgress(null);
    try {
      if (!Object.hasOwn(FILE_TYPES, file.type) || !file.type.startsWith(kind + "/")) throw new Error(kind === "image" ? "เลือกภาพ PNG, JPG หรือ WebP" : "เลือกคลิป MP4, MOV หรือ WebM");
      if (file.size > library.limits[kind]) throw new Error(`ไฟล์ต้องไม่เกิน ${bytesLabel(library.limits[kind])}`);
      const ticket = await data(await fetch("/api/assets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, contentType: file.type, size: file.size, requestKey: crypto.randomUUID() }) }));
      if (ticket.local) await data(await fetch(`/api/assets/${ticket.id}/local-upload`, { method: "PUT", body: file }));
      else { await upload(ticket.pathname, file, { access: "private", handleUploadUrl: "/api/assets/upload", multipart: file.size > 5 * 1024 * 1024, onUploadProgress: e => setProgress(Math.round(e.percentage)) }); await data(await fetch(`/api/assets/${ticket.id}/complete`, { method: "POST" })); }
      await onUploaded(); onChange(ticket.id);
    } catch (error) { setMessage(error instanceof Error ? error.message : "อัปโหลดไม่สำเร็จ"); }
    finally { pending.current = false; setBusy(false); if (input.current) input.current.value = ""; }
  }
  const items = library.assets.filter(a => a.kind === kind && ((a.state === "ready" && Date.parse(a.expires_at) > asOf && (kind !== "video" || (a.metadata?.duration || 0) >= 6)) || a.id === value));
  return <div className="studio-asset-picker"><input ref={input} type="file" aria-label={kind === "image" ? "อัปโหลดภาพต้นฉบับ" : "อัปโหลดคลิป"} accept={Object.keys(FILE_TYPES).filter(type => type.startsWith(kind + "/")).join(",")} className="sr-only" disabled={busy || disabled || !library.storageAvailable} onChange={e => void add(e.target.files?.[0])} /><Button variant="secondary" fullWidth disabled={disabled || !library.storageAvailable} loading={busy} loadingLabel={progress === null ? "กำลังอัปโหลด…" : `อัปโหลด ${progress}%`} onClick={() => input.current?.click()}>＋ {kind === "image" ? "อัปโหลดภาพ" : "อัปโหลดคลิป"}</Button><label className="mt-4 block text-sm text-muted">{kind === "image" ? "ภาพจากคลัง" : "คลิปจากคลัง"}<select className="ui-field mt-2 w-full border p-3" value={value} disabled={disabled || busy} onChange={e => onChange(e.target.value)}><option value="">{kind === "image" ? "เลือกภาพต้นฉบับ" : "เลือกคลิป"}</option>{items.map(a => <option key={a.id} value={a.id}>{a.name}{a.state === "ready" ? "" : " · กำลังตรวจไฟล์"}</option>)}</select></label><p className="mt-2 text-xs text-muted">{kind === "image" ? "PNG, JPG, WebP" : "MP4, MOV, WebM"} · ไม่เกิน {bytesLabel(library.limits[kind])}</p>{!library.storageAvailable && <p className="mt-2 text-sm text-amber-200">พื้นที่อัปโหลดยังไม่พร้อม ใช้ไฟล์ที่มีในคลังได้</p>}{value && library.assets.some(a => a.id === value && (["rejected", "failed", "deleted", "deleting"].includes(a.state) || Date.parse(a.expires_at) <= asOf)) && <StatusMessage tone="error" className="mt-3">ไฟล์นี้ใช้ไม่ได้หรือหมดอายุแล้ว กรุณาเลือกไฟล์อื่น</StatusMessage>}{message && <StatusMessage tone="error" className="mt-3">{message}</StatusMessage>}</div>;
}
