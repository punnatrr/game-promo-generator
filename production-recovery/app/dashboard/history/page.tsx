"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type HistoryItem = {
  id: string;
  generationId: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  action: "generate" | "refine";
  model: string;
  imageQuality: string;
  aspectRatio: string;
  createdAt: string;
  expiresAt: string;
};

type HistoryState = {
  history: HistoryItem[];
  databaseConfigured: boolean;
  error?: string;
};

export default function GenerationHistoryPage() {
  const [state, setState] = useState<HistoryState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadHistory() {
      try {
        const res = await fetch("/api/history/me");
        const data = await res.json();
        if (active) setState(data);
      } catch (error) {
        console.error(error);
        if (active) {
          setState({
            history: [],
            databaseConfigured: true,
            error: "โหลดประวัติไม่สำเร็จ",
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadHistory();

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#050505] px-6 py-10 text-white">
      <section className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-3 text-sm font-medium text-purple-300">
              LAZY-AI.GAME Member
            </p>
            <h1 className="text-4xl font-black tracking-tight">
              ประวัติภาพที่เจน
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/45">
              เก็บรูปที่สร้างสำเร็จไว้ตามระยะเวลาของแพ็กเกจ เพื่อกลับมาดูหรือดาวน์โหลดซ้ำได้
            </p>
          </div>

          <a
            href="/dashboard"
            className="rounded-2xl border border-white/10 px-5 py-3 text-center font-bold text-white/70 transition hover:border-white/30 hover:text-white"
          >
            กลับ Dashboard
          </a>
        </div>

        {loading ? (
          <Notice title="กำลังโหลดประวัติ..." />
        ) : !state?.databaseConfigured ? (
          <Notice
            title="ยังไม่ได้เชื่อมต่อฐานข้อมูล"
            body="ตั้งค่า DATABASE_URL และรัน schema ก่อนใช้งานประวัติภาพบน server"
          />
        ) : state.error ? (
          <Notice title={state.error} body="ลองเข้าสู่ระบบใหม่ หรือกลับมาดูอีกครั้ง" />
        ) : state.history.length === 0 ? (
          <Notice
            title="ยังไม่มีประวัติภาพ"
            body="เมื่อสมาชิก generate หรือ refine ภาพสำเร็จ ระบบจะเก็บรูปไว้ที่หน้านี้"
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {state.history.map((item, index) => (
              <article
                key={item.id}
                className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]"
              >
                <div className="relative aspect-square bg-black">
                  <Image
                    src={item.thumbnailUrl || item.imageUrl}
                    alt={`Generated image ${index + 1}`}
                    fill
                    unoptimized
                    className="object-contain"
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  />
                </div>

                <div className="p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge>{item.action}</Badge>
                    <Badge>{item.aspectRatio}</Badge>
                    <Badge>{item.imageQuality}</Badge>
                  </div>

                  <dl className="mt-4 space-y-2 text-sm text-white/55">
                    <Meta label="Model" value={item.model} />
                    <Meta
                      label="สร้างเมื่อ"
                      value={formatThaiDateTime(item.createdAt)}
                    />
                    <Meta
                      label="เก็บถึง"
                      value={formatThaiDate(item.expiresAt)}
                    />
                  </dl>

                  <a
                    href={item.imageUrl}
                    download={`lazy-ai-game-${item.id}.png`}
                    className="mt-5 block rounded-2xl bg-purple-400 px-4 py-3 text-center font-bold text-black transition hover:bg-purple-300"
                  >
                    ดาวน์โหลด
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Notice({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
      <h2 className="text-xl font-bold">{title}</h2>
      {body && <p className="mt-2 text-sm text-white/50">{body}</p>}
    </div>
  );
}

function Badge({ children }: { children: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 font-bold text-white/65">
      {children}
    </span>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-white/35">{label}</dt>
      <dd className="truncate text-right font-medium text-white/70">{value}</dd>
    </div>
  );
}

function formatThaiDate(value: string) {
  return new Date(value).toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatThaiDateTime(value: string) {
  return new Date(value).toLocaleString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
