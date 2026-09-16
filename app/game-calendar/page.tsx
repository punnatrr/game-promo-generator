import type { Metadata } from "next";
import { Suspense } from "react";

import { GameCalendar } from "./game-calendar";

export const metadata: Metadata = {
  title: "ปฏิทินกิจกรรมเกม | LAZY TOPUP",
  description:
    "ติดตามตัวละคร สกิน แพตช์ กาชา Battle Pass และกิจกรรมสำคัญจากแหล่งข้อมูลที่ตรวจสอบแล้ว",
  alternates: {
    canonical: "/game-calendar",
  },
  openGraph: {
    title: "ปฏิทินกิจกรรมเกม | LAZY TOPUP",
    description:
      "รวมกำหนดการอัปเดตและกิจกรรมเกมยอดนิยม พร้อมไอเดียสำหรับทีมคอนเทนต์",
    type: "website",
    url: "/game-calendar",
  },
};

export const dynamic = "force-dynamic";

export default function GameCalendarPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-[#06101c] text-slate-300">
          กำลังเปิดปฏิทินกิจกรรมเกม...
        </main>
      }
    >
      <GameCalendar />
    </Suspense>
  );
}
