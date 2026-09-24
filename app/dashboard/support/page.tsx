
import { SupportChatWorkspace } from "@/app/components/support/support-chat-workspace";

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-white sm:px-6">
      <section className="mx-auto max-w-7xl">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold text-purple-300">Business 999 Exclusive</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">ติดต่อทีมงาน VIP</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              คุยกับทีมงานมนุษย์และส่งรูปที่เจนแล้วไม่ถูกใจหลายครั้งมาให้ช่วยตรวจหรือแก้ไข
            </p>
          </div>
          <div className="flex items-center gap-3">

            <a
              href="/dashboard"
              className="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white/70 transition hover:border-white/30 hover:text-white"
            >
              กลับ Dashboard
            </a>
          </div>
        </div>
        <SupportChatWorkspace mode="user" />
      </section>
    </main>
  );
}
