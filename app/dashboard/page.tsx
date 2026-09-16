"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/app/components/ui/button";
import { StatusMessage } from "@/app/components/ui/status-message";
import { TextField } from "@/app/components/ui/text-field";
import { NotificationBell } from "@/app/components/notifications/notification-bell";

type DashboardState = {
  user: {
    email: string;
    displayName: string | null;
    role: "user" | "admin";
  } | null;
  subscription: {
    status: string;
    currentPeriodEnd: string;
    usedImagesThisPeriod: number;
    remainingImages: number;
    plan: {
      slug: "trial" | "basic" | "pro" | "business" | "admin";
      name: string;
      description: string;
      priceMonthlyThb: number;
      monthlyImageLimit: number;
      hasSpecialFeatures: boolean;
      hasVipSupport: boolean;
      historyRetentionDays: number;
    };
  } | null;
  databaseConfigured: boolean;
  isAdmin: boolean;
};

async function fetchDashboardState() {
  const res = await fetch("/api/subscription/me", { cache: "no-store" });
  const responseText = await res.text();
  const data = responseText
    ? (JSON.parse(responseText) as DashboardState & { error?: string })
    : null;

  if (!res.ok || !data) {
    throw new Error(data?.error || `โหลดข้อมูลสมาชิกไม่สำเร็จ (${res.status})`);
  }

  return data;
}

