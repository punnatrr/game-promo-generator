"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { EmptyState, Skeleton } from "@/app/components/ui/workspace";

export function GameCalendarAccessGate({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState(false);

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
      } catch {
        setError(true);
      } finally {
        setChecked(true);
      }
    });
  }, [router]);

  if (!checked || !allowed) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4 text-center text-white">
        {error ? <EmptyState title="ตรวจสอบสิทธิ์ไม่สำเร็จ" description="กรุณาลองเชื่อมต่ออีกครั้ง" action="ลองอีกครั้ง" onAction={() => window.location.reload()} /> : <Skeleton label="กำลังตรวจสอบสิทธิ์การเข้าถึง" />}
      </main>
    );
  }

  return children;
}
