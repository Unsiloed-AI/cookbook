"use client";

import { useEffect, useRef } from "react";
import type { BattleConnection } from "./BattleConnection";
import { ARENA_H, ARENA_W } from "./visuals";

/** Mounts the Phaser game once and hands it the live battle connection. */
export function PhaserStage({ connection }: { connection: BattleConnection }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let game: import("phaser").Game | null = null;
    let cancelled = false;

    (async () => {
      const Phaser = (await import("phaser")).default;
      const { BattleScene } = await import("./BattleScene");
      if (cancelled || !hostRef.current) return;

      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: hostRef.current,
        width: ARENA_W,
        height: ARENA_H,
        backgroundColor: "#070a14",
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
      });
      game.scene.add("battle", BattleScene, true, { connection });
    })();

    return () => {
      cancelled = true;
      game?.destroy(true);
    };
  }, [connection]);

  return <div ref={hostRef} className="absolute inset-0" />;
}
