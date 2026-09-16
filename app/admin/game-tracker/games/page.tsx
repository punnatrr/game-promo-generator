import type { Metadata } from "next";

import { GameContentGames } from "./games-dashboard";

export const metadata: Metadata = {
  title: "Game Catalog | LAZY TOPUP",
};

export default function GameContentGamesPage() {
  return <GameContentGames />;
}
