"use client";

import { useCallback, useEffect, useState } from "react";
import { SupportChatWorkspace } from "./support-chat-workspace";

const EMPTY_IMAGE_URLS: string[] = [];

export function VipSupportLauncher({
  visible,
  authenticated,
  hasAccess,
  defaultOpen = false,
  draftImageUrls = EMPTY_IMAGE_URLS,
}: {
  visible: boolean;
  authenticated: boolean;
  hasAccess: boolean;
  defaultOpen?: boolean;
  draftImageUrls?: string[];
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = useCallback(async () => {
    if (!hasAccess) return;

    try {
      const response = await fetch("/api/support/conversations", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = await response.json();
      const count = (data.conversations || []).reduce(
        (sum: number, conversation: { unreadCount?: number }) =>
          sum + Number(conversation.unreadCount || 0),
        0
      );
      setUnreadCount(count);
    } catch (error) {
      console.error("load VIP support unread count error:", error);
    }
  }, [hasAccess]);

  useEffect(() => {
    if (!hasAccess) return;

    const initialLoad = window.setTimeout(() => void loadUnreadCount(), 0);
    const interval = window.setInterval(loadUnreadCount, 30_000);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [hasAccess, loadUnreadCount]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!visible) return null;

  function closeChat() {
    setOpen(false);
    window.setTimeout(() => void loadUnreadCount(), 0);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="เปิดกล่องแชต VIP Support"
        aria-expanded={open}
        className="group fixed bottom-5 right-5 z-50 inline-flex min-h-16 items-center gap-3 rounded-2xl border-2 border-purple-200/70 bg-[#21102f]/95 px-2.5 text-sm font-black text-white shadow-[0_0_0_4px_rgba(168,85,247,0.12),0_18px_55px_rgba(168,85,247,0.55)] backdrop-blur-xl transition hover:-translate-y-1 hover:border-white hover:bg-purple-400 hover:text-black focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-200/50 sm:bottom-7 sm:right-7 sm:px-4"
      >
        <span
          aria-hidden="true"
          className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-300 to-purple-400 text-white shadow-[0_0_24px_rgba(216,180,254,0.65)] ring-2 ring-white/70 transition group-hover:from-white group-hover:to-purple-100 group-hover:text-purple-700"
        >
          <ChatBubbleIcon className="h-7 w-7" />
          <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-[#21102f] bg-emerald-400 group-hover:border-purple-400" />
        </span>
        <span className="hidden sm:block">
          <span className="block">VIP Support</span>
          <span className="block text-[10px] font-semibold opacity-60">
            {hasAccess ? "ทีมงานมนุษย์ช่วยแก้ภาพ" : "เฉพาะแพ็ก Business 999"}
          </span>
        </span>
        {hasAccess && unreadCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 min-w-6 rounded-full bg-fuchsia-400 px-1.5 py-1 text-center text-[10px] font-black text-black">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeChat();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="vip-support-dialog-title"
            className="fixed inset-3 flex min-h-0 flex-col overflow-hidden rounded-3xl border border-purple-300/25 bg-[#08080d] shadow-[0_30px_100px_rgba(0,0,0,0.72)] sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(780px,calc(100vh-3rem))] sm:w-[min(980px,calc(100vw-3rem))]"
          >
            <header className="flex items-center justify-between gap-4 border-b border-white/10 bg-purple-300/[0.06] px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-purple-300">
                  Business 999 Exclusive
                </p>
                <h2 id="vip-support-dialog-title" className="mt-1 truncate text-lg font-black">
                  Human VIP Support
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {hasAccess ? (
                  <a
                    href="/dashboard/support"
                    className="hidden rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-white/60 transition hover:border-white/30 hover:text-white sm:inline-flex"
                  >
                    เปิดหน้าเต็ม
                  </a>
                ) : null}
                <button
                  type="button"
                  autoFocus
                  onClick={closeChat}
                  aria-label="ปิดกล่องแชต VIP Support"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-xl text-white/60 transition hover:border-white/30 hover:text-white"
                >
                  ×
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 p-2 sm:p-3">
              {hasAccess ? (
                <SupportChatWorkspace
                  mode="user"
                  compact
                  defaultNewConversation={draftImageUrls.length > 0}
                  draftImageUrls={draftImageUrls}
                />
              ) : (
                <div className="flex h-full min-h-[420px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.025] p-6 text-center">
                  <div className="max-w-md">
                    <span
                      aria-hidden="true"
                      className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-purple-300/25 bg-purple-300/10 text-3xl"
                    >
                      {authenticated ? "🔒" : "💬"}
                    </span>
                    <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-purple-300">
                      Business 999 Exclusive
                    </p>
                    <h3 className="mt-2 text-2xl font-black text-white">
                      {authenticated
                        ? "VIP Support สำหรับแพ็ก Business 999"
                        : "เข้าสู่ระบบเพื่อใช้ VIP Support"}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-white/55">
                      {authenticated
                        ? "บัญชีนี้ยังไม่มีสิทธิ์ใช้งานแชตกับแอดมิน อัปเกรดเป็นแพ็ก Business 999 เพื่อส่งข้อความ แนบรูป และรับการแจ้งเตือนตอบกลับ"
                        : "เข้าสู่ระบบเพื่อตรวจสอบสิทธิ์แพ็กเกจ และใช้งานแชตกับทีมงานมนุษย์สำหรับสมาชิก Business 999"}
                    </p>
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                      <a
                        href={authenticated ? "/pricing" : "/sign-in"}
                        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-purple-300 px-5 text-sm font-black text-black transition hover:bg-purple-200"
                      >
                        {authenticated ? "ดูแพ็ก Business 999" : "เข้าสู่ระบบ"}
                      </a>
                      <a
                        href={authenticated ? "/dashboard" : "/pricing"}
                        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-5 text-sm font-bold text-white/70 transition hover:border-white/35 hover:text-white"
                      >
                        {authenticated ? "ตรวจสอบแพ็กเกจ" : "ดูแพ็กเกจ"}
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function ChatBubbleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.8 8.8 0 0 1-3.45-.7L4 20l1.55-4.05A7.25 7.25 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z" />
      <path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" />
    </svg>
  );
}
