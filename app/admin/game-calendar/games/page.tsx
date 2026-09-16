import { redirect } from "next/navigation";

export default function LegacyGameCalendarGamesPage() {
  redirect("/admin/game-tracker/games");
}
