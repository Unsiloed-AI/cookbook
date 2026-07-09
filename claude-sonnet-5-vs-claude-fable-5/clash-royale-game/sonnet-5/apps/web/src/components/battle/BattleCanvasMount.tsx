"use client";

import { useEffect, useRef } from "react";
import type { BattleRoom, Side } from "@/game/battleTypes";
import { PhaserGameController } from "@/game/PhaserGameController";

interface BattleCanvasMountProps {
  room: BattleRoom;
  mySide: Side;
}

export function BattleCanvasMount({ room, mySide }: BattleCanvasMountProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const controller = new PhaserGameController();
    controller.mount(containerRef.current, room, mySide);
    return () => controller.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className="mx-auto aspect-[9/16] w-full max-w-[520px] overflow-hidden rounded-2xl border border-arcane-border shadow-2xl"
    />
  );
}
