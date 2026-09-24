"use client";
import Link from "next/link";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/app/components/ui/button";
import { StatusMessage } from "@/app/components/ui/status-message";
import { TextField } from "@/app/components/ui/text-field";
import { PageHeader, Skeleton } from "@/app/components/ui/workspace";

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
  const [loadError, setLoadError] = useState(false);
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
        if (active) setLoadError(true);
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
    <main className="min-h-screen bg-background px-6 py-10 text-white">
      <section className="mx-auto max-w-5xl">
        <PageHeader title="บัญชีและการใช้งาน" description="ตรวจแพ็กเกจ สิทธิ์ที่เหลือ และจัดการบัญชีของคุณ" action={<Link href="/" className="action-link">กลับไปสร้างงาน</Link>} />
        <section id="account" className="dashboard-section"><h2 className="mb-5">บัญชีและการใช้งาน</h2></section>
        {loading ? (
          <Skeleton />
        ) : loadError ? (<Notice title="โหลดข้อมูลบัญชีไม่สำเร็จ" body="ลองโหลดอีกครั้งเพื่อตรวจแพ็กเกจและโควตาของคุณ" actionHref="/dashboard" actionLabel="ลองอีกครั้ง" />) : !state?.databaseConfigured ? (
          <Notice
            title="ข้อมูลสมาชิกยังไม่พร้อมใช้งาน"
            body="กรุณาลองอีกครั้งภายหลัง หากยังพบปัญหาให้ติดต่อทีมงาน"
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
          {!state.subscription && (
            <section className="mb-5 rounded-3xl border border-emerald-300/25 bg-emerald-300/[0.07] p-6">
              <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-end">
                <div>
                  <p className="text-sm font-bold text-emerald-200">
                    FREE TRIAL
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">
                    มีโค้ดทดลองใช้ รับฟรี 10 รูป
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted">
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
                  <dt className="text-muted">อีเมล</dt>
                  <dd className="mt-1 font-medium">{state.user.email}</dd>
                </div>
                <div>
                  <dt className="text-muted">ชื่อ</dt>
                  <dd className="mt-1 font-medium">
                    {state.user.displayName || "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">สิทธิ์บัญชี</dt>
                  <dd className="mt-1 font-medium">{state.user.role === "admin" ? "ผู้ดูแลระบบ" : "สมาชิก"}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-xl font-bold">แพ็กเกจปัจจุบัน</h2>

              {state.subscription ? (
                <div className="mt-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-3xl font-semibold">
                        {state.subscription.plan.name}
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        {state.subscription.plan.description}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-400 px-3 py-1 text-xs font-bold text-black">
                      {state.subscription.status === "active" ? "ใช้งานได้" : state.subscription.status === "expired" ? "หมดอายุ" : "ยังไม่พร้อมใช้งาน"}
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

                  <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-muted">
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
                  body="เลือกแพ็กเกจและชำระเงินเพื่อเปิดสิทธิ์สร้างภาพ"
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
                  <h2 className="mt-2 text-2xl font-semibold">Human VIP Support</h2>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    คุยกับทีมงานมนุษย์ หรือส่งรูปที่เจนไม่ถูกใจมาให้ช่วยตรวจและแก้ไข
                  </p>
                </div>
                <span className="shrink-0 rounded-xl bg-purple-300 px-5 py-3 text-center text-sm font-semibold text-black">
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
      <p className="mt-2 text-sm text-muted">{body}</p>
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
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  );
}
