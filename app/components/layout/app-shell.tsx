"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { NotificationBell } from "@/app/components/notifications/notification-bell";
export const CREATOR_ROUTES = ["/", "/dashboard/motion", "/dashboard/frame", "/dashboard/ads"];
type User = { email: string; displayName: string | null; role: string };
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const accountMenu = useRef<HTMLDetailsElement>(null);
  const isCreator = CREATOR_ROUTES.includes(pathname);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/me", { signal: controller.signal, cache: "no-store" }).then(r => r.ok ? r.json() : null).then(data => { if (!controller.signal.aborted) setUser(data?.user ?? null); }).catch(() => {});
    if (isCreator) { try { localStorage.setItem("lazyai:last-studio", pathname); } catch {} }
    if (accountMenu.current) accountMenu.current.open = false;
    return () => controller.abort();
  }, [pathname, isCreator]);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (accountMenu.current && !accountMenu.current.contains(event.target as Node)) accountMenu.current.open = false; };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && accountMenu.current?.open) { accountMenu.current.open = false; accountMenu.current.querySelector("summary")?.focus(); } };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, []);
  async function signOut() {
    if (signingOut) return;
    setSigningOut(true); setError("");
    try { const response = await fetch("/api/auth/sign-out", { method: "POST" }); if (!response.ok) throw new Error(); window.location.assign("/sign-in"); }
    catch { setError("ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง"); setSigningOut(false); }
  }
  if (pathname === "/sign-in" || pathname === "/sign-up") return <div className="auth-shell"><Link className="auth-back" href="/">← กลับสตูดิโอ</Link>{children}</div>;
  return <div className={isCreator ? "studio-app" : "management-app"}>
    <a className="skip-link" href="#workspace-content">ข้ามไปเนื้อหา</a>
    <header className="creator-topnav">
      <Link href="/" className="creator-brand"><Image src="/icon.png" alt="" width={40} height={40} className="creator-brand-icon" priority /> LAZY-AI.GAME</Link>
      <nav aria-label="เมนูหลัก" className="creator-mainnav"><Link href="/" aria-current={isCreator ? "page" : undefined}>สร้างงาน</Link><Link href="/dashboard/library" aria-current={pathname === "/dashboard/library" || pathname === "/dashboard/history" ? "page" : undefined}>คลังผลงาน</Link><Link href="/game-calendar" aria-current={pathname.startsWith("/game-calendar") ? "page" : undefined}>ปฏิทิน</Link><Link href="/dashboard/leads" aria-current={pathname.startsWith("/dashboard/leads") ? "page" : undefined}>Lead Radar</Link></nav>
      <div className="creator-account">{user && <NotificationBell />}<details ref={accountMenu} className="account-menu"><summary>บัญชี <span aria-hidden="true">⌄</span></summary><nav aria-label="บัญชีและการจัดการ">
        {user && <p>{user.displayName || user.email}</p>}<Link href="/dashboard">บัญชีและการใช้งาน</Link><Link href="/dashboard/brand">ข้อมูลร้าน</Link><Link href="/dashboard/history">ประวัติภาพ</Link><Link href="/pricing">แพ็กเกจ</Link><Link href="/checkout">การชำระเงิน</Link><Link href="/dashboard/support">ติดต่อทีมงาน VIP</Link>
        {user?.role === "admin" && <><hr /><Link href="/admin">จัดการระบบ</Link><Link href="/admin/payments">ตรวจการชำระเงิน</Link><Link href="/admin/support">กล่องข้อความ VIP</Link><Link href="/admin/game-calendar">ตรวจข่าวและกิจกรรม</Link></>}
        <hr />{user ? <button disabled={signingOut} onClick={signOut}>{signingOut ? "กำลังออกจากระบบ…" : "ออกจากระบบ"}</button> : <><Link href="/sign-in">เข้าสู่ระบบ</Link><Link href="/sign-up">สมัครสมาชิก</Link></>}{error && <p role="alert">{error}</p>}
      </nav></details></div>
    </header>
    <div id="workspace-content" tabIndex={-1} className="workspace-content">{!isCreator && <div className="management-back"><Link href="/">← กลับไปสร้างงาน</Link>{pathname.startsWith("/dashboard/library") || pathname.startsWith("/dashboard/history") ? <nav aria-label="คลังผลงาน"><Link href="/dashboard/library">ไฟล์และชุดงาน</Link><Link href="/dashboard/history">ประวัติภาพ</Link></nav> : null}</div>}{children}</div>
  </div>;
}
