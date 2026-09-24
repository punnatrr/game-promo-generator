"use client";

import { useRef, useState } from "react";
import { TextField } from "@/app/components/ui/text-field";
import { Button } from "@/app/components/ui/button";
import { StatusMessage } from "@/app/components/ui/status-message";

export default function SignUpPage() {
  const [displayName, setDisplayName] = useState("");
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
      const res = await fetch("/api/auth/sign-up", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ displayName, email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "สมัครสมาชิกไม่สำเร็จ");
        return;
      }

      window.location.href = "/";
    } catch (error) {
      console.error(error);
      setMessage("สมัครสมาชิกไม่สำเร็จ");
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
        <h1 className="text-2xl font-semibold">สมัครสมาชิก</h1>

        <p className="mt-2 text-sm text-muted">สร้างบัญชีเพื่อเก็บผลงานและเริ่มใช้งานสตูดิโอ</p>
        <div className="mt-6 space-y-5">
        <TextField label="ชื่อที่แสดง (ไม่บังคับ)" autoComplete="name" value={displayName} onChange={e => setDisplayName(e.target.value)} disabled={loading} placeholder="ชื่อที่ต้องการให้เรียก" />
        <TextField label="อีเมล" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={loading} placeholder="you@example.com" />
        <TextField label="รหัสผ่าน" type="password" autoComplete="new-password" minLength={8} hint="ใช้รหัสผ่านอย่างน้อย 8 ตัวอักษร" value={password} onChange={e => setPassword(e.target.value)} required disabled={loading} />
        </div>
        {message && (
          <StatusMessage tone="error" className="mt-4">{message}</StatusMessage>
        )}

        <Button type="submit" loading={loading} loadingLabel="กำลังสร้างบัญชี…" fullWidth className="mt-6">สร้างบัญชี</Button>

        <a
          href="/sign-in"
          className="mt-4 block text-center text-sm font-medium text-white/60 transition hover:text-white"
        >
          มีบัญชีแล้ว? เข้าสู่ระบบ
        </a>
      </form>
    </main>
  );
}
