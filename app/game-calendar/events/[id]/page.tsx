/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  CALENDAR_CATEGORY_LABELS_TH,
  CALENDAR_STATUS_LABELS_TH,
} from "@/lib/game-calendar/logic";
import { getPublicCalendarEvent } from "@/lib/game-calendar/repository";
import type { ScoreReason } from "@/lib/game-calendar/types";

import { EventActions } from "./event-actions";

type PageProps = {
  params: Promise<{ id: string }>;
};

const PRODUCTION_ORIGIN = "https://game-promo-generator-tuh8.vercel.app";

function formatDate(value: string | null) {
  if (!value) return "ยังไม่มีประกาศวันที่";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

function countdown(startDate: string | null, endDate: string | null) {
  const now = Date.now();
  const target = startDate && new Date(startDate).getTime() > now
    ? { label: "เริ่มใน", value: new Date(startDate).getTime() - now }
    : endDate && new Date(endDate).getTime() > now
      ? { label: "สิ้นสุดใน", value: new Date(endDate).getTime() - now }
      : null;
  if (!target) return "ไม่มีกำหนดเวลานับถอยหลัง";
  const days = Math.floor(target.value / 86_400_000);
  const hours = Math.floor((target.value % 86_400_000) / 3_600_000);
  return `${target.label} ${days} วัน ${hours} ชั่วโมง`;
}

function ScoreCard({
  title,
  value,
}: {
  title: string;
  value: ScoreReason;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-black text-slate-200">{title}</h2>
        <strong className="text-2xl font-black text-cyan-300">
          {value.score}
        </strong>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-cyan-300"
          style={{ width: `${Math.max(0, Math.min(100, value.score))}%` }}
        />
      </div>
      <ul className="mt-3 space-y-1 text-xs leading-5 text-slate-400">
        {value.reasons.map((reason) => (
          <li key={reason}>• {reason}</li>
        ))}
      </ul>
    </article>
  );
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const event = await getPublicCalendarEvent(id);
  if (!event) {
    return {
      title: "ไม่พบกิจกรรม | LAZY TOPUP",
      robots: { index: false, follow: false },
    };
  }
  const title = `${event.gameName}: ${event.titleTh} | LAZY TOPUP`;
  const description = event.summaryTh.slice(0, 160);
  return {
    title,
    description,
    alternates: { canonical: `/game-calendar/events/${event.id}` },
    openGraph: {
      type: "article",
      title,
      description,
      url: `/game-calendar/events/${event.id}`,
      images: event.officialImage ? [event.officialImage] : undefined,
    },
  };
}

export const dynamic = "force-dynamic";

export default async function GameCalendarEventPage({ params }: PageProps) {
  const { id } = await params;
  const event = await getPublicCalendarEvent(id);
  if (!event) notFound();

  const structuredData = event.startDate
    ? {
        "@context": "https://schema.org",
        "@type": "Event",
        name: `${event.gameName}: ${event.titleTh}`,
        description: event.summaryTh,
        startDate: event.startDate,
        ...(event.endDate ? { endDate: event.endDate } : {}),
        eventAttendanceMode:
          "https://schema.org/OnlineEventAttendanceMode",
        eventStatus: "https://schema.org/EventScheduled",
        url: `${PRODUCTION_ORIGIN}/game-calendar/events/${event.id}`,
        image: event.officialImage ? [event.officialImage] : undefined,
        organizer: {
          "@type": "Organization",
          name: event.gameName,
          url: event.officialSourceUrl || event.sourceUrls[0],
        },
      }
    : null;

  return (
    <main className="min-h-screen bg-[#06101c] text-white">
      {structuredData ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replaceAll("<", "\\u003c"),
          }}
        />
      ) : null}

      <header className="border-b border-white/10 bg-[#081827]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            href="/game-calendar"
            className="text-sm font-black text-cyan-200 hover:text-cyan-100"
          >
            ← ปฏิทินกิจกรรมเกม
          </Link>
          <span className="text-xs font-bold text-slate-500">
            เวลา Asia/Bangkok
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#091522]">
          {event.officialImage ? (
            <div className="relative aspect-[16/7] overflow-hidden bg-black/30">
              <img
                src={event.officialImage}
                alt={`ภาพประกาศ ${event.titleTh}`}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#091522] via-transparent to-transparent" />
            </div>
          ) : null}

          <div className="p-5 sm:p-8">
            <div className="flex flex-wrap items-center gap-2 text-xs font-black">
              <span className="rounded-full bg-cyan-300/15 px-3 py-1.5 text-cyan-100">
                {event.gameName}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-slate-300">
                {CALENDAR_CATEGORY_LABELS_TH[event.category]}
              </span>
              <span className="rounded-full bg-emerald-300/15 px-3 py-1.5 text-emerald-200">
                {CALENDAR_STATUS_LABELS_TH[event.status]}
              </span>
              {event.isOfficial ? (
                <span className="rounded-full bg-emerald-300 px-3 py-1.5 text-[#06101c]">
                  OFFICIAL
                </span>
              ) : null}
            </div>

            <h1 className="mt-5 max-w-4xl text-3xl font-black leading-tight sm:text-5xl">
              {event.titleTh}
            </h1>
            <p className="mt-4 max-w-4xl text-base leading-8 text-slate-300">
              {event.summaryTh}
            </p>

            {event.conflictWarning ? (
              <div className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">
                ⚠ {event.conflictWarning}
              </div>
            ) : null}

            <div className="mt-6">
              <EventActions
                officialSourceUrl={event.officialSourceUrl}
                copyText={[
                  `${event.gameName}: ${event.titleTh}`,
                  event.summaryTh,
                  `เริ่ม: ${formatDate(event.startDate)}`,
                  `สิ้นสุด: ${formatDate(event.endDate)}`,
                  `แหล่งข้อมูล: ${event.sourceUrls.join(", ")}`,
                ].join("\n")}
              />
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
              <h2 className="text-lg font-black">กำหนดการ</h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-bold text-slate-500">ประกาศ</dt>
                  <dd className="mt-1 text-sm font-bold">
                    {formatDate(event.announcementDate)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold text-slate-500">เริ่ม</dt>
                  <dd className="mt-1 text-sm font-bold">
                    {formatDate(event.startDate)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold text-slate-500">สิ้นสุด</dt>
                  <dd className="mt-1 text-sm font-bold">
                    {formatDate(event.endDate)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold text-slate-500">
                    ภูมิภาค / เซิร์ฟเวอร์
                  </dt>
                  <dd className="mt-1 text-sm font-bold">
                    {event.region} / {event.server}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-bold text-slate-500">Countdown</dt>
                  <dd className="mt-1 text-sm font-black text-cyan-200">
                    {countdown(event.startDate, event.endDate)}
                  </dd>
                </div>
              </dl>
              {!event.startDate ? (
                <p className="mt-5 rounded-xl bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">
                  ต้นทางยังไม่ประกาศวันเริ่ม ระบบจึงไม่สร้างวันที่คาดเดา
                </p>
              ) : null}
            </section>

            <section className="grid gap-3 md:grid-cols-3">
              <ScoreCard title="ความสำคัญ" value={event.importance} />
              <ScoreCard
                title="ความสนใจของ Community"
                value={event.communityInterest}
              />
              <ScoreCard
                title="โอกาสทำคอนเทนต์"
                value={event.contentOpportunity}
              />
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
              <h2 className="text-lg font-black">มุมคอนเทนต์ที่แนะนำ</h2>
              <ul className="mt-4 grid gap-2 text-sm leading-6 text-slate-300">
                {event.contentAngles.map((angle) => (
                  <li
                    key={angle}
                    className="rounded-xl border border-white/10 bg-white/[0.025] p-3"
                  >
                    {angle}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-5">
              <h2 className="text-lg font-black">แหล่งข้อมูล</h2>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                ความน่าเชื่อถือ {event.confidenceScore}/100 · ตรวจล่าสุด{" "}
                {formatDate(event.lastCheckedAt)}
              </p>
              <div className="mt-4 space-y-2">
                {event.sourceUrls.map((url, index) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="block break-all rounded-xl border border-white/10 p-3 text-xs font-bold leading-5 text-cyan-200 transition hover:border-cyan-300/40"
                  >
                    {index === 0 ? "แหล่งหลัก" : `แหล่งยืนยัน ${index + 1}`} ↗
                    <span className="mt-1 block font-normal text-slate-500">
                      {url}
                    </span>
                  </a>
                ))}
              </div>
            </section>

            {event.keywords.length ? (
              <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-5">
                <h2 className="text-sm font-black">คีย์เวิร์ด</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {event.keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-slate-300"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}
