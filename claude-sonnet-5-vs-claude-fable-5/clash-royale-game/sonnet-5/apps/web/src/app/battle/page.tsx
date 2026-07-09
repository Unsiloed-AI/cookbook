"use client";

import type { EmoteId } from "@arcane-towers/shared";
import { getStateCallbacks } from "colyseus.js";
import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { EmoteBar } from "@/components/battle/EmoteBar";
import { EnergyBar } from "@/components/battle/EnergyBar";
import { HandUI } from "@/components/battle/HandUI";
import { MatchTimer } from "@/components/battle/MatchTimer";
import { ResultOverlay } from "@/components/battle/ResultOverlay";
import { SurrenderButton } from "@/components/battle/SurrenderButton";
import { TowerHealthHUD } from "@/components/battle/TowerHealthHUD";
import type { ClientResult, ClientTower, PlayerSnapshot } from "@/game/battleTypes";
import { toPlayerSnapshot } from "@/game/battleTypes";
import { DEPLOY_REQUESTED, EventBus, type DeployRequestedPayload } from "@/game/EventBus";
import { useBattleConnectionStore } from "@/store/useBattleConnectionStore";

const BattleCanvasMount = dynamic(
  () => import("@/components/battle/BattleCanvasMount").then((m) => m.BattleCanvasMount),
  { ssr: false },
);

const REJECTION_LABEL: Record<string, string> = {
  matchNotActive: "Battle isn't active",
  invalidPlayer: "You're not in this match",
  invalidHandIndex: "Invalid card",
  unknownCard: "Unknown card",
  insufficientEnergy: "Not enough energy",
  outOfBounds: "Out of bounds",
  invalidSideForTroop: "Must deploy on your side",
};

const EMOTE_GLYPH: Record<EmoteId, string> = {
  gg: "🤝",
  laugh: "😂",
  cry: "😭",
  angry: "😠",
  thanks: "🙏",
};

interface EmoteBubble {
  key: number;
  side: "host" | "guest";
  emoteId: EmoteId;
}

export default function BattlePage() {
  const router = useRouter();
  const room = useBattleConnectionStore((s) => s.room);
  const mySide = useBattleConnectionStore((s) => s.mySide);
  const clearConnection = useBattleConnectionStore((s) => s.clear);

  const [mePlayer, setMePlayer] = useState<PlayerSnapshot | null>(null);
  const [opponentName, setOpponentName] = useState("Opponent");
  const [matchTimeRemainingMs, setMatchTimeRemainingMs] = useState(0);
  const [towers, setTowers] = useState<ClientTower[]>([]);
  const [result, setResult] = useState<ClientResult | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [emoteBubble, setEmoteBubble] = useState<EmoteBubble | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emoteTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!room || !mySide) {
      router.replace("/play");
    }
  }, [room, mySide, router]);

  useEffect(() => {
    if (!room || !mySide) return;

    const opponent = [...room.state.players.values()].find((p) => p.side !== mySide);
    setOpponentName(opponent?.name ?? "Opponent");

    const $ = getStateCallbacks(room);
    const unlistenPhase = $(room.state).listen("phase", (phase) => {
      if (phase === "finished") {
        setResult({
          winnerSide: room.state.result.winnerSide,
          reason: room.state.result.reason,
          endedAtMs: room.state.result.endedAtMs,
        });
      }
    });

    const syncTick = () => {
      const me = room.state.players.get(room.sessionId);
      if (me) setMePlayer(toPlayerSnapshot(me));
      setMatchTimeRemainingMs(room.state.matchTimeRemainingMs);
      setTowers([...room.state.towers.values()]);
    };
    syncTick();
    const interval = setInterval(syncTick, 150);

    const offRejected = room.onMessage("deployRejected", (msg: { reason: string }) => {
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
      setToast(REJECTION_LABEL[msg.reason] ?? "Deploy rejected");
      toastTimeout.current = setTimeout(() => setToast(null), 1800);
    });

    const offEmote = room.onMessage("emote", (msg: { side: "host" | "guest"; emoteId: EmoteId }) => {
      if (emoteTimeout.current) clearTimeout(emoteTimeout.current);
      setEmoteBubble({ key: Date.now(), side: msg.side, emoteId: msg.emoteId });
      emoteTimeout.current = setTimeout(() => setEmoteBubble(null), 2200);
    });

    const handleDeployRequested = (payload: DeployRequestedPayload) => {
      room.send("deployCard", { handIndex: payload.handIndex, x: payload.worldX, y: payload.worldY });
    };
    EventBus.on(DEPLOY_REQUESTED, handleDeployRequested);

    return () => {
      unlistenPhase();
      clearInterval(interval);
      offRejected();
      offEmote();
      EventBus.off(DEPLOY_REQUESTED, handleDeployRequested);
    };
  }, [room, mySide]);

  function handleSurrender() {
    room?.send("surrender", {});
  }

  function handleEmote(emoteId: EmoteId) {
    room?.send("requestEmote", { emoteId });
  }

  function handleReturnToDashboard() {
    room?.leave();
    clearConnection();
  }

  if (!room || !mySide) {
    return (
      <main className="flex min-h-screen items-center justify-center text-slate-400">
        Redirecting to matchmaking…
      </main>
    );
  }

  const opponentSide = mySide === "host" ? "guest" : "host";

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-3 px-4 py-4">
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="font-display text-sm font-semibold text-slate-300" onClick={() => room.leave()}>
          ← Leave
        </Link>
        <MatchTimer remainingMs={matchTimeRemainingMs} />
        <SurrenderButton onConfirm={handleSurrender} />
      </div>

      <TowerHealthHUD towers={towers} side={opponentSide} label="Enemy" />

      <div className="relative flex-1">
        <BattleCanvasMount room={room} mySide={mySide} />

        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full border border-rose-400/50 bg-rose-950/90 px-4 py-1.5 text-xs font-semibold text-rose-200 shadow-lg"
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {emoteBubble && (
            <motion.div
              key={emoteBubble.key}
              initial={{ opacity: 0, scale: 0.5, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.6 }}
              className={cnPosition(emoteBubble.side, mySide)}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-arcane-border bg-arcane-panel text-2xl shadow-glow">
                {EMOTE_GLYPH[emoteBubble.emoteId]}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <TowerHealthHUD towers={towers} side={mySide} label="You" />

      <div className="flex items-center justify-between gap-4">
        <div className="w-40 shrink-0 sm:w-52">
          <EnergyBar energy={mePlayer?.energy ?? 0} />
        </div>
        <EmoteBar onEmote={handleEmote} />
      </div>

      <HandUI hand={mePlayer?.hand ?? []} energy={mePlayer?.energy ?? 0} />

      {result && mePlayer && (
        <ResultOverlay
          result={result}
          mySide={mySide}
          me={mePlayer}
          opponentName={opponentName}
          durationSeconds={Math.round(room.state.elapsedMs / 1000)}
          onNavigate={handleReturnToDashboard}
        />
      )}
    </main>
  );
}

function cnPosition(bubbleSide: "host" | "guest", mySide: "host" | "guest"): string {
  const isMine = bubbleSide === mySide;
  return `absolute ${isMine ? "bottom-4" : "top-4"} left-1/2 -translate-x-1/2`;
}
