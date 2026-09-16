import type { ReactNode } from "react";

import { GameCalendarAccessGate } from "./access-gate";

export default function GameCalendarAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <GameCalendarAccessGate>{children}</GameCalendarAccessGate>;
}
