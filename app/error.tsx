"use client";
import { useEffect } from "react";
import { EmptyState } from "@/app/components/ui/workspace";
export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error("Page failed:", error); }, [error]);
  return <main className="page-container"><EmptyState title="เปิดหน้านี้ไม่สำเร็จ" description="บริการอาจไม่พร้อมชั่วคราว ลองโหลดอีกครั้งเพื่อทำงานต่อ" action="ลองโหลดอีกครั้ง" onAction={reset} /></main>;
}
