"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import {
  ACTIVITY_TYPES,
  type ActivityType,
  type GameActivity,
  type GameContentGame,
  type GameContentSource,
} from "@/lib/game-content/types";

type BotRun = {
  id: string;
  runType: string;
  status: string;
  sourceCount: number;
  candidateCount: number;
  discoveredCount: number;
  duplicateCount: number;
  countingVersion: number;
  errorCount: number;
  startedAt: string;
  finishedAt: string | null;
};

type ActivityDates = {
  start: string;
  end: string;
};

function formatDate(value: string | null) {
  if (!value) return "ไม่ระบุ";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

function toDateTimeInput(value: string | null) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(value));
  const mapped = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );
  return `${mapped.year}-${mapped.month}-${mapped.day}T${mapped.hour}:${mapped.minute}`;
}

function fromBangkokDateTimeInput(value: string) {
  return new Date(`${value}:00+07:00`).toISOString();
}

export function GameActivityReviewPanel() {
  const [activities, setActivities] = useState<GameActivity[]>([]);
  const [games, setGames] = useState<GameContentGame[]>([]);
  const [sources, setSources] = useState<GameContentSource[]>([]);
  const [runs, setRuns] = useState<BotRun[]>([]);
  const [dates, setDates] = useState<Record<string, ActivityDates>>({});
  const [gameFilter, setGameFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState("");
  const [botWorking, setBotWorking] = useState(false);
  const [importWorking, setImportWorking] = useState(false);
  const [importGameId, setImportGameId] = useState("");
  const [importSourceId, setImportSourceId] = useState("");
  const [importPostUrl, setImportPostUrl] = useState("");
  const [importPostText, setImportPostText] = useState("");
  const [importActivityType, setImportActivityType] = useState("");
  const [importPublishedAt, setImportPublishedAt] = useState(() =>
    toDateTimeInput(new Date().toISOString())
  );
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [activitiesResponse, gamesResponse, sourcesResponse, runsResponse] =
        await Promise.all([
          fetch("/api/game-tracker/activities", { cache: "no-store" }),
          fetch("/api/game-tracker/games", { cache: "no-store" }),
          fetch("/api/game-tracker/sources", { cache: "no-store" }),
          fetch("/api/game-calendar/admin/bot-runs?limit=5", {
            cache: "no-store",
          }),
        ]);
      const [activitiesData, gamesData, sourcesData, runsData] = await Promise.all([
        activitiesResponse.json(),
        gamesResponse.json(),
        sourcesResponse.json(),
        runsResponse.json(),
      ]);
      if (!activitiesResponse.ok) {
        throw new Error(activitiesData.error || "โหลดกิจกรรมไม่สำเร็จ");
      }
      if (!gamesResponse.ok) {
        throw new Error(gamesData.error || "โหลดรายชื่อเกมไม่สำเร็จ");
      }
      if (!sourcesResponse.ok) {
        throw new Error(sourcesData.error || "โหลด Source ไม่สำเร็จ");
      }
      if (!runsResponse.ok) {
        throw new Error(runsData.error || "โหลดสถานะบอทไม่สำเร็จ");
      }
      const nextActivities: GameActivity[] = activitiesData.activities || [];
      const nextSources: GameContentSource[] = sourcesData.sources || [];
      setActivities(nextActivities);
      setGames(gamesData.games || []);
      setSources(nextSources);
      setRuns(runsData.runs || []);
      const firstOfficialSource = nextSources.find(
        (source) => source.sourceType === "OFFICIAL_SOCIAL"
      );
      setImportGameId((current) => current || firstOfficialSource?.gameId || "");
      setImportSourceId((current) => current || firstOfficialSource?.id || "");
      setDates((current) => {
        const next = { ...current };
        for (const activity of nextActivities) {
          next[activity.id] ||= {
            start: toDateTimeInput(
              activity.startDate || activity.expectedReleaseDate
            ),
            end: toDateTimeInput(activity.endDate),
          };
        }
        return next;
      });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "โหลดคิวกิจกรรมไม่สำเร็จ"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const pending = useMemo(
    () =>
      activities
        .filter((activity) =>
          ["DISCOVERED", "REVIEWING"].includes(activity.status)
        )
        .filter((activity) => !gameFilter || activity.gameId === gameFilter)
        .sort(
          (first, second) =>
            new Date(second.discoveredAt).getTime() -
            new Date(first.discoveredAt).getTime()
        ),
    [activities, gameFilter]
  );
  const approvedCount = activities.filter((activity) =>
    ["APPROVED", "PLANNED", "DESIGNING", "SCHEDULED", "PUBLISHED"].includes(
      activity.status
    )
  ).length;
  const calendarActivities = useMemo(
    () =>
      activities
        .filter((activity) =>
          ["APPROVED", "PLANNED", "DESIGNING", "SCHEDULED", "PUBLISHED"].includes(
            activity.status
          )
        )
        .filter((activity) => !gameFilter || activity.gameId === gameFilter)
        .sort((first, second) => {
          const firstDate = first.startDate || first.expectedReleaseDate;
          const secondDate = second.startDate || second.expectedReleaseDate;
          return (
            new Date(secondDate || 0).getTime() -
            new Date(firstDate || 0).getTime()
          );
        }),
    [activities, gameFilter]
  );
  const gameIcons = useMemo(
    () => new Map(games.map((game) => [game.id, game.iconUrl])),
    [games]
  );
  const officialSocialSources = useMemo(
    () =>
      sources.filter(
        (source) =>
          source.gameId === importGameId &&
          source.sourceType === "OFFICIAL_SOCIAL" &&
          source.isActive
      ),
    [importGameId, sources]
  );
  const latestRun = runs[0];

  function selectImportGame(nextGameId: string) {
    setImportGameId(nextGameId);
    setImportSourceId(
      sources.find(
        (source) =>
          source.gameId === nextGameId &&
          source.sourceType === "OFFICIAL_SOCIAL" &&
          source.isActive
      )?.id || ""
    );
  }

  async function importSocialPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setImportWorking(true);
    setMessage("");
    try {
      const response = await fetch("/api/game-calendar/admin/import-social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: importGameId,
          sourceId: importSourceId,
          postUrl: importPostUrl,
          postText: importPostText,
          publishedAt: fromBangkokDateTimeInput(importPublishedAt),
          activityType: importActivityType || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "นำเข้าโพสต์ไม่สำเร็จ");
      }
      setActivities((current) =>
        current.some((item) => item.id === data.activity.id)
          ? current.map((item) =>
              item.id === data.activity.id ? data.activity : item
            )
          : [data.activity, ...current]
      );
      setDates((current) => ({
        ...current,
        [data.activity.id]: {
          start: toDateTimeInput(
            data.activity.startDate || data.activity.expectedReleaseDate
          ),
          end: toDateTimeInput(data.activity.endDate),
        },
      }));
      setImportPostUrl("");
      setImportPostText("");
      setImportActivityType("");
      setImportPublishedAt(toDateTimeInput(new Date().toISOString()));
      setMessage(
        data.created
          ? `นำเข้า “${data.activity.title}” เข้าคิวรอตรวจสอบแล้ว`
          : `โพสต์ “${data.activity.title}” มีอยู่ในระบบแล้ว จึงไม่สร้างซ้ำ`
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "นำเข้าโพสต์ไม่สำเร็จ"
      );
    } finally {
      setImportWorking(false);
    }
  }

  async function runBot() {
    setBotWorking(true);
    setMessage("บอทกำลังค้นหากิจกรรมจาก Source ของทุกเกม...");
    try {
      const response = await fetch("/api/game-calendar/admin/refresh", {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "สั่งบอทไม่สำเร็จ");
      }
      setMessage(
        `ตรวจ ${data.sourceCount} Sources · พบ ${data.candidateCount} รายการ · ข่าวใหม่ ${data.discoveredCount} · ซ้ำ ${data.duplicateCount} · Manual Review ${data.manualReviewCount} · Error ${data.errorCount}`
      );
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "สั่งบอทไม่สำเร็จ"
      );
    } finally {
      setBotWorking(false);
    }
  }

  async function updateStatus(
    activity: GameActivity,
    status: "APPROVED" | "SKIPPED"
  ) {
    const activityDates = dates[activity.id] || { start: "", end: "" };
    if (status === "APPROVED" && !activityDates.start) {
      setMessage(
        `กรุณาระบุวันเริ่มกิจกรรม “${activity.title}” ก่อน APPROVED`
      );
      return;
    }
    setWorkingId(activity.id);
    setMessage("");
    try {
      const response = await fetch(
        `/api/game-tracker/activities/${activity.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            ...(status === "APPROVED"
              ? {
                  startDate: fromBangkokDateTimeInput(activityDates.start),
                  endDate: activityDates.end
                    ? fromBangkokDateTimeInput(activityDates.end)
                    : null,
                  note:
                    "อนุมัติผ่าน Dashboard Admin และกำหนดวันลงปฏิทินแล้ว",
                }
              : { note: "ไม่อนุมัติผ่าน Dashboard Admin" }),
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "อัปเดตกิจกรรมไม่สำเร็จ");
      }
      setActivities((current) =>
        current.map((item) =>
          item.id === activity.id ? data.activity : item
        )
      );
      setMessage(
        status === "APPROVED"
          ? `APPROVED แล้ว — กิจกรรมจะแสดงวันที่ ${formatDate(data.activity.startDate)}`
          : "นำรายการออกจากคิวแล้ว"
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "อัปเดตกิจกรรมไม่สำเร็จ"
      );
    } finally {
      setWorkingId("");
    }
  }

  async function deleteCalendarActivity(activity: GameActivity) {
    setWorkingId(activity.id);
    setMessage("");
    try {
      const response = await fetch(
        `/api/game-tracker/activities/${activity.id}`,
        { method: "DELETE" }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "ลบกิจกรรมไม่สำเร็จ");
      }
      setActivities((current) =>
        current.filter((item) => item.id !== activity.id)
      );
      setDates((current) => {
        const next = { ...current };
        delete next[activity.id];
        return next;
      });
      setConfirmDeleteId("");
      setMessage(`ลบ “${activity.title}” ออกจากปฏิทินแล้ว`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "ลบกิจกรรมไม่สำเร็จ"
      );
    } finally {
      setWorkingId("");
    }
  }

  return (
    <section
      id="game-activity-review"
      className="mb-6 rounded-xl border border-cyan-300/20 bg-[#07101d] p-5"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
            GAME ACTIVITY BOT · ทุกวัน 07:00 น.
          </p>
          <h2 className="mt-2 text-2xl font-black">กิจกรรมเกมรอ APPROVED</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-white/50">
            อ่านข่าวจากบอท ตรวจ Source และกำหนดวันเริ่มกิจกรรม
            เมื่อกด APPROVED รายการจะไปแสดงในวันที่กำหนดบนปฏิทินสาธารณะ
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={botWorking}
            onClick={() => void runBot()}
            className="rounded-lg bg-cyan-300 px-4 py-3 text-sm font-black text-black transition hover:bg-cyan-200 disabled:opacity-40"
          >
            {botWorking ? "บอทกำลังค้นหา..." : "ค้นหากิจกรรมตอนนี้"}
          </button>
          <Link
            href="/admin/game-tracker/sources"
            className="rounded-lg border border-white/15 px-4 py-3 text-sm font-bold text-white/70"
          >
            Sources
          </Link>
          <Link
            href="/admin/game-tracker/games"
            className="rounded-lg border border-white/15 px-4 py-3 text-sm font-bold text-white/70"
          >
            เกม
          </Link>
          <Link
            href="/game-calendar"
            className="rounded-lg border border-cyan-300/25 px-4 py-3 text-sm font-bold text-cyan-200"
          >
            ดูปฏิทิน
          </Link>
        </div>
      </div>

      <form
        onSubmit={importSocialPost}
        className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4"
      >
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-200">
              QUICK OFFICIAL SOCIAL IMPORT
            </p>
            <h3 className="mt-1 text-lg font-black">
              นำโพสต์กิจกรรมเข้า Dashboard ทันที
            </h3>
            <p className="mt-1 text-sm text-white/45">
              วางลิงก์และข้อความจากโพสต์ Official แล้วรายการจะเข้าคิวรอตรวจสอบทันที
              โดยไม่ต้องรอ Google index
            </p>
          </div>
          <span className="rounded-full bg-amber-300/10 px-3 py-1.5 text-xs font-bold text-amber-100">
            ระบบตรวจข้อมูลซ้ำเดิมยังทำงาน
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-1 text-xs font-bold text-white/55">
            เกม
            <select
              value={importGameId}
              onChange={(event) => selectImportGame(event.target.value)}
              required
              className="min-h-11 rounded-lg border border-white/10 bg-black/50 px-3 text-sm text-white outline-none focus:border-amber-300"
            >
              <option value="">เลือกเกม</option>
              {games.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold text-white/55">
            Source Official
            <select
              value={importSourceId}
              onChange={(event) => setImportSourceId(event.target.value)}
              required
              className="min-h-11 rounded-lg border border-white/10 bg-black/50 px-3 text-sm text-white outline-none focus:border-amber-300"
            >
              <option value="">เลือก Facebook / IG / TikTok / X</option>
              {officialSocialSources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold text-white/55">
            วันที่โพสต์
            <input
              type="datetime-local"
              value={importPublishedAt}
              onChange={(event) => setImportPublishedAt(event.target.value)}
              required
              className="min-h-11 rounded-lg border border-white/10 bg-black/50 px-3 text-sm text-white outline-none focus:border-amber-300"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold text-white/55">
            ประเภทกิจกรรม
            <select
              value={importActivityType}
              onChange={(event) => setImportActivityType(event.target.value)}
              className="min-h-11 rounded-lg border border-white/10 bg-black/50 px-3 text-sm text-white outline-none focus:border-amber-300"
            >
              <option value="">ตรวจประเภทอัตโนมัติ</option>
              {ACTIVITY_TYPES.map((activityType: ActivityType) => (
                <option key={activityType} value={activityType}>
                  {activityType}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-3 grid gap-1 text-xs font-bold text-white/55">
          ลิงก์โพสต์ Official
          <input
            type="url"
            value={importPostUrl}
            onChange={(event) => setImportPostUrl(event.target.value)}
            placeholder="https://www.facebook.com/.../posts/..."
            required
            className="min-h-11 rounded-lg border border-white/10 bg-black/50 px-3 text-sm text-white outline-none focus:border-amber-300"
          />
        </label>
        <label className="mt-3 grid gap-1 text-xs font-bold text-white/55">
          ข้อความโพสต์
          <textarea
            value={importPostText}
            onChange={(event) => setImportPostText(event.target.value)}
            placeholder="คัดลอกข้อความทั้งหมดจากโพสต์ Official มาวางที่นี่"
            required
            rows={4}
            className="rounded-lg border border-white/10 bg-black/50 px-3 py-3 text-sm leading-6 text-white outline-none focus:border-amber-300"
          />
        </label>
        <button
          type="submit"
          disabled={
            importWorking ||
            !importGameId ||
            !importSourceId ||
            !importPostUrl ||
            !importPostText ||
            !importPublishedAt
          }
          className="mt-3 rounded-lg bg-amber-300 px-5 py-3 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-35"
        >
          {importWorking ? "กำลังนำเข้า..." : "นำเข้าและส่งเข้าคิวตรวจสอบ"}
        </button>
      </form>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs text-white/45">รอตรวจสอบ</p>
          <p className="mt-1 text-3xl font-black text-amber-200">
            {activities.filter((item) =>
              ["DISCOVERED", "REVIEWING"].includes(item.status)
            ).length}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs text-white/45">เผยแพร่ในปฏิทิน</p>
          <p className="mt-1 text-3xl font-black text-emerald-200">
            {approvedCount}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs text-white/45">Bot ล่าสุด</p>
          <p className="mt-2 font-black">
            {latestRun?.status || "ยังไม่เคยทำงาน"}
          </p>
          <p className="mt-1 text-xs text-white/40">
            {latestRun ? formatDate(latestRun.finishedAt) : "-"}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs text-white/45">ผลรอบล่าสุด</p>
          <p className="mt-2 text-sm font-bold">
            {latestRun
              ? latestRun.countingVersion >= 2
                ? `${latestRun.sourceCount} Sources · พบ ${latestRun.candidateCount} · ใหม่ ${latestRun.discoveredCount} · ซ้ำ ${latestRun.duplicateCount} · ${latestRun.errorCount} Error`
                : `${latestRun.sourceCount} Sources · ${latestRun.discoveredCount} รายการ (รอบเดิมรวมข่าวซ้ำ) · ${latestRun.errorCount} Error`
              : "-"}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <select
          value={gameFilter}
          onChange={(event) => setGameFilter(event.target.value)}
          aria-label="กรองคิวตามเกม"
          className="min-h-11 rounded-lg border border-white/10 bg-black/40 px-4 text-sm text-white outline-none"
        >
          <option value="">ทุกเกม</option>
          {games.map((game) => (
            <option key={game.id} value={game.id}>
              {game.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-bold text-white/60"
        >
          รีเฟรชคิว
        </button>
      </div>

      {message && (
        <p
          aria-live="polite"
          className="mt-4 rounded-lg border border-cyan-300/15 bg-cyan-300/[0.08] p-3 text-sm text-cyan-100"
        >
          {message}
        </p>
      )}

      <div className="mt-4 grid gap-4">
        {loading ? (
          <p className="rounded-lg border border-white/10 p-5 text-sm text-white/45">
            กำลังโหลดกิจกรรม...
          </p>
        ) : pending.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/10 p-8 text-center text-sm text-white/45">
            ไม่มีรายการรอตรวจสอบในเกมที่เลือก
          </p>
        ) : (
          pending.map((activity) => {
            const activityDates = dates[activity.id] || {
              start: "",
              end: "",
            };
            const iconUrl = gameIcons.get(activity.gameId);
            const isGoogleRedirect = activity.sourceUrl.includes(
              "news.google.com"
            );
            return (
              <article
                key={activity.id}
                className="rounded-xl border border-white/10 bg-black/25 p-4"
              >
                <div className="flex flex-col gap-4 xl:flex-row">
                  <div className="flex min-w-0 flex-1 gap-3">
                    {iconUrl ? (
                      <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/10">
                        <Image
                          src={iconUrl}
                          alt=""
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      </span>
                    ) : null}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-cyan-300/10 px-2 py-1 text-xs font-black text-cyan-200">
                          {activity.gameName}
                        </span>
                        <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-white/55">
                          {activity.verificationStatus}
                        </span>
                        <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-white/55">
                          {activity.activityType}
                        </span>
                        {isGoogleRedirect && (
                          <span className="rounded-full bg-amber-300/10 px-2 py-1 text-xs font-bold text-amber-200">
                            ตรวจต้นทางก่อนอนุมัติ
                          </span>
                        )}
                      </div>
                      <h3 className="mt-3 text-base font-black leading-6">
                        {activity.title}
                      </h3>
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-white/50">
                        {activity.description || "ไม่มีรายละเอียดเพิ่มเติม"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/40">
                        <span>พบเมื่อ {formatDate(activity.discoveredAt)}</span>
                        <span>
                          ประกาศเมื่อ {formatDate(activity.sourcePublishedAt)}
                        </span>
                        <a
                          href={activity.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-cyan-300 underline underline-offset-4"
                        >
                          เปิด Source
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="grid shrink-0 gap-3 sm:grid-cols-2 xl:w-[520px]">
                    <label className="grid gap-1 text-xs font-bold text-white/55">
                      วันเริ่มกิจกรรม *
                      <input
                        type="datetime-local"
                        value={activityDates.start}
                        onChange={(event) =>
                          setDates((current) => ({
                            ...current,
                            [activity.id]: {
                              ...activityDates,
                              start: event.target.value,
                            },
                          }))
                        }
                        className="min-h-11 rounded-lg border border-white/10 bg-black/50 px-3 text-sm text-white outline-none focus:border-cyan-300"
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-bold text-white/55">
                      วันสิ้นสุด
                      <input
                        type="datetime-local"
                        value={activityDates.end}
                        onChange={(event) =>
                          setDates((current) => ({
                            ...current,
                            [activity.id]: {
                              ...activityDates,
                              end: event.target.value,
                            },
                          }))
                        }
                        className="min-h-11 rounded-lg border border-white/10 bg-black/50 px-3 text-sm text-white outline-none focus:border-cyan-300"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={
                        workingId === activity.id || !activityDates.start
                      }
                      onClick={() =>
                        void updateStatus(activity, "APPROVED")
                      }
                      className="rounded-lg bg-emerald-300 px-4 py-3 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      {workingId === activity.id
                        ? "กำลังบันทึก..."
                        : "APPROVED และลงปฏิทิน"}
                    </button>
                    <button
                      type="button"
                      disabled={workingId === activity.id}
                      onClick={() => void updateStatus(activity, "SKIPPED")}
                      className="rounded-lg border border-red-300/20 px-4 py-3 text-sm font-bold text-red-200 disabled:opacity-35"
                    >
                      ไม่อนุมัติ
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      <div className="mt-8 border-t border-white/10 pt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">
              PUBLISHED CALENDAR
            </p>
            <h3 className="mt-1 text-xl font-black">
              กิจกรรมที่อยู่ในปฏิทิน
            </h3>
            <p className="mt-1 text-sm text-white/45">
              การลบจะนำโพสต์ออกจากปฏิทินสาธารณะและลบข้อมูลกิจกรรมที่เกี่ยวข้อง
            </p>
          </div>
          <span className="rounded-full bg-emerald-300/10 px-3 py-1.5 text-sm font-black text-emerald-200">
            {calendarActivities.length} รายการ
          </span>
        </div>

        <div className="mt-4 grid gap-3">
          {loading ? (
            <p className="rounded-lg border border-white/10 p-5 text-sm text-white/45">
              กำลังโหลดกิจกรรมในปฏิทิน...
            </p>
          ) : calendarActivities.length === 0 ? (
            <p className="rounded-lg border border-dashed border-white/10 p-8 text-center text-sm text-white/45">
              ไม่มีกิจกรรมในปฏิทินสำหรับเกมที่เลือก
            </p>
          ) : (
            calendarActivities.map((activity) => {
              const iconUrl = gameIcons.get(activity.gameId);
              const isConfirming = confirmDeleteId === activity.id;
              const isWorking = workingId === activity.id;
              return (
                <article
                  key={activity.id}
                  className="flex flex-col gap-4 rounded-xl border border-white/10 bg-black/25 p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    {iconUrl ? (
                      <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-white/10">
                        <Image
                          src={iconUrl}
                          alt=""
                          fill
                          sizes="44px"
                          className="object-cover"
                        />
                      </span>
                    ) : null}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-cyan-300/10 px-2 py-1 text-xs font-black text-cyan-200">
                          {activity.gameName}
                        </span>
                        <span className="rounded-full bg-emerald-300/10 px-2 py-1 text-xs font-black text-emerald-200">
                          {activity.status}
                        </span>
                      </div>
                      <h4 className="mt-2 font-black leading-6">
                        {activity.title}
                      </h4>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/45">
                        <span>
                          เริ่ม {formatDate(
                            activity.startDate ||
                              activity.expectedReleaseDate
                          )}
                        </span>
                        {activity.endDate ? (
                          <span>สิ้นสุด {formatDate(activity.endDate)}</span>
                        ) : null}
                        <a
                          href={activity.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-cyan-300 underline underline-offset-4"
                        >
                          เปิด Source
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {isConfirming ? (
                      <>
                        <button
                          type="button"
                          disabled={isWorking}
                          onClick={() =>
                            void deleteCalendarActivity(activity)
                          }
                          className="rounded-lg bg-red-400 px-4 py-2.5 text-sm font-black text-black disabled:opacity-35"
                        >
                          {isWorking ? "กำลังลบ..." : "ยืนยันลบถาวร"}
                        </button>
                        <button
                          type="button"
                          disabled={isWorking}
                          onClick={() => setConfirmDeleteId("")}
                          className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-bold text-white/70 disabled:opacity-35"
                        >
                          ยกเลิก
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={Boolean(workingId)}
                        onClick={() => setConfirmDeleteId(activity.id)}
                        className="rounded-lg border border-red-300/25 px-4 py-2.5 text-sm font-bold text-red-200 disabled:opacity-35"
                      >
                        ลบออกจากปฏิทิน
                      </button>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
