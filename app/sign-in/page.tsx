"use client";

import { useRef, useState } from "react";
import { TextField } from "@/app/components/ui/text-field";
import { Button } from "@/app/components/ui/button";
import { StatusMessage } from "@/app/components/ui/status-message";

export default function SignInPage() {
  const submitting = useRef(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "เข้าสู่ระบบไม่สำเร็จ");
        return;
      }

      const next = new URLSearchParams(window.location.search).get("next");
      let last = "/";
      try { const saved = localStorage.getItem("lazyai:last-studio"); if (saved && ["/", "/dashboard/motion", "/dashboard/frame", "/dashboard/ads"].includes(saved)) last = saved; } catch {}
      window.location.href = next?.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : last;
    } catch (error) {
      console.error(error);
      setMessage("เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-white">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl"
      >
        <p className="mb-2 text-sm font-medium text-purple-300">LAZY-AI.GAME</p>
        <h1 className="text-2xl font-semibold">เข้าสู่ระบบ</h1>

        <p className="mt-2 text-sm text-muted">กลับมาสร้างสื่อและจัดการงานของร้านคุณ</p>
        <div className="mt-6 space-y-5">

        <TextField label="อีเมล" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={loading} placeholder="you@example.com" />
        <TextField label="รหัสผ่าน" type="password" autoComplete="current-password"  value={password} onChange={e => setPassword(e.target.value)} required disabled={loading} />
        </div>
        {message && (
          <StatusMessage tone="error" className="mt-4">{message}</StatusMessage>
        )}

        <Button type="submit" loading={loading} loadingLabel="กำลังเข้าสู่ระบบ…" fullWidth className="mt-6">เข้าสู่ระบบ</Button>

        <a
          href="/sign-up"
          className="mt-4 block text-center text-sm font-medium text-white/60 transition hover:text-white"
        >
          ยังไม่มีบัญชี? สมัครสมาชิก
        </a>
      </form>
    </main>
  );
}
