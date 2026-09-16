import { NotificationBell } from "@/app/components/notifications/notification-bell";
import { SupportChatWorkspace } from "@/app/components/support/support-chat-workspace";

export default function AdminSupportPage() {
  return (
    <main className="min-h-screen bg-[#050505] px-4 py-8 text-white sm:px-6">
      <section className="mx-auto max-w-7xl">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold text-purple-300">LAZY-AI.GAME Admin</p>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">VIP Support Inbox</h1>
            <p className="mt-2 text-sm text-white/45">ตอบลูกค้า ตรวจรูปที่แนบ และอัปเดตสถานะเคสจากที่เดียว</p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <a
              href="/admin"
              className="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white/70 transition hover:border-white/30 hover:text-white"
            >
              กลับ Admin
            </a>
          </div>
        </div>
        <SupportChatWorkspace mode="admin" />
      </section>
    </main>
  );
}
