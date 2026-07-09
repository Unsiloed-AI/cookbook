"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

// The battle client needs the browser (Phaser + WebSocket) — never SSR it.
const BattleClient = dynamic(() => import("@/game/BattleClient"), { ssr: false });

export default function BattlePage() {
  return (
    <Suspense fallback={null}>
      <BattleClient />
    </Suspense>
  );
}
