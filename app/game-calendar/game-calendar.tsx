"use client";

import Image, { type ImageLoader } from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  CALENDAR_CATEGORY_LABELS_TH,
  CALENDAR_STATUS_LABELS_TH,
} from "@/lib/game-calendar/logic";
import {
  CALENDAR_CATEGORIES,
  CALENDAR_STATUSES,
  type CalendarEvent,
  type CalendarGame,
  type CalendarStatus,
  type CalendarView,
} from "@/lib/game-calendar/types";

type Summary = {
  newToday: number;
  new24Hours: number;
  startsWithin7Days: number;
  startsWithin30Days: number;
  endsWithin3Days: number;
  highOpportunity: number;
};

const EMPTY_SUMMARY: Summary = {
  newToday: 0,
  new24Hours: 0,
  startsWithin7Days: 0,
  startsWithin30Days: 0,
  endsWithin3Days: 0,
  highOpportunity: 0,
};

const VIEWS: Array<{ value: CalendarView; label: string }> = [
  { value: "month", label: "เดือน" },
  { value: "week", label: "สัปดาห์" },
  { value: "agenda", label: "Agenda" },
  { value: "list", label: "รายการ" },
  { value: "timeline", label: "Timeline" },
];

const passthroughLoader: ImageLoader = ({ src }) => src;

function bangkokDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dateFromKey(value: string) {
  return new Date(`${value}T12:00:00+07:00`);
}

function dateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDays(value: string, days: number) {
  const date = dateFromKey(value);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}

function addMonths(value: string, months: number) {
  const date = dateFromKey(value);
  date.setUTCMonth(date.getUTCMonth() + months);
  return dateKey(date);
}

function startOfWeek(value: string) {
  const date = dateFromKey(value);
  const weekday = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Bangkok",
      weekday: "short",
    })
      .format(date)
      .replace(
        /Sun|Mon|Tue|Wed|Thu|Fri|Sat/,
        (day) =>
          String(
            ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(day)
          )
      )
  );
  return addDays(value, -((weekday + 6) % 7));
}

function formatDate(value: string | null, options?: Intl.DateTimeFormatOptions) {
  if (!value) return "ยังไม่ประกาศวัน";
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    ...(options || { dateStyle: "medium" }),
  }).format(new Date(value));
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    month: "long",
    year: "numeric",
  }).format(dateFromKey(value));
}

function eventDateKey(event: CalendarEvent) {
  return (event.startDate || event.announcementDate || event.firstDetectedAt).slice(
    0,
    10
  );
}

function gameTone(slug: string) {
  const tones = [
    "border-purple-300/30 bg-purple-300/10 text-purple-100",
    "border-violet-300/30 bg-violet-300/10 text-violet-100",
    "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
    "border-amber-300/30 bg-amber-300/10 text-amber-100",
    "border-pink-300/30 bg-pink-300/10 text-pink-100",
  ];
  let hash = 0;
  for (const character of slug) hash += character.charCodeAt(0);
  return tones[hash % tones.length];
}

