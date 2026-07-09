"use client";

import type { MatchMode } from "@arcane/shared";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui";
import { loadDeck } from "@/lib/deck";
import { ensureProfile } from "@/lib/profile";
import { BattleConnection } from "./BattleConnection";
import {
  CountdownOverlay,
  DisconnectedOverlay,
  EmoteBubbles,
  EmotePicker,
  EnergyBar,
  HandView,
  ResultOverlay,
  SearchingOverlay,
  TopBar,
  type EmoteBubble,
} from "./hud";
import { PhaserStage } from "./PhaserStage";

const SERVER_URL =
  process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? "ws://localhost:2567";

export default function BattleClient() {
  const router = useRouter();
  const params = useSearchParams();
  const mode: MatchMode = params.get("mode") === "practice" ? "practice" : "pvp";

  const [conn] = useState(() => new BattleConnection(SERVER_URL));
  const hud = useSyncExternalStore(conn.subscribe, conn.getSnapshot, conn.getSnapshot);
  const [toast, setToast] = useState<string | null>(null);
  const [bubbles, setBubbles] = useState<EmoteBubble[]>([]);
  const bubbleSeq = useRef(0);

  useEffect(() => {
    const profile = ensureProfile();
    void conn.connect(mode, {
      playerId: profile.id,
      name: profile.name,
      deck: loadDeck(),
    });

    const offRejected = conn.on("rejected", (msg) => {
      setToast(msg.reason);
      window.setTimeout(() => setToast(null), 1800);
    });
    const offEmote = conn.on("emote", (msg) => {
      const bubble: EmoteBubble = {
        key: ++bubbleSeq.current,
        emoteId: msg.emoteId,
        mine: msg.playerId === conn.mySessionId,
      };
      setBubbles((prev) => [...prev.slice(-3), bubble]);
      window.setTimeout(
        () => setBubbles((prev) => prev.filter((b) => b.key !== bubble.key)),
        2500,
      );
    });

    return () => {
      offRejected();
      offEmote();
      conn.leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conn, mode]);

  const goDashboard = () => router.push("/dashboard");
  const playAgain = () => window.location.assign(`/battle?mode=${mode}`);
  const cancelSearch = () => {
    conn.leave();
    router.push("/play");
  };

  const roomReady = !["connecting", "error"].includes(hud.status);

  return (
    <div className="flex h-dvh flex-col">
      <TopBar hud={hud} />

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {roomReady && <PhaserStage connection={conn} />}

        <EmoteBubbles bubbles={bubbles} />

        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute left-1/2 top-4 z-40 -translate-x-1/2 rounded-full border border-red-400/40 bg-red-950/90 px-4 py-1.5 text-sm font-semibold text-red-200 shadow-lg"
            >
              ⚠️ {toast}
            </motion.div>
          )}
        </AnimatePresence>

        {hud.status === "connecting" && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400">
            Connecting to the arena…
          </div>
        )}
        {hud.status === "error" && (
          <DisconnectedOverlay
            message={hud.errorMessage ?? "Could not reach the game server."}
            onBack={goDashboard}
          />
        )}
        {hud.status === "disconnected" && (
          <DisconnectedOverlay
            message="The connection to the match was lost."
            onBack={goDashboard}
          />
        )}
        {hud.status === "searching" && <SearchingOverlay mode={mode} onCancel={cancelSearch} />}
        {hud.status === "countdown" && <CountdownOverlay hud={hud} />}
        {hud.status === "finished" && (
          <ResultOverlay hud={hud} mode={mode} onPlayAgain={playAgain} onDashboard={goDashboard} />
        )}
      </div>

      <div className="border-t border-edge bg-panel px-3 pb-3 pt-2">
        <div className="mx-auto max-w-xl">
          <EnergyBar energy={hud.me?.energy ?? 0} overtime={hud.overtime} />
          <div className="mt-2 flex items-end justify-between gap-2">
            <div className="flex flex-col gap-2">
              <EmotePicker onEmote={(id) => conn.sendEmote(id)} />
              <Button
                variant="danger"
                size="sm"
                disabled={hud.status !== "active"}
                onClick={() => conn.surrender()}
              >
                🏳️ Surrender
              </Button>
            </div>
            <HandView
              hud={hud}
              onSelect={(cardId) =>
                conn.setSelectedCard(hud.selectedCardId === cardId ? null : cardId)
              }
            />
            <div className="w-20" />
          </div>
        </div>
      </div>
    </div>
  );
}
