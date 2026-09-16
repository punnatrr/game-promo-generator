"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { compressImage } from "@/app/lib/image-files";
import { NotificationBell } from "@/app/components/notifications/notification-bell";
import { GameActivityReviewPanel } from "./game-activity-review-panel";

type UserRole = "user" | "admin";

type AdminUser = {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  createdAt: string;
  subscription: {
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    planSlug: string;
    planName: string;
    priceMonthlyThb: number;
    monthlyImageLimit: number;
    usedImagesThisPeriod: number;
    remainingImages: number;
  } | null;
  paymentSummary: {
    totalPayments: number;
    paidPayments: number;
    pendingPayments: number;
    totalPaidThb: number;
  };
};

type DailyImageSlot = "image1" | "image2";
type AdminSection = "overview" | "users" | "daily-images" | "game-activity";

type AdminDailyImage = {
  id: string;
  gameName: string;
  gameTag: string;
  imageSlot: DailyImageSlot;
  imageUrl: string;
  isActive: boolean;
  createdAt: string;
};

const DAILY_IMAGE_SLOT_LABELS: Record<DailyImageSlot, string> = {
  image1: "ภาพที่ 1 / Background",
  image2: "ภาพที่ 2 / Price + item",
};

const ADMIN_SECTIONS: Array<{
  id: AdminSection;
  label: string;
  description: string;
  icon: string;
}> = [
  {
    id: "overview",
    label: "ภาพรวม",
    description: "สรุประบบ",
    icon: "⌂",
  },
  {
    id: "users",
    label: "ผู้ใช้งาน",
    description: "สมาชิกและสิทธิ์",
    icon: "◉",
  },
  {
    id: "daily-images",
    label: "รูปรายวัน",
    description: "คลังภาพ LAZYPRO",
    icon: "▣",
  },
  {
    id: "game-activity",
    label: "กิจกรรมเกม",
    description: "ตรวจสอบคอนเทนต์",
    icon: "✦",
  },
];

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Unable to read file"));
    reader.onerror = () => reject(reader.error || new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });
}