function StatusBadge({ status }: { status: CalendarStatus }) {
  const warning = ["UNCONFIRMED", "REVIEW", "POSTPONED"].includes(status);
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
        warning
          ? "bg-amber-300/15 text-amber-200"
          : "bg-purple-300/12 text-purple-100"
      }`}
    >
      {CALENDAR_STATUS_LABELS_TH[status]}
    </span>
  );
}

function GameIcon({
  event,
  size = 34,
}: {
  event: CalendarEvent;
  size?: number;
}) {
  return (
    <span
      className="relative shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/10"
      style={{ width: size, height: size }}
    >
      {event.gameIconUrl ? (
        <Image
          loader={passthroughLoader}
          unoptimized
          src={event.gameIconUrl}
          alt=""
          fill
          sizes={`${size}px`}
          className="object-cover"
        />
      ) : (
        <span className="grid h-full w-full place-items-center text-xs font-semibold">
          {event.gameName.slice(0, 1)}
        </span>
      )}
    </span>
  );
}

function EventLink({
  event,
  compact = false,
}: {
  event: CalendarEvent;
  compact?: boolean;
}) {
  return (
    <Link
      href={`/game-calendar/events/${event.id}`}
      className={`block rounded-xl border p-3 transition hover:-translate-y-0.5 hover:border-cyan-200/50 ${gameTone(
        event.gameSlug
      )}`}
    >
      <div className="flex gap-2.5">
        <GameIcon event={event} size={compact ? 28 : 38} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
              {event.gameName}
            </span>
            {event.isOfficial ? (
              <span className="rounded-full bg-emerald-300/15 px-2 py-0.5 text-[9px] font-semibold text-emerald-200">
                OFFICIAL
              </span>
            ) : null}
          </div>
          <p
            className={`mt-1 font-bold leading-snug text-white ${
              compact ? "line-clamp-1 text-xs" : "line-clamp-2 text-sm"
            }`}
          >
            {event.titleTh}
          </p>
          <p className="mt-1 text-[10px] font-bold text-current opacity-65">
            {formatDate(event.startDate)}
            {event.endDate ? ` – ${formatDate(event.endDate)}` : ""}
          </p>
          {compact ? null : (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-white/10 px-2 py-1 text-[9px] font-bold">
                {CALENDAR_CATEGORY_LABELS_TH[event.category]}
              </span>
              <StatusBadge status={event.status} />
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

function EmptyCalendar() {
  return (
    <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.025] px-6 py-16 text-center">
      <p className="text-4xl">◌</p>
      <h2 className="mt-4 text-xl font-semibold">ยังไม่มีกิจกรรมที่เผยแพร่</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">
        ระบบจะแสดงเฉพาะข้อมูลที่มี Source URL และผ่านการตรวจสอบจาก Admin
        ข่าวที่ยังไม่ยืนยันจะไม่ถูกแสดงเป็นข้อเท็จจริง
      </p>
    </div>
  );
}

function MonthView({
  anchor,
  events,
}: {
  anchor: string;
  events: CalendarEvent[];
}) {
  const first = `${anchor.slice(0, 7)}-01`;
  const gridStart = startOfWeek(first);
  const byDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = eventDateKey(event);
    byDay.set(key, [...(byDay.get(key) || []), event]);
  }
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[860px]">
        <div className="grid grid-cols-7 border-b border-white/10 text-center text-xs font-semibold text-muted">
          {["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."].map((day) => (
            <div key={day} className="py-3">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: 42 }, (_, index) => {
            const key = addDays(gridStart, index);
            const items = byDay.get(key) || [];
            const outside = key.slice(0, 7) !== anchor.slice(0, 7);
            const today = key === bangkokDate();
            return (
              <section
                key={key}
                className={`min-h-36 border-b border-r border-white/[0.07] p-2 ${
                  outside ? "bg-black/15 opacity-45" : "bg-white/[0.018]"
                }`}
              >
                <div
                  className={`mb-2 grid h-7 w-7 place-items-center rounded-full text-xs font-semibold ${
                    today ? "bg-purple-300 text-[#06101c]" : "text-muted"
                  }`}
                >
                  {Number(key.slice(-2))}
                </div>
                <div className="space-y-1.5">
                  {items.slice(0, 3).map((event) => (
                    <EventLink key={event.id} event={event} compact />
                  ))}
                  {items.length > 3 ? (
                    <p className="px-1 text-[10px] font-bold text-purple-200">
                      +{items.length - 3} กิจกรรม
                    </p>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WeekView({
  anchor,
  events,
}: {
  anchor: string;
  events: CalendarEvent[];
}) {
  const start = startOfWeek(anchor);
  return (
    <div className="grid gap-3 lg:grid-cols-7">
      {Array.from({ length: 7 }, (_, index) => {
        const key = addDays(start, index);
        const items = events.filter((event) => eventDateKey(event) === key);
        return (
          <section
            key={key}
            className="min-h-64 rounded-2xl border border-white/10 bg-white/[0.025] p-3"
          >
            <p className="text-xs font-semibold text-purple-200">
              {formatDate(`${key}T12:00:00+07:00`, {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </p>
            <div className="mt-3 space-y-2">
              {items.map((event) => (
                <EventLink key={event.id} event={event} compact />
              ))}
              {items.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted">
                  ไม่มีรายการ
                </p>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AgendaView({ events }: { events: CalendarEvent[] }) {
  const groups = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = eventDateKey(event);
    groups.set(key, [...(groups.get(key) || []), event]);
  }
  if (groups.size === 0) return <EmptyCalendar />;
  return (
    <div className="space-y-7">
      {Array.from(groups.entries()).map(([key, items]) => (
        <section key={key} className="grid gap-3 md:grid-cols-[180px_1fr]">
          <div>
            <p className="sticky top-4 text-sm font-semibold text-purple-200">
              {formatDate(`${key}T12:00:00+07:00`, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {items.map((event) => (
              <EventLink key={event.id} event={event} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ListView({ events }: { events: CalendarEvent[] }) {
  if (events.length === 0) return <EmptyCalendar />;
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {events.map((event) => (
        <EventLink key={event.id} event={event} />
      ))}
    </div>
  );
}

function TimelineView({ events }: { events: CalendarEvent[] }) {
  if (events.length === 0) return <EmptyCalendar />;
  return (
    <div className="relative space-y-4 before:absolute before:bottom-3 before:left-[17px] before:top-3 before:w-px before:bg-purple-300/25">
      {events.map((event) => (
        <div key={event.id} className="relative grid grid-cols-[36px_1fr] gap-4">
          <span className="z-10 mt-3 h-9 w-9 rounded-full border-4 border-[#07111e] bg-purple-300" />
          <div>
            <p className="mb-2 text-xs font-semibold text-muted">
              {formatDate(event.startDate || event.announcementDate)}
              {event.endDate ? ` – ${formatDate(event.endDate)}` : ""}
            </p>
            <EventLink event={event} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Metric({
  label,
  value,
  children,
}: {
  label: string;
  value: number;
  children?: ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <p className="text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs font-bold text-muted">{label}</p>
      {children}
    </article>
  );
}

export function GameCalendar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialView = searchParams.get("view");
  const [view, setView] = useState<CalendarView>(
    VIEWS.some((item) => item.value === initialView)
      ? (initialView as CalendarView)
      : "month"
  );
  const [anchor, setAnchor] = useState(
    searchParams.get("date") || bangkokDate()
  );
  const [games, setGames] = useState<CalendarGame[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [game, setGame] = useState(searchParams.get("game") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [region, setRegion] = useState(searchParams.get("region") || "");
  const [server, setServer] = useState(searchParams.get("server") || "");
  const [minImportance, setMinImportance] = useState(
    searchParams.get("minImportance") || ""
  );
  const [minOpportunity, setMinOpportunity] = useState(
    searchParams.get("minOpportunity") || ""
  );
  const [quickFilter, setQuickFilter] = useState(
    searchParams.get("quick") || ""
  );
  const [officialOnly, setOfficialOnly] = useState(
    searchParams.get("officialOnly") === "1"
  );
  const [communityTrend, setCommunityTrend] = useState(
    searchParams.get("communityTrend") === "1"
  );

  const updateUrl = useCallback(
    (next: Record<string, string | boolean>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value === "" || value === false) params.delete(key);
        else params.set(key, value === true ? "1" : value);
      }
      router.replace(`/game-calendar?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage("");
    const params = new URLSearchParams({
      limit: "100",
      sort: view === "list" ? "newest" : "start_asc",
    });
    if (game) params.set("game", game);
    if (category) params.set("category", category);
    if (status) params.set("status", status);
    if (region) params.set("region", region);
    if (server) params.set("server", server);
    if (minImportance) params.set("minImportance", minImportance);
    if (minOpportunity) params.set("minOpportunity", minOpportunity);
    if (officialOnly) params.set("officialOnly", "1");
    if (communityTrend) params.set("communityTrend", "1");
    if (query.trim()) params.set("q", query.trim());
    if (quickFilter === "today") {
      params.set("newToday", "1");
    } else if (quickFilter === "upcoming7") {
      params.set("upcomingDays", "7");
    } else if (quickFilter === "upcoming30") {
      params.set("upcomingDays", "30");
    } else if (quickFilter === "ending") {
      params.set("endingSoon", "1");
    } else if (quickFilter === "unconfirmed") {
      params.set("unconfirmed", "1");
    }

    try {
      const [eventsResponse, gamesResponse, summaryResponse] = await Promise.all([
        fetch(`/api/game-calendar/events?${params}`, { cache: "no-store" }),
        fetch("/api/game-calendar/games", { cache: "no-store" }),
        fetch("/api/game-calendar/summary", { cache: "no-store" }),
      ]);
      const [eventData, gameData, summaryData] = await Promise.all([
        eventsResponse.json(),
        gamesResponse.json(),
        summaryResponse.json(),
      ]);
      if (!eventsResponse.ok || !gamesResponse.ok || !summaryResponse.ok) {
        throw new Error("โหลดข้อมูลปฏิทินไม่สำเร็จ");
      }
      setEvents(eventData.items || []);
      setGames(gameData.games || []);
      setSummary(summaryData.summary || EMPTY_SUMMARY);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }, [
    category,
    communityTrend,
    game,
    minImportance,
    minOpportunity,
    officialOnly,
    query,
    quickFilter,
    region,
    server,
    status,
    view,
  ]);

  useEffect(() => {
    window.queueMicrotask(() => void loadData());
  }, [loadData]);

  const visibleEvents = useMemo(() => {
    if (view === "month") {
      return events.filter(
        (event) => eventDateKey(event).slice(0, 7) === anchor.slice(0, 7)
      );
    }
    if (view === "week") {
      const start = startOfWeek(anchor);
      const end = addDays(start, 6);
      return events.filter((event) => {
        const date = eventDateKey(event);
        return date >= start && date <= end;
      });
    }
    return events;
  }, [anchor, events, view]);

  function changeView(next: CalendarView) {
    setView(next);
    updateUrl({ view: next });
  }

  function move(direction: number) {
    const next =
      view === "month"
        ? addMonths(anchor, direction)
        : addDays(anchor, direction * 7);
    setAnchor(next);
    updateUrl({ date: next });
  }

  function resetToday() {
    const today = bangkokDate();
    setAnchor(today);
    updateUrl({ date: today });
  }

  return (
    <main className="min-h-screen bg-background text-white">
      <header className="border-b border-white/10 bg-surface/95">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-purple-300">
              LAZY-AI.GAME · วางแผนคอนเทนต์
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              ปฏิทินกิจกรรมเกม
            </h1>
            <p className="mt-1 text-sm text-muted">
              เวลาไทย · แสดงเฉพาะกิจกรรมที่ผ่านการตรวจสอบก่อนเผยแพร่
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-slate-300 hover:border-white/30"
            >
              ← หน้าหลัก
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Metric label="ข่าวใหม่วันนี้" value={summary.newToday} />
          <Metric label="ย้อนหลัง 24 ชั่วโมง" value={summary.new24Hours} />
          <Metric label="เริ่มใน 7 วัน" value={summary.startsWithin7Days} />
          <Metric label="เริ่มใน 30 วัน" value={summary.startsWithin30Days} />
          <Metric label="หมดใน 3 วัน" value={summary.endsWithin3Days} />
          <Metric label="โอกาสทำคอนเทนต์สูง" value={summary.highOpportunity} />
        </section>

        <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-3">
          <div className="grid gap-2 lg:grid-cols-[1.5fr_repeat(3,1fr)_auto]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onBlur={() => updateUrl({ q: query })}
              onKeyDown={(event) => {
                if (event.key === "Enter") updateUrl({ q: query });
              }}
              aria-label="ค้นหากิจกรรมเกม"
              placeholder="ค้นหากิจกรรม ตัวละคร สกิน หรือแพตช์"
              className="min-h-11 rounded-xl border border-white/10 bg-surface px-3 text-sm outline-none placeholder:text-muted focus:border-purple-300/50"
            />
            <select
              aria-label="กรองตามเกม"
              value={game}
              onChange={(event) => {
                setGame(event.target.value);
                updateUrl({ game: event.target.value });
              }}
              className="min-h-11 rounded-xl border border-white/10 bg-surface px-3 text-sm"
            >
              <option value="">ทุกเกม</option>
              {games.map((item) => (
                <option key={item.id} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              aria-label="กรองตามประเภทกิจกรรม"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                updateUrl({ category: event.target.value });
              }}
              className="min-h-11 rounded-xl border border-white/10 bg-surface px-3 text-sm"
            >
              <option value="">ทุกประเภท</option>
              {CALENDAR_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {CALENDAR_CATEGORY_LABELS_TH[item]}
                </option>
              ))}
            </select>
            <select
              aria-label="กรองตามสถานะ"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                updateUrl({ status: event.target.value });
              }}
              className="min-h-11 rounded-xl border border-white/10 bg-surface px-3 text-sm"
            >
              <option value="">ทุกสถานะ</option>
              {CALENDAR_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {CALENDAR_STATUS_LABELS_TH[item]}
                </option>
              ))}
            </select>
            <label className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-surface px-3 text-xs font-bold text-slate-300">
              <input
                type="checkbox"
                checked={officialOnly}
                onChange={(event) => {
                  setOfficialOnly(event.target.checked);
                  updateUrl({ officialOnly: event.target.checked });
                }}
                className="accent-cyan-300"
              />
              แหล่งทางการเท่านั้น
            </label>
          </div>
          <details className="mt-3 border-t border-white/10 pt-3">
            <summary className="cursor-pointer text-xs font-semibold text-purple-200">
              ตัวกรองเพิ่มเติม
            </summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <select
                aria-label="กรองตามภูมิภาค"
                value={region}
                onChange={(event) => {
                  setRegion(event.target.value);
                  updateUrl({ region: event.target.value });
                }}
                className="min-h-11 rounded-xl border border-white/10 bg-surface px-3 text-sm"
              >
                <option value="">ทุกภูมิภาค</option>
                {["TH", "SEA", "Global", "Japan", "Korea", "China"].map(
                  (item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  )
                )}
              </select>
              <select
                aria-label="กรองตามเซิร์ฟเวอร์"
                value={server}
                onChange={(event) => {
                  setServer(event.target.value);
                  updateUrl({ server: event.target.value });
                }}
                className="min-h-11 rounded-xl border border-white/10 bg-surface px-3 text-sm"
              >
                <option value="">ทุกเซิร์ฟเวอร์</option>
                {["ALL", "Global", "SEA", "Thailand", "Japan", "Korea", "China"].map(
                  (item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  )
                )}
              </select>
              <input
                type="number"
                min="0"
                max="100"
                value={minImportance}
                onChange={(event) => setMinImportance(event.target.value)}
                onBlur={() => updateUrl({ minImportance })}
                aria-label="ความสำคัญขั้นต่ำ 0–100" placeholder="ความสำคัญขั้นต่ำ 0–100"
                className="min-h-11 rounded-xl border border-white/10 bg-surface px-3 text-sm outline-none placeholder:text-muted"
              />
              <input
                type="number"
                min="0"
                max="100"
                value={minOpportunity}
                onChange={(event) => setMinOpportunity(event.target.value)}
                onBlur={() => updateUrl({ minOpportunity })}
                aria-label="โอกาสทำคอนเทนต์ขั้นต่ำ 0–100" placeholder="โอกาสทำคอนเทนต์ขั้นต่ำ 0–100"
                className="min-h-11 rounded-xl border border-white/10 bg-surface px-3 text-sm outline-none placeholder:text-muted"
              />
              <select
                aria-label="ตัวกรองช่วงเวลา"
                value={quickFilter}
                onChange={(event) => {
                  setQuickFilter(event.target.value);
                  updateUrl({ quick: event.target.value });
                }}
                className="min-h-11 rounded-xl border border-white/10 bg-surface px-3 text-sm"
              >
                <option value="">ทุกช่วงเวลา</option>
                <option value="today">ข่าวใหม่วันนี้</option>
                <option value="upcoming7">เริ่มภายใน 7 วัน</option>
                <option value="upcoming30">เริ่มภายใน 30 วัน</option>
                <option value="ending">กำลังจะหมดใน 3 วัน</option>
                <option value="unconfirmed">ยังไม่ได้รับการยืนยัน</option>
              </select>
              <label className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-surface px-3 text-xs font-bold text-slate-300">
                <input
                  type="checkbox"
                  checked={communityTrend}
                  onChange={(event) => {
                    setCommunityTrend(event.target.checked);
                    updateUrl({ communityTrend: event.target.checked });
                  }}
                  className="accent-cyan-300"
                />
                กระแสจากชุมชน
              </label>
              <button
                type="button"
                onClick={() => {
                  setRegion("");
                  setServer("");
                  setMinImportance("");
                  setMinOpportunity("");
                  setQuickFilter("");
                  setCommunityTrend(false);
                  updateUrl({
                    region: "",
                    server: "",
                    minImportance: "",
                    minOpportunity: "",
                    quick: "",
                    communityTrend: false,
                  });
                }}
                className="min-h-11 rounded-xl border border-white/10 px-3 text-xs font-semibold text-muted"
              >
                ล้างตัวกรองเพิ่มเติม
              </button>
            </div>
          </details>
        </section>

        <section className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-surface">
          <div className="flex flex-col gap-3 border-b border-white/10 p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-1">
              {VIEWS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={view === item.value}
                  onClick={() => changeView(item.value)}
                  className={`rounded-xl px-3.5 py-2.5 text-xs font-semibold ${
                    view === item.value
                      ? "bg-purple-300 text-[#06101c]"
                      : "text-muted hover:bg-white/[0.06]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => move(-1)}
                className="grid h-10 w-10 place-items-center rounded-xl border border-white/10"
                aria-label="ช่วงก่อนหน้า"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={resetToday}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold"
              >
                วันนี้
              </button>
              <button
                type="button"
                onClick={() => move(1)}
                className="grid h-10 w-10 place-items-center rounded-xl border border-white/10"
                aria-label="ช่วงถัดไป"
              >
                ›
              </button>
              <p className="ml-2 min-w-36 text-right text-sm font-semibold text-purple-100">
                {view === "month" ? formatMonth(anchor) : formatDate(anchor)}
              </p>
            </div>
          </div>

          {message ? (
            <div className="m-4 rounded-xl border border-red-300/20 bg-red-300/10 p-3 text-sm text-red-100">
              {message}
            </div>
          ) : null}

          <div className="p-3 sm:p-5">
            {loading ? (
              <div className="py-20 text-center text-sm text-muted">
                กำลังโหลดกิจกรรม...
              </div>
            ) : view === "month" ? (
              <MonthView anchor={anchor} events={visibleEvents} />
            ) : view === "week" ? (
              <WeekView anchor={anchor} events={visibleEvents} />
            ) : view === "agenda" ? (
              <AgendaView events={visibleEvents} />
            ) : view === "timeline" ? (
              <TimelineView events={visibleEvents} />
            ) : (
              <ListView events={visibleEvents} />
            )}
          </div>
        </section>

        <footer className="py-6 text-center text-xs text-muted">
          ตรวจสอบล่าสุดตามเวลาที่ระบุในแต่ละกิจกรรม · ทุกเวลาแสดงเป็น Asia/Bangkok
        </footer>
      </div>
    </main>
  );
}
