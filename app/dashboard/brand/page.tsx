"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/app/components/ui/button";
import { TextField } from "@/app/components/ui/text-field";
import { StatusMessage } from "@/app/components/ui/status-message";
import { CONTACT_LABELS, EMPTY_BRAND, PAYMENT_METHODS, TONES, type BrandProfile, type BrandState } from "@/lib/brand/model";

export default function BrandPage() {
  const [saved, setSaved] = useState<BrandState | null>(null);
  const [profile, setProfile] = useState<BrandProfile>(EMPTY_BRAND);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; message: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const dirty = Boolean(saved && JSON.stringify(profile) !== JSON.stringify(saved.profile));

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const res = await fetch("/api/brand", { cache: "no-store", signal: controller.signal });
        const data = await res.json();
        if (res.status === 401) setUnauthorized(true);
        if (!res.ok) throw new Error(data.error || "โหลดข้อมูลร้านไม่สำเร็จ");
        setSaved(data); setProfile(data.profile);
      } catch (error) {
        if (!controller.signal.aborted) setFeedback({ tone: "error", message: error instanceof Error ? error.message : "โหลดข้อมูลร้านไม่สำเร็จ" });
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!dirty && !uploading) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, uploading]);

  function change<K extends keyof BrandProfile>(key: K, value: BrandProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
    setFeedback(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!saved || pending.current || conflict) return;
    pending.current = true; setSaving(true); setFeedback(null);
    try {
      const res = await fetch("/api/brand", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile, version: saved.version }) });
      const data = await res.json();
      if (res.status === 409) setConflict(true);
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setSaved(data); setProfile(data.profile);
      setFeedback({ tone: "success", message: "บันทึกข้อมูลร้านแล้ว ข้อมูลเวอร์ชันก่อนหน้ายังคงอยู่" });
    } catch (error) { setFeedback({ tone: "error", message: error instanceof Error ? error.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่" }); }
    finally { pending.current = false; setSaving(false); }
  }

  async function upload(file?: File) {
    if (!file || pending.current) return;
    if (file.size > 2 * 1024 * 1024) { setFeedback({ tone: "error", message: "โลโก้ต้องมีขนาดไม่เกิน 2 MB" }); return; }
    pending.current = true; setUploading(true); setFeedback(null);
    try {
      const res = await fetch("/api/brand/logo", { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: file });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "อัปโหลดไม่สำเร็จ");
      change("logoId", data.id);
      setFeedback({ tone: "success", message: "อัปโหลดโลโก้แล้ว กดบันทึกข้อมูลร้านเพื่อนำไปใช้" });
    } catch (error) { setFeedback({ tone: "error", message: error instanceof Error ? error.message : "อัปโหลดไม่สำเร็จ" }); }
    finally { pending.current = false; setUploading(false); if (uploadInput.current) uploadInput.current.value = ""; }
  }

  const complete = [Boolean(profile.shopName.trim()), Boolean(profile.logoId), Object.values(profile.contacts).some(Boolean), profile.paymentMethods.length > 0].filter(Boolean).length;
  const frozen = loading || saving || uploading || !saved;
  return (
    <main className="min-h-screen bg-[#08080e] px-5 py-8 text-white sm:px-8 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <nav aria-label="เส้นทางหน้า" className="mb-9 flex gap-3 text-sm text-white/55">
          <Link href="/dashboard" className="hover:text-white">บัญชีของฉัน</Link><span aria-hidden="true">/</span><span className="text-purple-200">ข้อมูลร้าน</span>
        </nav>
        <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div><p className="mb-3 text-xs font-bold tracking-[0.2em] text-purple-300">LAZY-AI.GAME / BRAND KIT</p>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">ให้ทุกชิ้นงานเป็นร้านของคุณ</h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-white/55">เริ่มจากชื่อร้าน แล้วค่อยเติมโลโก้และช่องทางติดต่อ ข้อมูลที่บันทึกจะเป็นแบรนด์กลางสำหรับโมดูลใหม่</p>
          </div>
          <span className="rounded-full border border-purple-300/20 bg-purple-300/5 px-4 py-2 text-xs text-purple-200">ตั้งค่าพื้นฐาน {complete}/4 ส่วน</span>
        </header>

        {loading ? <p role="status" className="rounded-3xl border border-white/10 p-8 text-white/60">กำลังโหลดข้อมูลร้าน...</p> : unauthorized ?
          <section className="rounded-3xl border border-white/10 p-8"><h2 className="text-xl font-bold">เข้าสู่ระบบเพื่อตั้งค่าร้าน</h2><p className="my-4 text-white/60">ข้อมูลแบรนด์จะเก็บแยกตามบัญชีของคุณ</p><Link className="inline-block rounded-xl bg-purple-400 px-5 py-3 font-bold text-black" href="/sign-in">เข้าสู่ระบบ</Link></section>
          : !saved ? <section className="space-y-4 rounded-3xl border border-white/10 p-8"><StatusMessage tone="error">{feedback?.message}</StatusMessage><Button variant="secondary" onClick={() => window.location.reload()}>ลองโหลดอีกครั้ง</Button></section>
          : <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
            <form ref={formRef} onSubmit={save} className="min-w-0 space-y-5">
              <fieldset disabled={frozen} className="space-y-5 disabled:opacity-65">
                <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-7">
                  <SectionTitle number="01" title="ตัวตนของร้าน" description="กรอกชื่อร้านก่อน ส่วนอื่นเติมภายหลังได้" />
                  <TextField label="ชื่อร้าน" value={profile.shopName} onChange={(e) => change("shopName", e.target.value)} required maxLength={100} placeholder="เช่น ร้านเติมเกมของคุณ" autoComplete="organization" />
                  <div className="mt-6 flex flex-wrap items-center gap-4">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-black/30">
                      {profile.logoId ? <Image src={`/api/brand/logo/${profile.logoId}`} alt="โลโก้ร้าน" width={80} height={80} unoptimized className="h-full w-full object-contain" /> : <span className="text-xs text-white/40">โลโก้</span>}
                    </div>
                    <div className="min-w-0 flex-1"><label htmlFor="brand-logo" className="mb-2 block text-sm font-medium">โลโก้ร้าน <span className="text-white/40">(ไม่บังคับ)</span></label>
                      <input ref={uploadInput} id="brand-logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void upload(e.target.files?.[0])} className="block w-full text-xs text-white/60 file:mr-3 file:rounded-lg file:border-0 file:bg-purple-300/15 file:px-3 file:py-2 file:text-purple-200" />
                      <p className="mt-2 text-xs text-white/40">PNG, JPG หรือ WebP ไม่เกิน 2 MB</p>
                      {uploading && <p role="status" className="mt-2 text-sm text-purple-200">กำลังอัปโหลด...</p>}
                      {profile.logoId && <button type="button" onClick={() => change("logoId", null)} className="mt-2 text-xs text-rose-300 underline">นำโลโก้ออกจากข้อมูลชุดนี้</button>}
                    </div>
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-4">{([['primaryColor', 'สีหลัก'], ['secondaryColor', 'สีรอง']] as const).map(([key, label]) =>
                    <label key={key} className="text-sm text-white/70">{label}<span className="mt-2 flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3"><input type="color" aria-label={label} value={profile[key]} onChange={(e) => change(key, e.target.value)} className="h-8 w-9 cursor-pointer bg-transparent" /><span className="text-xs uppercase text-white/60">{profile[key]}</span></span></label>)}
                  </div>
                </section>

                <details className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-7" open>
                  <summary className="cursor-pointer text-lg font-bold">02 · ช่องทางที่ลูกค้าติดต่อได้</summary>
                  <p className="mt-2 text-sm leading-6 text-white/45">ใส่เฉพาะช่องทางที่ร้านใช้งานจริง เว้นว่างได้</p>
                  <div className="mt-5 grid gap-5 sm:grid-cols-2">{(Object.entries(CONTACT_LABELS) as [keyof typeof CONTACT_LABELS, string][]).map(([key, label]) => <TextField key={key} label={label} value={profile.contacts[key]} type={key === "line" ? "text" : "url"} maxLength={500} placeholder={key === "line" ? "@yourshop" : "https://"} onChange={(e) => change("contacts", { ...profile.contacts, [key]: e.target.value })} />)}</div>
                </details>

                <details className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-7">
                  <summary className="cursor-pointer text-lg font-bold">03 · การชำระเงินและสไตล์ข้อความ</summary>
                  <p className="mt-3 text-sm text-white/50">เลือกเฉพาะวิธีที่ร้านรับชำระจริง</p>
                  <div className="my-5 grid gap-3 sm:grid-cols-2">{PAYMENT_METHODS.map((method) => <label key={method} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 p-3 text-sm"><input type="checkbox" checked={profile.paymentMethods.includes(method)} onChange={(e) => change("paymentMethods", e.target.checked ? [...profile.paymentMethods, method] : profile.paymentMethods.filter((v) => v !== method))} className="h-4 w-4 accent-purple-400" />{method}</label>)}</div>
                  <TextField label="ข้อความชวนลูกค้า" hint="ไม่บังคับ เช่น ทักมาสอบถามราคา" value={profile.defaultCta} onChange={(e) => change("defaultCta", e.target.value)} maxLength={100} />
                  <label className="mt-5 block text-sm text-white/70">รูปแบบภาษา<select value={profile.tone} onChange={(e) => change("tone", e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#101018] p-3">{TONES.map((tone) => <option key={tone}>{tone}</option>)}</select></label>
                </details>

                <details className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-7">
                  <summary className="cursor-pointer text-lg font-bold">04 · ข้อความเกี่ยวกับร้านที่คุณยืนยันได้</summary>
                  <p id="claims-help" className="mt-3 text-sm leading-6 text-white/50">ไม่บังคับ กรอกหนึ่งข้อต่อบรรทัด สูงสุด 5 ข้อ ข้อละ 120 ตัวอักษร เช่น เวลาให้บริการจริงของร้าน</p>
                  <label htmlFor="brand-claims" className="mt-4 block text-sm text-white/70">ข้อความของร้าน</label>
                  <textarea id="brand-claims" aria-describedby="claims-help" rows={4} maxLength={604} value={profile.trustStatements.join("\n")} onChange={(e) => { change("trustStatements", e.target.value.split("\n")); change("claimsConfirmed", false); }} className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 p-3 outline-none focus:border-purple-300" />
                  <label className="mt-4 flex items-start gap-3 text-sm leading-6 text-white/70"><input className="mt-1 h-4 w-4 shrink-0 accent-purple-400" type="checkbox" checked={profile.claimsConfirmed} onChange={(e) => change("claimsConfirmed", e.target.checked)} />ฉันยืนยันว่าข้อความข้างต้นเป็นข้อมูลจริงของร้าน และอนุญาตให้นำไปใช้ในชิ้นงาน</label>
                </details>
              </fieldset>
              <div className="sticky bottom-3 rounded-2xl border border-white/15 bg-[#15121f]/95 p-4 shadow-xl backdrop-blur">
                {feedback && <StatusMessage tone={feedback.tone} className="mb-3">{feedback.message}</StatusMessage>}
                {conflict && <p className="mb-3 text-sm text-amber-200">คัดลอกสิ่งที่ต้องการเก็บไว้ก่อน <button type="button" onClick={() => { if (window.confirm("โหลดข้อมูลล่าสุดและละทิ้งการแก้ไขที่ยังไม่บันทึก?")) window.location.reload(); }} className="underline">โหลดข้อมูลล่าสุด</button></p>}
                <div className="flex flex-wrap items-center justify-between gap-3"><p role="status" className="text-xs text-white/50">{dirty ? "มีการเปลี่ยนแปลงที่ยังไม่บันทึก" : saved.version ? `บันทึกแล้ว · เวอร์ชัน ${saved.version}` : "เริ่มต้นด้วยชื่อร้านได้เลย"}</p><Button type="submit" loading={saving} loadingLabel="กำลังบันทึก..." disabled={frozen || conflict || (!dirty && saved.version > 0)}>บันทึกข้อมูลร้าน</Button></div>
              </div>
            </form>

            <aside className="space-y-5 lg:sticky lg:top-8">
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#111119]">
                <div className="border-b border-white/10 px-6 py-4 text-xs tracking-wide text-white/50">ตัวอย่างข้อมูลแบรนด์</div>
                <div className="p-6"><div className="mb-6 h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${profile.primaryColor}, ${profile.secondaryColor})` }} />
                  {profile.logoId && <Image src={`/api/brand/logo/${profile.logoId}`} alt="ตัวอย่างโลโก้" width={64} height={64} unoptimized className="mb-4 h-16 w-16 rounded-xl object-contain" />}
                  <h2 className="break-words text-2xl font-black">{profile.shopName || "ชื่อร้านของคุณ"}</h2><p className="mt-2 text-sm text-white/40">{profile.tone}</p>
                  {profile.defaultCta && <p className="mt-6 break-words rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-center text-sm font-bold">{profile.defaultCta}</p>}
                  <dl className="mt-6 space-y-3 text-xs">{(Object.entries(CONTACT_LABELS) as [keyof typeof CONTACT_LABELS, string][]).filter(([key]) => profile.contacts[key]).map(([key, label]) => <div key={key}><dt className="text-white/40">{label}</dt><dd className="mt-1 break-all text-white/80">{profile.contacts[key]}</dd></div>)}</dl>
                  {profile.paymentMethods.length > 0 && <div className="mt-5 flex flex-wrap gap-2">{profile.paymentMethods.map((m) => <span key={m} className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/60">{m}</span>)}</div>}
                  {profile.claimsConfirmed && <ul className="mt-4 space-y-2 text-xs text-white/60">{profile.trustStatements.filter(Boolean).map((s, i) => <li key={i} className="break-words">✓ {s}</li>)}</ul>}
                </div>
              </div>
              <p className="px-2 text-xs leading-6 text-white/45">ตัวอย่างนี้แสดงข้อมูลที่คุณกำลังแก้ไข กดบันทึกเพื่อนำไปใช้ การแก้ข้อมูลร้านจะไม่เปลี่ยนชิ้นงานที่สร้างไว้ก่อนหน้า</p>
              <Link href="/" className="block rounded-2xl border border-white/10 p-4 text-center text-sm text-white/70 hover:bg-white/5">กลับไปสร้างภาพ →</Link>
            </aside>
          </div>}
      </div>
    </main>
  );
}

function SectionTitle({ number, title, description }: { number: string; title: string; description: string }) {
  return <div className="mb-6"><h2 className="text-lg font-bold"><span className="mr-2 text-purple-300">{number}</span>{title}</h2><p className="mt-2 text-sm leading-6 text-white/45">{description}</p></div>;
}
