"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

export function GameCalendarAccessGate({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    window.queueMicrotask(async () => {
      try {
        const response = await fetch("/api/game-calendar/admin/me", {
          cache: "no-store",
        });
        if (!response.ok) {
          router.replace(
            `/sign-in?next=${encodeURIComponent("/admin#game-activity-review")}`
          );
          return;
        }
        setAllowed(true);
      } finally {
        setChecked(true);
      }
    });
  }, [router]);

  if (!checked || !allowed) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#07101d] px-4 text-center text-white">
        <div>
          <p className="text-sm font-black text-cyan-200">
            LAZY TOPUP · GAME CALENDAR
          </p>
          <p className="mt-2 text-sm text-slate-500">
            กำลังตรวจสอบสิทธิ์การเข้าถึง...
          </p>
        </div>
      </main>
    );
  }

  return children;
}
