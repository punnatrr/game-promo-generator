"use client";

import { useEffect, useState } from "react";

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
};

export default function DashboardPage() {
  const [state, setState] = useState<DashboardState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const res = await fetch("/api/subscription/me");
        const data = await res.json();
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
          {state?.user?.role === "admin" && (
            <a
              href="/admin/payments"
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
                    หมดรอบวันที่{" "}
                    {new Date(
                      state.subscription.currentPeriodEnd
                    ).toLocaleDateString("th-TH")}
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
