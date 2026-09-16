import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "ปฏิทินกิจกรรมเกม | LAZY TOPUP",
  description:
    "รวมกิจกรรมและกำหนดการอัปเดตเกมที่ผ่านการตรวจสอบแล้ว",
};

export default function GameNewsPage() {
  redirect("/game-calendar");
}
