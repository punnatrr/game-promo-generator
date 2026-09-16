import type { Metadata } from "next";

import { GameContentSources } from "./sources-dashboard";

export const metadata: Metadata = {
  title: "Game Content Sources | LAZY TOPUP",
};

export default function GameContentSourcesPage() {
  return <GameContentSources />;
}
