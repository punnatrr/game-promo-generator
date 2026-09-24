"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
};

function notificationHref(type: string) {
  if (type === "support_user_message") return "/admin/support";
  if (type.startsWith("support_")) return "/dashboard/support";
  return "/dashboard";
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function dismiss(event: PointerEvent) { if (!container.current?.contains(event.target as Node)) setOpen(false); }
    function escape(event: KeyboardEvent) { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); };
  }, [open]);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.error("load notifications error:", error);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadNotifications(), 0);
    const interval = window.setInterval(loadNotifications, 30_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadNotifications]);

  async function markAllRead() {
    if (busy) return;
    setBusy(true); setError("");
    try {
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!response.ok) throw new Error();
    setUnreadCount(0);
    setNotifications((items) =>
      items.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() }))
    );
    } catch { setError("บันทึกสถานะไม่สำเร็จ กรุณาลองอีกครั้ง"); }
    finally { setBusy(false); }
  }

  async function markOneRead(id: string) {
    try {
    const response = await fetch("/api/notifications", {
      method: "PATCH", keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!response.ok) return;
    const wasUnread = notifications.some((item) => item.id === id && !item.readAt);
    setNotifications((items) =>
      items.map((item) =>
        item.id === id ? { ...item, readAt: item.readAt || new Date().toISOString() } : item
      )
    );
    if (wasUnread) setUnreadCount((count) => Math.max(0, count - 1));
    } catch { /* Notification navigation should still work if marking read fails. */ }
  }

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        ref={trigger}
        aria-label="การแจ้งเตือน"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-xl transition hover:border-purple-300/40 hover:bg-purple-300/10"
      >
        <span aria-hidden>🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-fuchsia-400 px-1.5 py-0.5 text-center text-[10px] font-semibold text-black">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-13 z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-[#121119] shadow-2xl shadow-black/50">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="font-bold">การแจ้งเตือน</p>
            {unreadCount > 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={markAllRead}
                className="text-xs font-bold text-purple-300 hover:text-purple-200"
              >
                {busy ? "กำลังบันทึก…" : "อ่านทั้งหมดแล้ว"}
              </button>
            )}
          </div>

          {error && <p role="alert" className="px-4 py-3 text-sm text-rose-200">{error}</p>}

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted">ยังไม่มีการแจ้งเตือน</p>
            ) : (
              notifications.map((notification) => (
                <a
                  key={notification.id}
                  href={notificationHref(notification.type)}
                  onClick={() => void markOneRead(notification.id)}
                  className={`block border-b border-white/[0.06] px-4 py-3 transition hover:bg-white/[0.05] ${
                    notification.readAt ? "opacity-60" : "bg-purple-300/[0.06]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {!notification.readAt && (
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-fuchsia-400" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold">{notification.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">
                        {notification.message}
                      </p>
                      <p className="mt-1 text-[11px] text-muted">
                        {new Date(notification.createdAt).toLocaleString("th-TH")}
                      </p>
                    </div>
                  </div>
                </a>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
