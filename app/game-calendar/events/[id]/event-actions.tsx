"use client";

import { useState } from "react";

export function EventActions({
  officialSourceUrl,
  copyText,
}: {
  officialSourceUrl: string | null;
  copyText: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function copyInfo() {
    await navigator.clipboard.writeText(copyText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {officialSourceUrl ? (
        <a
          href={officialSourceUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-[#06101c] transition hover:bg-cyan-200"
        >
          เปิดประกาศต้นทาง ↗
        </a>
      ) : null}
      <button
        type="button"
        onClick={copyInfo}
        className="rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/30"
      >
        {copied ? "คัดลอกแล้ว" : "คัดลอกข้อมูล"}
      </button>
      <button
        type="button"
        onClick={copyLink}
        className="rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/30"
      >
        คัดลอกลิงก์
      </button>
    </div>
  );
}
