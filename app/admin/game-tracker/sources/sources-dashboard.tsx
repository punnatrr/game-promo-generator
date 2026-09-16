"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  SOURCE_TYPES,
  type GameContentGame,
  type GameContentSource,
  type SourceType,
} from "@/lib/game-content/types";

const SOURCE_LABELS: Record<SourceType, string> = {
  OFFICIAL_WEBSITE: "เว็บไซต์ทางการ",
  OFFICIAL_SOCIAL: "โซเชียลทางการ",
  IN_GAME: "ประกาศในเกม",
  APP_STORE: "App Store",
  OFFICIAL_COMMUNITY: "Community ทางการ",
  TRUSTED_MEDIA: "สื่อเกมที่เชื่อถือได้",
  COMMUNITY: "Community/Creator",
  DATAMINING: "Data Mining",
};

export function GameContentSources() {
  const [games, setGames] = useState<GameContentGame[]>([]);
  const [sources, setSources] = useState<GameContentSource[]>([]);
  const [gameId, setGameId] = useState("");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [sourceType, setSourceType] =
    useState<SourceType>("OFFICIAL_WEBSITE");
  const [credibility, setCredibility] = useState(100);
  const [language, setLanguage] = useState("th");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState("");
  const [message, setMessage] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [gamesResponse, sourcesResponse] = await Promise.all([
        fetch("/api/game-tracker/games?includeInactive=1", {
          cache: "no-store",
        }),
        fetch("/api/game-tracker/sources", { cache: "no-store" }),
      ]);
      const [gamesData, sourcesData] = await Promise.all([
        gamesResponse.json(),
        sourcesResponse.json(),
      ]);
      if (!gamesResponse.ok) throw new Error(gamesData.error || "โหลดเกมไม่สำเร็จ");
      if (!sourcesResponse.ok) {
        throw new Error(sourcesData.error || "โหลด Sources ไม่สำเร็จ");
      }
      setGames(gamesData.games || []);
      setSources(sourcesData.sources || []);
      setGameId((current) => current || gamesData.games?.[0]?.id || "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(loadData, 0);
    return () => window.clearTimeout(timeout);
  }, [loadData]);

  async function addSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/game-tracker/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          name,
          url,
          sourceType,
          credibilityScore: credibility,
          language,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "เพิ่ม Source ไม่สำเร็จ");
      setSources((current) => [data.source, ...current]);
      setName("");
      setUrl("");
      setMessage("เพิ่มแหล่งข้อมูลแล้ว");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "เพิ่ม Source ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function toggleSource(source: GameContentSource) {
    setMessage("");
    try {
      const response = await fetch(`/api/game-tracker/sources/${source.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !source.isActive }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "แก้ไขไม่สำเร็จ");
      setSources((current) =>
        current.map((item) => (item.id === source.id ? data.source : item))
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "แก้ไขไม่สำเร็จ");
    }
  }

  async function testSource(source: GameContentSource) {
    setTestingId(source.id);
    setMessage(`กำลังทดลองดึงข้อมูลจาก ${source.name}...`);
    try {
      const response = await fetch(
        `/api/game-tracker/sources/${source.id}/test`,
        { method: "POST" }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ทดสอบ Source ไม่สำเร็จ");
      setMessage(data.result.mode === "MANUAL_REVIEW"
        ? `แหล่งนี้ต้อง Manual Review: ${data.result.limitationNote || "ไม่มี public feed ที่ดึงได้อย่างเสถียร"}`
        : `ทดสอบสำเร็จ (${data.result.mode}): พบ ${data.result.itemCount} รายการ และจำแนกได้ ${data.result.classifiedCount} รายการ`
      );
      await loadData();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "ทดสอบ Source ไม่สำเร็จ"
      );
    } finally {
      setTestingId("");
    }
  }

  return (
    <main className="min-h-screen bg-[#07101d] px-4 py-7 text-white sm:px-6">
      <section className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
              LAZY TOPUP · GAME CONTENT
            </p>
            <h1 className="mt-2 text-3xl font-black">จัดการแหล่งข้อมูล</h1>
            <p className="mt-2 text-sm text-slate-400">
              ใช้ API, RSS หรือ Public Feed ก่อน scraping และไม่หลบระบบป้องกันเว็บไซต์
            </p>
          </div>
          <Link
            href="/admin#game-activity-review"
            className="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-slate-300"
          >
            ← กลับ Dashboard Admin
          </Link>
        </header>

        {message && (
          <p className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
            {message}
          </p>
        )}

        <form
          onSubmit={addSource}
          className="mt-6 rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.05] p-5"
        >
          <h2 className="text-xl font-black">เพิ่ม Source URL</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <FieldSelect
              label="เกม"
              value={gameId}
              onChange={setGameId}
              options={games.map((game) => ({
                value: game.id,
                label: game.name,
              }))}
            />
            <FieldInput
              label="ชื่อแหล่ง"
              value={name}
              onChange={setName}
              required
            />
            <div className="md:col-span-2">
              <FieldInput
                label="URL"
                value={url}
                onChange={setUrl}
                type="url"
                required
              />
            </div>
            <FieldSelect
              label="ประเภท"
              value={sourceType}
              onChange={(value) => setSourceType(value as SourceType)}
              options={SOURCE_TYPES.map((value) => ({
                value,
                label: SOURCE_LABELS[value],
              }))}
            />
            <div className="grid grid-cols-[1fr_90px] gap-2">
              <FieldInput
                label="ภาษา"
                value={language}
                onChange={setLanguage}
                required
              />
              <label>
                <span className="mb-1.5 block text-xs font-bold text-slate-400">
                  Trust
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={credibility}
                  onChange={(event) => setCredibility(Number(event.target.value))}
                  className="min-h-11 w-full rounded-xl border border-white/10 bg-[#07101d] px-3 text-sm outline-none"
                />
              </label>
            </div>
          </div>
          <button
            type="submit"
            disabled={saving || !gameId}
            className="mt-4 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-black text-[#06111f] disabled:opacity-40"
          >
            {saving ? "กำลังบันทึก..." : "เพิ่มแหล่งข้อมูล"}
          </button>
        </form>

        <section className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
          <div className="grid min-w-[950px] grid-cols-[1fr_1.2fr_1.7fr_0.7fr_0.8fr_0.8fr] border-b border-white/10 px-4 py-3 text-xs font-black uppercase text-slate-500">
            <span>Game</span>
            <span>Source</span>
            <span>URL</span>
            <span>Type</span>
            <span>Last checked</span>
            <span>Status</span>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[950px] divide-y divide-white/10">
              {loading ? (
                <p className="p-6 text-sm text-slate-400">กำลังโหลด...</p>
              ) : sources.length === 0 ? (
                <p className="p-10 text-center text-sm text-slate-400">
                  ยังไม่มี Source — เพิ่ม URL ทางการของเกมเพื่อเริ่มติดตาม
                </p>
              ) : (
                sources.map((source) => (
                  <article
                    key={source.id}
                    className="grid grid-cols-[1fr_1.2fr_1.7fr_0.7fr_0.8fr_0.8fr] items-center gap-4 px-4 py-4 text-sm"
                  >
                    <span className="font-bold">{source.gameName}</span>
                    <span>
                      <strong className="block">{source.name}</strong>
                      <small className="text-slate-500">
                        Trust {source.credibilityScore}/100 · {source.language}
                      </small>
                      <small
                        className={`mt-1 block w-fit rounded-full px-2 py-0.5 font-bold ${
                          source.automationMode === "ADAPTER"
                            ? "bg-emerald-400/10 text-emerald-300"
                            : source.automationMode === "MANUAL_REVIEW"
                              ? "bg-amber-400/10 text-amber-300"
                              : "bg-sky-400/10 text-sky-300"
                        }`}
                        title={source.limitationNote || undefined}
                      >
                        {source.automationMode === "ADAPTER"
                          ? `Adapter: ${source.adapterKey}`
                          : source.automationMode === "MANUAL_REVIEW"
                            ? source.sourceType === "OFFICIAL_SOCIAL"
                              ? "Indexed search + Quick import"
                              : "Manual Review"
                            : "Search Discovery"}
                      </small>
                    </span>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-cyan-300/75 underline underline-offset-4"
                    >
                      {source.url}
                    </a>
                    <span className="text-xs text-slate-400">
                      {SOURCE_LABELS[source.sourceType]}
                    </span>
                    <span className="text-xs text-slate-400">
                      {source.lastCheckedAt
                        ? new Intl.DateTimeFormat("th-TH", {
                            dateStyle: "short",
                            timeStyle: "short",
                            timeZone: "Asia/Bangkok",
                          }).format(new Date(source.lastCheckedAt))
                        : "ยังไม่เคยตรวจ"}
                    </span>
                    <span className="grid gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggleSource(source)}
                        className={`rounded-lg px-3 py-2 text-xs font-black ${
                          source.isActive
                            ? "bg-emerald-300 text-[#06111f]"
                            : "bg-white/10 text-slate-400"
                        }`}
                      >
                        {source.isActive ? "กำลังติดตาม" : "ปิดอยู่"}
                      </button>
                      <button
                        type="button"
                        disabled={testingId === source.id}
                        onClick={() => testSource(source)}
                        className="rounded-lg border border-cyan-300/25 px-3 py-2 text-xs font-black text-cyan-200 disabled:opacity-40"
                      >
                        {testingId === source.id ? "กำลังทดสอบ..." : "ทดสอบดึง"}
                      </button>
                    </span>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-bold text-slate-400">
        {label}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-xl border border-white/10 bg-[#07101d] px-3 text-sm outline-none focus:border-cyan-300"
      />
    </label>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-bold text-slate-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-xl border border-white/10 bg-[#07101d] px-3 text-sm outline-none focus:border-cyan-300"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