export default function DashboardPage() {
  const [state, setState] = useState<DashboardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [trialCode, setTrialCode] = useState("");
  const [redeemingTrial, setRedeemingTrial] = useState(false);
  const [trialFeedback, setTrialFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const data = await fetchDashboardState();
        if (active) setState(data);
      } catch (error) {
        console.error(error);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  async function handleRedeemTrial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trialCode.trim() || redeemingTrial) return;

    setRedeemingTrial(true);
    setTrialFeedback(null);

    try {
      const res = await fetch("/api/trial/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trialCode }),
      });
      const responseText = await res.text();
      const data = responseText
        ? (JSON.parse(responseText) as { message?: string; error?: string })
        : {};

      if (!res.ok) {
        throw new Error(data.error || "เปิดสิทธิ์ทดลองใช้ไม่สำเร็จ");
      }

      setTrialCode("");
      setTrialFeedback({
        tone: "success",
        message: data.message || "เปิดสิทธิ์ทดลองใช้ฟรี 10 รูปแล้ว",
      });

      try {
        setState(await fetchDashboardState());
      } catch (refreshError) {
        console.error("refresh dashboard after trial redemption failed:", refreshError);
      }
    } catch (error) {
      setTrialFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "เปิดสิทธิ์ทดลองใช้ไม่สำเร็จ",
      });
    } finally {
      setRedeemingTrial(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050505] px-6 py-10 text-white">
      <section className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-3 text-sm font-medium text-purple-300">
              LAZY-AI.GAME Member
            </p>
            <h1 className="text-4xl font-black tracking-tight">Dashboard</h1>
          </div>

          {state?.user && <NotificationBell />}

          <a
            href="/pricing"
            className="rounded-2xl bg-purple-400 px-5 py-3 text-center font-bold text-black transition hover:bg-purple-300"
          >
            ดูแพ็กเกจ
          </a>
          <a
            href="/dashboard/history"
            className="rounded-2xl border border-white/10 px-5 py-3 text-center font-bold text-white/70 transition hover:border-white/30 hover:text-white"
          >
            ประวัติภาพ
          </a>
          {state?.isAdmin && (
            <a
              href="/admin"
              className="rounded-2xl border border-white/10 px-5 py-3 text-center font-bold text-white/70 transition hover:border-white/30 hover:text-white"
            >
              ตรวจ payment
            </a>
          )}
        </div>

        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-white/50">
            กำลังโหลดข้อมูล...
          </div>
        ) : !state?.databaseConfigured ? (
          <Notice
            title="ยังไม่ได้เชื่อมต่อฐานข้อมูล"
            body="ตั้งค่า DATABASE_URL และรัน db/schema.sql + db/seed-plans.sql ก่อนใช้งานระบบสมาชิกจริง"
          />
        ) : !state.user ? (
          <Notice
            title="ยังไม่ได้เข้าสู่ระบบ"
            body="เข้าสู่ระบบหรือสมัครสมาชิกก่อนดูสถานะแพ็กเกจ"
            actionHref="/sign-in"
            actionLabel="เข้าสู่ระบบ"
          />
        ) : (
          <>
          <a href="/dashboard/frame" className="mb-5 block rounded-3xl border border-white/10 bg-white/[0.04] p-6 transition hover:border-purple-300/50">
            <p className="text-xs font-bold tracking-widest text-purple-300">VIDEO FRAME</p>
            <h2 className="mt-2 text-2xl font-black">ภาพโปรโมชั่น + คลิปของร้าน</h2>
            <p className="mt-2 text-sm text-white/55">จัดกรอบแนวตั้งพร้อมโลโก้และช่องทางสั่งซื้อจากข้อมูลร้าน</p>
            <span className="mt-4 inline-block text-sm font-bold text-purple-200">เปิดหน้าจัดกรอบวิดีโอ →</span>
          </a>
          <a href="/dashboard/motion" className="mb-5 block rounded-3xl border border-white/10 bg-white/[0.04] p-6 transition hover:border-purple-300/50">
            <p className="text-xs font-bold tracking-widest text-purple-300">MOTION STUDIO</p>
            <h2 className="mt-2 text-2xl font-black">สร้างวิดีโอจากภาพโปรโมชั่น</h2>
            <p className="mt-2 text-sm text-white/55">ตรวจแผนเคลื่อนไหวและไฮไลต์ราคา แล้วสร้าง MP4</p>
            <span className="mt-4 inline-block text-sm font-bold text-purple-200">เปิดสตูดิโอวิดีโอ →</span>
          </a>
          <a href="/dashboard/library" className="mb-5 block rounded-3xl border border-white/10 bg-white/[0.04] p-6 transition hover:border-purple-300/50">
            <p className="text-sm font-bold text-purple-200">LIBRARY</p>
            <h2 className="mt-2 text-2xl font-black">คลังไฟล์และชุดงาน</h2>
            <p className="mt-2 text-sm leading-6 text-white/55">เก็บภาพและคลิป จัดชุดงาน และติดตามสถานะการตรวจไฟล์</p>
            <span className="mt-4 inline-block text-sm font-bold text-purple-200">เปิดคลังงาน →</span>
          </a>
          <a href="/dashboard/brand" className="mb-5 block rounded-3xl border border-purple-300/25 bg-purple-300/[0.07] p-6 transition hover:border-purple-300/50">
            <p className="text-sm font-bold text-purple-200">BRAND KIT</p>
            <h2 className="mt-2 text-2xl font-black">ข้อมูลร้านของคุณ</h2>
            <p className="mt-2 text-sm leading-6 text-white/55">ตั้งชื่อ โลโก้ สี และช่องทางติดต่อ เพื่อเตรียมแบรนด์สำหรับชิ้นงานใหม่</p>
            <span className="mt-4 inline-block text-sm font-bold text-purple-200">ตั้งค่าข้อมูลร้าน →</span>
          </a>
          {!state.subscription && (
            <section className="mb-5 rounded-3xl border border-emerald-300/25 bg-emerald-300/[0.07] p-6">
              <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-end">
                <div>
                  <p className="text-sm font-bold text-emerald-200">
                    FREE TRIAL
                  </p>
                  <h2 className="mt-2 text-2xl font-black">
                    มีโค้ดทดลองใช้ รับฟรี 10 รูป
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-white/55">
                    หนึ่งบัญชีรับสิทธิ์ทดลองได้เพียงครั้งเดียว ใช้ได้ทั้งการสร้างภาพใหม่และแก้ไขภาพ
                  </p>
                </div>

                <form onSubmit={handleRedeemTrial} className="space-y-3">
                  <TextField
                    label="โค้ดทดลองใช้"
                    value={trialCode}
                    onChange={(event) => setTrialCode(event.target.value.toUpperCase())}
                    placeholder="กรอกโค้ดที่ได้รับ"
                    autoComplete="off"
                    autoCapitalize="characters"
                    maxLength={64}
                    disabled={redeemingTrial}
                    required
                  />
                  <Button
                    type="submit"
                    variant="success"
                    loading={redeemingTrial}
                    loadingLabel="กำลังตรวจสอบโค้ด..."
                    disabled={!trialCode.trim()}
                    fullWidth
                  >
                    รับสิทธิ์ฟรี 10 รูป
                  </Button>
                </form>
              </div>

              {trialFeedback && (
                <StatusMessage tone={trialFeedback.tone} className="mt-4">
                  {trialFeedback.message}
                </StatusMessage>
              )}
            </section>
          )}

          <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-xl font-bold">บัญชีของฉัน</h2>
              <dl className="mt-5 space-y-4 text-sm">
                <div>
                  <dt className="text-white/40">อีเมล</dt>
                  <dd className="mt-1 font-medium">{state.user.email}</dd>
                </div>
                <div>
                  <dt className="text-white/40">ชื่อ</dt>
                  <dd className="mt-1 font-medium">
                    {state.user.displayName || "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-white/40">Role</dt>
                  <dd className="mt-1 font-medium">{state.user.role}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-xl font-bold">แพ็กเกจปัจจุบัน</h2>

              {state.subscription ? (
                <div className="mt-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-3xl font-black">
                        {state.subscription.plan.name}
                      </p>
                      <p className="mt-1 text-sm text-white/45">
                        {state.subscription.plan.description}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-400 px-3 py-1 text-xs font-bold text-black">
                      {state.subscription.status}
                    </span>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <Metric
                      label="ใช้ไปแล้ว"
                      value={`${state.subscription.usedImagesThisPeriod}`}
                    />
                    <Metric
                      label="คงเหลือ"
                      value={`${state.subscription.remainingImages}`}
                    />
                    <Metric
                      label="โควตาทั้งหมด"
                      value={`${state.subscription.plan.monthlyImageLimit}`}
                    />
                  </div>

                  <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/55">
                    {state.subscription.plan.slug === "trial" ? (
                      <>สิทธิ์ทดลองใช้ 10 รูป ไม่รีเซ็ตรายเดือน</>
                    ) : (
                      <>
                        หมดรอบวันที่{" "}
                        {new Date(
                          state.subscription.currentPeriodEnd
                        ).toLocaleDateString("th-TH")}
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <Notice
                  title="ยังไม่มีแพ็กเกจที่ใช้งานได้"
                  body="เลือกแพ็กเกจและชำระเงินเพื่อเปิดสิทธิ์ใช้งาน Generate"
                  actionHref="/pricing"
                  actionLabel="เลือกแพ็กเกจ"
                />
              )}
            </section>
          </div>

          {state.subscription?.plan.hasVipSupport && (
            <a
              href="/dashboard/support"
              className="mt-5 block rounded-3xl border border-purple-300/25 bg-purple-300/[0.07] p-6 transition hover:border-purple-300/50 hover:bg-purple-300/[0.1]"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-purple-200">Business 999 Exclusive</p>
                  <h2 className="mt-2 text-2xl font-black">Human VIP Support</h2>
                  <p className="mt-2 text-sm leading-6 text-white/50">
                    คุยกับทีมงานมนุษย์ หรือส่งรูปที่เจนไม่ถูกใจมาให้ช่วยตรวจและแก้ไข
                  </p>
                </div>
                <span className="shrink-0 rounded-xl bg-purple-300 px-5 py-3 text-center text-sm font-black text-black">
                  เปิดกล่องข้อความ
                </span>
              </div>
            </a>
          )}
          </>
        )}
      </section>
    </main>
  );
}

function Notice({
  title,
  body,
  actionHref,
  actionLabel,
}: {
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mt-2 text-sm text-white/50">{body}</p>
      {actionHref && actionLabel && (
        <a
          href={actionHref}
          className="mt-5 inline-block rounded-2xl bg-purple-400 px-5 py-3 font-bold text-black transition hover:bg-purple-300"
        >
          {actionLabel}
        </a>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <p className="text-sm text-white/45">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}
