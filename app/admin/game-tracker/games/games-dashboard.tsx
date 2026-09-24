"use client";

import Link from "next/link";
import Image, { type ImageLoader } from "next/image";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";

import type { GameContentGame } from "@/lib/game-content/types";

const passthroughImageLoader: ImageLoader = ({ src }) => src;

export function GameContentGames() {
  const [games, setGames] = useState<GameContentGame[]>([]);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const loadGames = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        "/api/game-tracker/games?includeInactive=1",
        { cache: "no-store" }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "โหลดเกมไม่สำเร็จ");
      setGames(data.games || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "โหลดเกมไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(loadGames, 0);
    return () => window.clearTimeout(timeout);
  }, [loadGames]);

  async function addGame(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    try {
      const response = await fetch("/api/game-tracker/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, name, iconUrl }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "เพิ่มเกมไม่สำเร็จ");
      setGames((current) => [...current, data.game]);
      setSlug("");
      setName("");
      setIconUrl("");
      setMessage("เพิ่มเกมแล้ว");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "เพิ่มเกมไม่สำเร็จ");
    }
  }

  async function toggleGame(game: GameContentGame) {
    const response = await fetch("/api/game-tracker/games", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: game.id, isActive: !game.isActive }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "แก้ไขเกมไม่สำเร็จ");
      return;
    }
    setGames((current) =>
      current.map((item) => (item.id === game.id ? data.game : item))
    );
  }

  async function removeGame(game: GameContentGame) {
    if (
      !window.confirm(
        `ลบ ${game.name} พร้อม Sources และกิจกรรมที่เกี่ยวข้องทั้งหมดหรือไม่?`
      )
    ) {
      return;
    }
    const response = await fetch(
      `/api/game-tracker/games?id=${encodeURIComponent(game.id)}`,
      { method: "DELETE" }
    );
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "ลบเกมไม่สำเร็จ");
      return;
    }
    setGames((current) => current.filter((item) => item.id !== game.id));
    setMessage(`ลบ ${game.name} แล้ว`);
  }

  return (
    <main className="min-h-screen bg-background px-4 py-7 text-white sm:px-6">
      <section className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-300">
              LAZY TOPUP · GAME CONTENT
            </p>
            <h1 className="mt-2 text-3xl font-semibold">รายชื่อเกม</h1>
            <p className="mt-2 text-sm text-muted">
              เปิด ปิด เพิ่ม หรือลบเกมได้โดยไม่แก้ source code
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
          onSubmit={addGame}
          className="mt-6 grid gap-3 rounded-2xl border border-purple-300/20 bg-purple-300/[0.05] p-4 md:grid-cols-[1fr_1.2fr_1.5fr_auto]"
        >
          <input
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            aria-label="slug เช่น delta-force"
            placeholder="slug เช่น delta-force"
            required
            className="min-h-11 rounded-xl border border-white/10 bg-background px-3 text-sm outline-none"
          />
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label="ชื่อเกม"
            placeholder="ชื่อเกม"
            required
            className="min-h-11 rounded-xl border border-white/10 bg-background px-3 text-sm outline-none"
          />
          <input
            value={iconUrl}
            onChange={(event) => setIconUrl(event.target.value)}
            aria-label="Icon HTTPS URL (ไม่บังคับ)"
            placeholder="Icon HTTPS URL (ไม่บังคับ)"
            type="url"
            className="min-h-11 rounded-xl border border-white/10 bg-background px-3 text-sm outline-none"
          />
          <button className="rounded-xl bg-purple-300 px-5 py-3 text-sm font-semibold text-[#06111f]">
            เพิ่มเกม
          </button>
        </form>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {loading ? (
            <p className="text-sm text-muted">กำลังโหลด...</p>
          ) : (
            games.map((game) => (
              <article
                key={game.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4"
              >
                <div>
                  <div className="flex items-center gap-3">
                    {game.iconUrl && (
                      <span className="relative h-10 w-10 overflow-hidden rounded-xl">
                        <Image
                          src={game.iconUrl}
                          alt=""
                          fill
                          sizes="40px"
                          className="object-cover"
                          {...(game.iconUrl.startsWith("https://")
                            ? {
                                loader: passthroughImageLoader,
                                unoptimized: true,
                              }
                            : {})}
                        />
                      </span>
                    )}
                    <span>
                      <span className="block font-semibold">{game.name}</span>
                      <span className="mt-1 block text-xs text-muted">
                        {game.slug}
                      </span>
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => toggleGame(game)}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                      game.isActive
                        ? "bg-emerald-300 text-[#06111f]"
                        : "bg-white/10 text-muted"
                    }`}
                  >
                    {game.isActive ? "เปิดอยู่" : "ปิดอยู่"}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeGame(game)}
                    className="rounded-lg border border-red-300/20 px-3 py-2 text-xs font-bold text-red-200"
                  >
                    ลบ
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
