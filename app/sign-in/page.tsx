"use client";

import { useState } from "react";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
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

      window.location.href = "/";
    } catch (error) {
      console.error(error);
      setMessage("เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050505] px-6 text-white">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl"
      >
        <p className="mb-2 text-sm font-medium text-purple-300">LAZY-AI.GAME</p>
        <h1 className="text-2xl font-black">เข้าสู่ระบบ</h1>

        <label className="mt-6 block">
          <span className="mb-2 block text-sm text-white/60">อีเมล</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none transition focus:border-white/40"
            required
          />
        </label>

        <label className="mt-4 block">
          <span className="mb-2 block text-sm text-white/60">รหัสผ่าน</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none transition focus:border-white/40"
            required
          />
        </label>

        {message && (
          <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-2xl bg-purple-400 px-5 py-4 font-bold text-black transition hover:bg-purple-300 disabled:opacity-60"
        >
          {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>

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
