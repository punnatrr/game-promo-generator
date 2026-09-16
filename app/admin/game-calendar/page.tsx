import { redirect } from "next/navigation";

export default function LegacyGameCalendarAdminPage() {
  redirect("/admin#game-activity-review");
}