function formatDate(value: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function roleClassName(role: UserRole) {
  return role === "admin"
    ? "bg-emerald-300 text-black"
    : "bg-white/10 text-white/70";
}

export default function AdminDashboardPage() {
  const [activeSection, setActiveSection] =
    useState<AdminSection>("overview");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [actingUserId, setActingUserId] = useState<string | null>(null);
  const [dailyImages, setDailyImages] = useState<AdminDailyImage[]>([]);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [dailyUploading, setDailyUploading] = useState(false);
  const [dailyDeletingId, setDailyDeletingId] = useState<string | null>(null);
  const [dailyGameName, setDailyGameName] = useState("");
  const [dailyGameTag, setDailyGameTag] = useState("");
  const [dailyImageSlot, setDailyImageSlot] =
    useState<DailyImageSlot>("image1");
  const [dailyImageUrl, setDailyImageUrl] = useState("");
  const [dailyFileName, setDailyFileName] = useState("");

  const totals = useMemo(
    () => ({
      users: users.length,
      admins: users.filter((user) => user.role === "admin").length,
      activeSubscriptions: users.filter(
        (user) => user.subscription?.status === "active"
      ).length,
      paidThb: users.reduce(
        (sum, user) => sum + user.paymentSummary.totalPaidThb,
        0
      ),
      pendingPayments: users.reduce(
        (sum, user) => sum + user.paymentSummary.pendingPayments,
        0
      ),
    }),
    [users]
  );

  async function loadUsers(nextSearch = search) {
    setLoading(true);
    setMessage("");

    try {
      const params = new URLSearchParams();
      if (nextSearch.trim()) params.set("search", nextSearch.trim());

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setUsers([]);
        setMessage(data.error || "Unable to load users");
        return;
      }

      setUsers(data.users || []);
    } catch (error) {
      console.error(error);
      setMessage("Unable to load users");
    } finally {
      setLoading(false);
    }
  }

  async function loadDailyImages() {
    setDailyLoading(true);

    try {
      const res = await fetch("/api/admin/daily-images");
      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Unable to load daily images");
        return;
      }

      setDailyImages(data.images || []);
    } catch (error) {
      console.error(error);
      setMessage("Unable to load daily images");
    } finally {
      setDailyLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function loadInitialUsers() {
      try {
        const res = await fetch("/api/admin/users");
        const data = await res.json();

        if (!active) return;

        if (!res.ok) {
          setUsers([]);
          setMessage(data.error || "Unable to load users");
          return;
        }

        setUsers(data.users || []);
      } catch (error) {
        console.error(error);
        if (active) setMessage("Unable to load users");
      } finally {
        if (active) setLoading(false);
      }
    }

    async function loadInitialDailyImages() {
      try {
        const res = await fetch("/api/admin/daily-images");
        const data = await res.json();

        if (!active) return;

        if (!res.ok) {
          setMessage(data.error || "Unable to load daily images");
          return;
        }

        setDailyImages(data.images || []);
      } catch (error) {
        console.error(error);
        if (active) setMessage("Unable to load daily images");
      } finally {
        if (active) setDailyLoading(false);
      }
    }

    loadInitialUsers();
    loadInitialDailyImages();

    return () => {
      active = false;
    };
  }, []);

  async function updateRole(userId: string, role: UserRole) {
    setActingUserId(userId);
    setMessage("");

    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Unable to update role");
        return;
      }

      setUsers((currentUsers) =>
        currentUsers.map((user) =>
          user.id === userId ? { ...user, role: data.user.role } : user
        )
      );
      setMessage("Role updated");
    } catch (error) {
      console.error(error);
      setMessage("Unable to update role");
    } finally {
      setActingUserId(null);
    }
  }

  async function handleDailyImageFile(file?: File) {
    setMessage("");

    if (!file) {
      setDailyImageUrl("");
      setDailyFileName("");
      return;
    }

    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      setMessage("Daily image must be PNG, JPG, or WEBP");
      return;
    }

    try {
      const compressed = await compressImage(file, 1024);
      const dataUrl = await fileToDataUrl(compressed);

      setDailyImageUrl(dataUrl);
      setDailyFileName(file.name);
    } catch (error) {
      console.error(error);
      setMessage("Unable to prepare daily image");
    }
  }

  async function uploadDailyImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!dailyGameName.trim() || !dailyImageUrl) {
      setMessage("Please enter an image name and choose an image");
      return;
    }

    setDailyUploading(true);

    try {
      const res = await fetch("/api/admin/daily-images", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gameName: dailyGameName.trim(),
          gameTag: dailyGameTag.trim(),
          imageSlot: dailyImageSlot,
          imageUrl: dailyImageUrl,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Unable to upload daily image");
        return;
      }

      setDailyImages((currentImages) => [data.image, ...currentImages]);
      setDailyImageUrl("");
      setDailyFileName("");
      setDailyGameTag("");
      setMessage("Daily image uploaded");
    } catch (error) {
      console.error(error);
      setMessage("Unable to upload daily image");
    } finally {
      setDailyUploading(false);
    }
  }

  async function deleteDailyImage(id: string) {
    setDailyDeletingId(id);
    setMessage("");

    try {
      const res = await fetch(`/api/admin/daily-images?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Unable to delete daily image");
        return;
      }

      if (data.deleted) {
        setDailyImages((currentImages) =>
          currentImages.filter((image) => image.id !== id)
        );
      }
    } catch (error) {
      console.error(error);
      setMessage("Unable to delete daily image");
    } finally {
      setDailyDeletingId(null);
    }
  }

  const activeSectionMeta =
    ADMIN_SECTIONS.find((section) => section.id === activeSection) ||
    ADMIN_SECTIONS[0];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070710] text-white lg:h-screen">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.07),transparent_30%)]"
      />

      <div className="relative mx-auto grid min-h-screen max-w-[1680px] lg:h-screen lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-b border-white/[0.08] bg-[#0b0b17]/95 p-4 backdrop-blur-xl lg:flex lg:min-h-0 lg:flex-col lg:border-b-0 lg:border-r lg:p-5">
          <Link
            href="/"
            className="mb-5 flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-white/[0.04]"
          >
            <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-purple-300/25 bg-black">
              <Image
                src="/lazy-ai-logo.png"
                alt=""
                fill
                sizes="44px"
                className="scale-[1.4] object-cover"
              />
            </span>
            <span>
              <span className="block text-sm font-black tracking-[0.08em]">
                LAZY-AI.GAME
              </span>
              <span className="mt-0.5 block text-xs text-white/35">
                Admin workspace
              </span>
            </span>
          </Link>

          <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-white/25">
            เมนูจัดการ
          </p>
          <nav
            aria-label="หมวดหมู่ Admin Dashboard"
            className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1"
          >
            {ADMIN_SECTIONS.map((section) => {
              const active = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  aria-current={active ? "page" : undefined}
                  className={`group flex min-w-0 items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                    active
                      ? "border-purple-300/30 bg-purple-400/15 text-white shadow-[0_12px_30px_rgba(109,40,217,0.12)]"
                      : "border-transparent text-white/55 hover:border-white/[0.07] hover:bg-white/[0.035] hover:text-white"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base font-black ${
                      active
                        ? "bg-purple-300 text-[#12061d]"
                        : "bg-white/[0.06] text-white/45 group-hover:text-white"
                    }`}
                    aria-hidden="true"
                  >
                    {section.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">
                      {section.label}
                    </span>
                    <span className="mt-0.5 hidden truncate text-xs text-white/30 lg:block">
                      {section.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/[0.07] pt-4 lg:mt-auto lg:grid-cols-1">
            <Link
              href="/admin/payments"
              className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2.5 text-center text-xs font-bold text-white/55 transition hover:border-purple-300/30 hover:text-white lg:text-left"
            >
              ตรวจสอบ Payments
            </Link>
            <Link
              href="/admin/support"
              className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2.5 text-center text-xs font-bold text-white/55 transition hover:border-purple-300/30 hover:text-white lg:text-left"
            >
              VIP Support Inbox
            </Link>
          </div>
        </aside>

        <section className="flex min-w-0 flex-col lg:min-h-0">
          <header className="flex min-h-[82px] items-center justify-between gap-4 border-b border-white/[0.07] bg-[#090913]/75 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-purple-300/65">
                Admin Dashboard
              </p>
              <h1 className="mt-1 truncate text-xl font-black sm:text-2xl">
                {activeSectionMeta.label}
              </h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <NotificationBell />
              <Link
                href="/"
                className="hidden rounded-xl border border-white/10 px-4 py-2.5 text-xs font-bold text-white/55 transition hover:border-white/25 hover:text-white sm:block"
              >
                กลับหน้าเว็บไซต์
              </Link>
            </div>
          </header>

          <div
            key={activeSection}
            className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7"
          >
            {message && (
              <div className="mb-4 flex items-center justify-between gap-4 rounded-2xl border border-amber-300/20 bg-amber-300/[0.08] px-4 py-3 text-sm text-amber-100">
                <span>{message}</span>
                <button
                  type="button"
                  onClick={() => setMessage("")}
                  className="shrink-0 text-xs font-bold text-amber-100/55 hover:text-amber-100"
                >
                  ปิด
                </button>
              </div>
            )}

            {activeSection === "overview" && (
              <div className="mx-auto max-w-7xl space-y-5">
                <section className="overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.035] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-purple-300">
                        ภาพรวมระบบวันนี้
                      </p>
                      <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                        จัดการทุกส่วนได้จากหน้าเดียว
                      </h2>
                      <p className="mt-2 text-sm text-white/40">
                        เลือกหมวดจากเมนูด้านซ้ายเพื่อทำงาน โดยไม่ต้องเลื่อนหาส่วนต่าง ๆ
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        loadUsers();
                        loadDailyImages();
                      }}
                      className="rounded-xl bg-purple-300 px-4 py-3 text-sm font-black text-[#13091c] transition hover:bg-purple-200"
                    >
                      รีเฟรชข้อมูล
                    </button>
                  </div>
                </section>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    ["ผู้ใช้งาน", totals.users, "บัญชีทั้งหมด", "text-purple-200"],
                    ["ผู้ดูแล", totals.admins, "บัญชี Admin", "text-cyan-200"],
                    [
                      "สมาชิก Active",
                      totals.activeSubscriptions,
                      "แพ็กเกจที่ใช้งานอยู่",
                      "text-emerald-200",
                    ],
                    [
                      "รายรับสะสม",
                      `฿${totals.paidThb.toLocaleString("th-TH")}`,
                      `${totals.pendingPayments} รายการรอตรวจ`,
                      "text-amber-200",
                    ],
                  ].map(([label, value, description, color]) => (
                    <article
                      key={label}
                      className="rounded-2xl border border-white/[0.08] bg-[#0d0d1a]/85 p-5"
                    >
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/35">
                        {label}
                      </p>
                      <p className={`mt-3 text-3xl font-black ${color}`}>
                        {value}
                      </p>
                      <p className="mt-2 text-xs text-white/35">{description}</p>
                    </article>
                  ))}
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                  <section className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-black">หมวดจัดการ</h2>
                        <p className="mt-1 text-xs text-white/35">
                          เลือกงานที่ต้องการดำเนินการ
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {ADMIN_SECTIONS.filter(
                        (section) => section.id !== "overview"
                      ).map((section) => (
                        <button
                          key={section.id}
                          type="button"
                          onClick={() => setActiveSection(section.id)}
                          className="rounded-2xl border border-white/[0.08] bg-black/20 p-4 text-left transition hover:-translate-y-0.5 hover:border-purple-300/30 hover:bg-purple-400/[0.06]"
                        >
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-400/10 font-black text-purple-200">
                            {section.icon}
                          </span>
                          <span className="mt-4 block font-black">
                            {section.label}
                          </span>
                          <span className="mt-1 block text-xs text-white/35">
                            {section.description}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5">
                    <h2 className="text-lg font-black">ทางลัด</h2>
                    <div className="mt-4 space-y-2">
                      {[
                        ["ตรวจหลักฐานชำระเงิน", "/admin/payments"],
                        ["ตอบ VIP Support", "/admin/support"],
                        ["ปฏิทินกิจกรรมเกม", "/admin/game-calendar"],
                        ["จัดการ Game Tracker", "/admin/game-tracker"],
                      ].map(([label, href]) => (
                        <Link
                          key={href}
                          href={href}
                          className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3 text-sm font-bold text-white/60 transition hover:border-purple-300/25 hover:text-white"
                        >
                          {label}
                          <span aria-hidden="true">→</span>
                        </Link>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            )}

            {activeSection === "daily-images" && (
              <div className="mx-auto grid max-w-7xl gap-4 lg:h-full lg:min-h-[580px] lg:grid-cols-[360px_minmax(0,1fr)]">
                <section className="rounded-3xl border border-purple-300/20 bg-purple-400/[0.055] p-5 lg:overflow-y-auto">
                  <div className="mb-5">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-purple-200">
                      ♛ LAZYPRO
                    </p>
                    <h2 className="mt-2 text-xl font-black">อัปโหลดรูปรายวัน</h2>
                    <p className="mt-1 text-sm leading-6 text-white/40">
                      เพิ่มภาพตัวอย่างสำหรับสมาชิกแพ็กเกจ 499/999
                    </p>
                  </div>

                  <form onSubmit={uploadDailyImage} className="space-y-3">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-bold text-white/45">
                        ชื่อรูป
                      </span>
                      <input
                        value={dailyGameName}
                        onChange={(event) => setDailyGameName(event.target.value)}
                        placeholder="เช่น The Aeris Bundle"
                        maxLength={80}
                        className="min-h-11 w-full rounded-xl border border-white/10 bg-black/35 px-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-purple-300"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-bold text-white/45">
                        แท็กเกม
                      </span>
                      <input
                        value={dailyGameTag}
                        onChange={(event) => setDailyGameTag(event.target.value)}
                        placeholder="เช่น ROV, MLBB, Free Fire"
                        maxLength={80}
                        className="min-h-11 w-full rounded-xl border border-white/10 bg-black/35 px-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-purple-300"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-bold text-white/45">
                        ประเภทภาพ
                      </span>
                      <select
                        value={dailyImageSlot}
                        onChange={(event) =>
                          setDailyImageSlot(event.target.value as DailyImageSlot)
                        }
                        className="min-h-11 w-full rounded-xl border border-white/10 bg-black/35 px-4 text-sm text-white outline-none transition focus:border-purple-300"
                      >
                        <option value="image1">ภาพที่ 1 — ภาพหลัก</option>
                        <option value="image2">ภาพที่ 2 — ราคาแพ็ค</option>
                      </select>
                    </label>
                    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-white/15 bg-black/25 px-4 text-sm text-white/55 transition hover:border-purple-300/50 hover:text-white">
                      <span className="truncate">
                        {dailyFileName || "เลือกไฟล์ PNG, JPG หรือ WEBP"}
                      </span>
                      <span className="shrink-0 font-black text-purple-200">＋</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        onChange={(event) =>
                          handleDailyImageFile(event.target.files?.[0])
                        }
                      />
                    </label>

                    {dailyImageUrl && (
                      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3">
                        <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-black">
                          <Image
                            src={dailyImageUrl}
                            alt="ตัวอย่างรูปรายวัน"
                            fill
                            unoptimized
                            sizes="64px"
                            className="object-cover"
                          />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">พร้อมอัปโหลด</p>
                          <p className="mt-1 text-xs text-white/35">
                            {DAILY_IMAGE_SLOT_LABELS[dailyImageSlot]}
                          </p>
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={dailyUploading}
                      className="w-full rounded-xl bg-purple-300 px-5 py-3 text-sm font-black text-[#13091c] transition hover:bg-purple-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {dailyUploading ? "กำลังอัปโหลด..." : "อัปโหลดรูป"}
                    </button>
                  </form>
                </section>

                <section className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.03]">
                  <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] px-5 py-4">
                    <div>
                      <h2 className="font-black">คลังรูปรายวัน</h2>
                      <p className="mt-1 text-xs text-white/35">
                        {dailyImages.length} รูป · เรียงล่าสุดก่อน
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={loadDailyImages}
                      className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-white/55 transition hover:border-white/25 hover:text-white"
                    >
                      รีเฟรช
                    </button>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto p-4">
                    {dailyLoading ? (
                      <div className="rounded-2xl border border-white/10 p-6 text-sm text-white/40">
                        กำลังโหลดรูปรายวัน...
                      </div>
                    ) : dailyImages.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-white/40">
                        ยังไม่มีรูปรายวัน
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {dailyImages.map((image) => (
                          <article
                            key={image.id}
                            className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black/25"
                          >
                            <div className="relative aspect-square bg-black">
                              <Image
                                src={image.imageUrl}
                                alt={`${image.gameName} daily image`}
                                fill
                                unoptimized
                                sizes="(min-width: 1536px) 16vw, (min-width: 1280px) 22vw, 50vw"
                                className="object-cover"
                              />
                            </div>
                            <div className="p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold">
                                    {image.gameName}
                                  </p>
                                  <p className="mt-1 truncate text-xs text-white/35">
                                    {image.gameTag || "ไม่มีแท็กเกม"}
                                  </p>
                                </div>
                                <span className="shrink-0 rounded-full bg-emerald-300/10 px-2 py-1 text-[10px] font-bold text-emerald-200">
                                  {image.isActive ? "active" : "off"}
                                </span>
                              </div>
                              <p className="mt-2 text-[11px] text-purple-200/65">
                                {DAILY_IMAGE_SLOT_LABELS[image.imageSlot]}
                              </p>
                              <button
                                type="button"
                                disabled={dailyDeletingId === image.id}
                                onClick={() => deleteDailyImage(image.id)}
                                className="mt-3 w-full rounded-xl border border-red-300/20 px-3 py-2 text-xs font-bold text-red-200 transition hover:bg-red-300/10 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {dailyDeletingId === image.id
                                  ? "กำลังลบ..."
                                  : "ลบรูป"}
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )}

            {activeSection === "users" && (
              <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:h-full lg:min-h-[580px]">
                <form
                  className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 sm:flex-row"
                  onSubmit={(event) => {
                    event.preventDefault();
                    loadUsers(search);
                  }}
                >
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="ค้นหาอีเมลหรือชื่อผู้ใช้งาน"
                    className="min-h-11 flex-1 rounded-xl border border-white/10 bg-black/35 px-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-purple-300"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-purple-300 px-5 py-3 text-sm font-black text-[#13091c] transition hover:bg-purple-200"
                  >
                    ค้นหา
                  </button>
                  <button
                    type="button"
                    onClick={() => loadUsers(search)}
                    className="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white/55 transition hover:border-white/25 hover:text-white"
                  >
                    รีเฟรช
                  </button>
                </form>

                <section className="min-h-0 flex-1 overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.03]">
                  <div className="h-full overflow-auto">
                    <div className="sticky top-0 z-10 grid min-w-[1060px] grid-cols-[1.5fr_0.7fr_1.4fr_1fr_1fr] border-b border-white/10 bg-[#10101d] px-4 py-3 text-xs font-bold uppercase tracking-[0.08em] text-white/35">
                      <div>ผู้ใช้งาน</div>
                      <div>สิทธิ์</div>
                      <div>แพ็กเกจ</div>
                      <div>การใช้งาน</div>
                      <div>การชำระเงิน</div>
                    </div>

                    {loading ? (
                      <div className="p-6 text-sm text-white/40">
                        กำลังโหลดผู้ใช้งาน...
                      </div>
                    ) : users.length === 0 ? (
                      <div className="p-10 text-center text-sm text-white/40">
                        ไม่พบผู้ใช้งาน
                      </div>
                    ) : (
                      <div className="min-w-[1060px] divide-y divide-white/[0.07]">
                        {users.map((user) => (
                          <article
                            key={user.id}
                            className="grid grid-cols-[1.5fr_0.7fr_1.4fr_1fr_1fr] gap-4 px-4 py-4 transition hover:bg-white/[0.02]"
                          >
                            <div>
                              <p className="break-all text-sm font-bold">
                                {user.email}
                              </p>
                              <p className="mt-1 text-xs text-white/40">
                                {user.displayName || "ยังไม่มีชื่อแสดง"}
                              </p>
                              <p className="mt-2 text-xs text-white/25">
                                สมัครเมื่อ {formatDate(user.createdAt)}
                              </p>
                            </div>

                            <div>
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${roleClassName(
                                  user.role
                                )}`}
                              >
                                {user.role}
                              </span>
                              <div className="mt-3 flex flex-col gap-2">
                                <button
                                  type="button"
                                  disabled={
                                    actingUserId === user.id || user.role === "admin"
                                  }
                                  onClick={() => updateRole(user.id, "admin")}
                                  className="rounded-lg border border-emerald-300/25 px-3 py-2 text-xs font-bold text-emerald-200 transition hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-30"
                                >
                                  ตั้งเป็น Admin
                                </button>
                                <button
                                  type="button"
                                  disabled={
                                    actingUserId === user.id || user.role === "user"
                                  }
                                  onClick={() => updateRole(user.id, "user")}
                                  className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-white/55 transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-30"
                                >
                                  ตั้งเป็น User
                                </button>
                              </div>
                            </div>

                            <div>
                              {user.subscription ? (
                                <>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-black">
                                      {user.subscription.planName}
                                    </p>
                                    <span className="rounded-full bg-white/[0.07] px-2 py-1 text-xs text-white/50">
                                      {user.subscription.status}
                                    </span>
                                  </div>
                                  <p className="mt-2 text-xs text-white/40">
                                    ฿{user.subscription.priceMonthlyThb} / เดือน
                                  </p>
                                  <p className="mt-1 text-xs text-white/40">
                                    {formatDate(
                                      user.subscription.currentPeriodStart
                                    )}{" "}
                                    - {formatDate(user.subscription.currentPeriodEnd)}
                                  </p>
                                </>
                              ) : (
                                <p className="text-sm text-white/35">ไม่มีแพ็กเกจ</p>
                              )}
                            </div>

                            <div>
                              {user.subscription ? (
                                <>
                                  <p className="text-sm font-bold">
                                    {user.subscription.usedImagesThisPeriod} /{" "}
                                    {user.subscription.monthlyImageLimit}
                                  </p>
                                  <p className="mt-1 text-xs text-white/40">
                                    เหลือ {user.subscription.remainingImages} รูป
                                  </p>
                                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.07]">
                                    <div
                                      className="h-full rounded-full bg-purple-300"
                                      style={{
                                        width: `${Math.min(
                                          100,
                                          (user.subscription
                                            .usedImagesThisPeriod /
                                            Math.max(
                                              user.subscription.monthlyImageLimit,
                                              1
                                            )) *
                                            100
                                        )}%`,
                                      }}
                                    />
                                  </div>
                                </>
                              ) : (
                                <p className="text-sm text-white/35">-</p>
                              )}
                            </div>

                            <div>
                              <p className="text-sm font-bold">
                                ฿{user.paymentSummary.totalPaidThb.toLocaleString(
                                  "th-TH"
                                )}
                              </p>
                              <p className="mt-1 text-xs text-white/40">
                                สำเร็จ {user.paymentSummary.paidPayments} / ทั้งหมด{" "}
                                {user.paymentSummary.totalPayments}
                              </p>
                              <p className="mt-1 text-xs text-amber-200/65">
                                รอตรวจ {user.paymentSummary.pendingPayments}
                              </p>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )}

            {activeSection === "game-activity" && (
              <div className="mx-auto max-w-7xl">
                <GameActivityReviewPanel />
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
