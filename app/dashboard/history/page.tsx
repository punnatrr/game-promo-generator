"use client";

import Image from "next/image";
import Link from "next/link";
import { PageHeader, Skeleton, EmptyState } from "@/app/components/ui/workspace";
import { StatusMessage } from "@/app/components/ui/status-message";
import { SelectField } from "@/app/components/ui/select-field";
import { useEffect, useState } from "react";
import { readHistory } from "@/app/lib/history-storage";

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
  localOnly?: boolean;
};

type HistoryState = {
  history: HistoryItem[];
  databaseConfigured: boolean;
  error?: string;
};

export default function GenerationHistoryPage() {
  const [state, setState] = useState<HistoryState | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("all");
  const [sort, setSort] = useState("newest");

  useEffect(() => {
    let active = true;

    const localHistory: HistoryItem[] = readHistory().map((item) => ({
      id: `local-${item.id}`,
      generationId: `local-${item.id}`,
      imageUrl: item.image,
      thumbnailUrl: null,
      action: "generate",
      model: "local browser",
      imageQuality: "-",
      aspectRatio: item.aspectRatio,
      createdAt: item.createdAt,
      expiresAt: "",
      localOnly: true,
    }));

    async function loadHistory() {
      try {
        const res = await fetch("/api/history/me");
        const data = await res.json();
        if (active) {
          const serverHistory: HistoryItem[] = res.ok ? data.history || [] : [];
          const serverImageUrls = new Set(
            serverHistory.map((item) => item.imageUrl)
          );
          const mergedHistory = [
            ...localHistory.filter((item) => !serverImageUrls.has(item.imageUrl)),
            ...serverHistory,
          ].sort(
            (first, second) =>
              new Date(second.createdAt).getTime() -
              new Date(first.createdAt).getTime()
          );

          setState({
            ...data,
            error: res.ok ? undefined : "โหลดประวัติในบัญชีไม่สำเร็จ กรุณาเข้าสู่ระบบหรือลองใหม่",
            history: mergedHistory,
          });
        }
      } catch (error) {
        console.error(error);
        if (active) {
          setState({
            history: localHistory,
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

  const visibleHistory = (state?.history || []).filter(item => actionFilter === "all" || item.action === actionFilter).toSorted((a,b) => (Date.parse(b.createdAt) - Date.parse(a.createdAt)) * (sort === "newest" ? 1 : -1));
  return (
    <main className="min-h-screen bg-background px-6 py-10 text-white">
      <section className="mx-auto max-w-6xl">
        <PageHeader title="ประวัติภาพ" description="ดูและดาวน์โหลดภาพที่สร้างไว้ อายุไฟล์ขึ้นอยู่กับแพ็กเกจของคุณ" action={<Link href="/" className="action-link">＋ สร้างภาพใหม่</Link>} />
        <div className="filter-toolbar"><SelectField label="ประเภทงาน" value={actionFilter} onValueChange={setActionFilter} options={[{ value: "all", label: "ทุกประเภท" }, { value: "generate", label: "สร้างภาพใหม่" }, { value: "refine", label: "แก้ไขภาพ" }]} /><SelectField label="เรียงตาม" value={sort} onValueChange={setSort} options={[{ value: "newest", label: "ใหม่ที่สุดก่อน" }, { value: "oldest", label: "เก่าที่สุดก่อน" }]} /></div>
        {state?.error && <StatusMessage tone="error" className="mb-5">โหลดประวัติในบัญชีไม่สำเร็จ ภาพที่เก็บในเบราว์เซอร์นี้ยังแสดงได้ <a className="underline" href="/sign-in">เข้าสู่ระบบ</a> หรือ <button onClick={() => window.location.reload()} className="underline">ลองโหลดอีกครั้ง</button></StatusMessage>}
        {loading ? (
          <Skeleton label="กำลังโหลดประวัติภาพ" />
        ) : !state?.history.length ? (
          <EmptyState title="ยังไม่มีภาพที่แสดงได้" description="เริ่มสร้างภาพแรก หรือเข้าสู่ระบบเพื่อดูผลงานที่บันทึกในบัญชี" href="/" action="สร้างภาพโปรโมชัน" />
        ) : visibleHistory.length === 0 ? (
          <EmptyState title="ไม่พบงานประเภทนี้" description="ลองแสดงทุกประเภทเพื่อดูภาพที่คุณเคยสร้าง" action="ล้างตัวกรอง" onAction={() => setActionFilter("all")} />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visibleHistory.map((item, index) => (
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
                    <Badge>{item.action === "generate" ? "สร้างใหม่" : "แก้ไขภาพ"}</Badge>
                    {item.localOnly && <Badge>บนอุปกรณ์นี้</Badge>}
                    <Badge>{item.aspectRatio}</Badge>
                    <Badge>{item.imageQuality}</Badge>
                  </div>

                  <dl className="mt-4 space-y-2 text-sm text-muted">
                    <Meta label="โมเดล" value={item.model} />
                    <Meta
                      label="สร้างเมื่อ"
                      value={formatThaiDateTime(item.createdAt)}
                    />
                    <Meta
                      label="เก็บถึง"
                      value={
                        item.localOnly
                          ? "เก็บในเบราว์เซอร์นี้"
                          : formatThaiDate(item.expiresAt)
                      }
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
      <dt className="text-muted">{label}</dt>
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
