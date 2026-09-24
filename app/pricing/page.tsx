import { PageHeader, EmptyState } from "@/app/components/ui/workspace";
import { hasDatabaseUrl } from "@/lib/db";
import { listActiveSubscriptionPlans } from "@/lib/subscription/repository";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const plans = hasDatabaseUrl() ? await listActiveSubscriptionPlans() : [];

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-white">
      <section className="mx-auto max-w-6xl">
        <PageHeader title="แพ็กเกจสำหรับร้านของคุณ" description="เลือกตามจำนวนภาพที่ใช้ โควตานับเฉพาะภาพที่สร้างสำเร็จ ใช้งานได้ 30 วันต่อรอบ" />
        <div className="grid gap-5 md:grid-cols-3">
          {plans.map((plan) => {
            const featured = plan.slug === "pro";

            return (
              <article
                key={plan.slug}
                className={`rounded-3xl border p-6 shadow-2xl ${
                  featured
                    ? "border-purple-300 bg-purple-400 text-black"
                    : "border-white/10 bg-white/[0.04]"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold">{plan.name}</h2>
                    <p
                      className={`mt-2 text-sm ${
                        featured ? "text-black/65" : "text-muted"
                      }`}
                    >
                      {plan.description}
                    </p>
                  </div>
                  {featured && (
                    <span className="rounded-full bg-black px-3 py-1 text-xs font-bold text-white">
                      แนะนำ
                    </span>
                  )}
                </div>

                <div className="mt-8">
                  <span className="text-5xl font-semibold">
                    ฿{plan.priceMonthlyThb}
                  </span>
                  <span
                    className={`ml-2 text-sm ${
                      featured ? "text-black/60" : "text-muted"
                    }`}
                  >
                    / เดือน
                  </span>
                </div>

                <ul
                  className={`mt-8 space-y-3 text-sm ${
                    featured ? "text-black/75" : "text-white/65"
                  }`}
                >
                  <li>สร้างรูปได้ {plan.monthlyImageLimit} รูปต่อเดือน</li>
                  <li>สร้างได้สูงสุด {plan.maxImagesPerGeneration} รูปต่อครั้ง</li>
                  <li>เก็บประวัติรูป {plan.historyRetentionDays} วัน</li>
                  <li>
                    ฟีเจอร์พิเศษ:{" "}
                    {plan.hasSpecialFeatures ? (
                      <span
                        className={`inline-flex items-center gap-1 font-bold ${
                          featured ? "text-black" : "text-purple-200"
                        }`}
                      >
                        <span aria-hidden="true">♛</span>
                        LAZYPRO
                      </span>
                    ) : (
                      "ไม่ได้"
                    )}
                  </li>
                  <li>บริการ VIP: {plan.hasVipSupport ? "มี" : "ไม่มี"}</li>
                </ul>

                <a
                  href={`/checkout?plan=${plan.slug}`}
                  className={`mt-8 block rounded-2xl px-5 py-4 text-center font-bold transition ${
                    featured
                      ? "bg-black text-white hover:bg-black/80"
                      : "bg-purple-400 text-black hover:bg-purple-300"
                  }`}
                >
                  เลือกแพ็กเกจนี้
                </a>
              </article>
            );
          })}
        </div>

        {plans.length === 0 && (
          <EmptyState title="ยังไม่มีแพ็กเกจพร้อมให้เลือก" description="กรุณากลับมาตรวจสอบอีกครั้งภายหลัง" href="/dashboard" action="กลับไปภาพรวม" />
        )}

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-sm text-muted">
          รองรับ PromptPay QR และโอนเงินแบบตรวจสอบหลักฐานโดยผู้ดูแล
          รายการชำระเงินมีอายุ 24 ชั่วโมง และสลิปถูกเก็บเป็นส่วนตัว
        </div>
      </section>
    </main>
  );
}
