"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import type { ClientResult, PlayerSnapshot, Side } from "@/game/battleTypes";
import { cn, formatDuration } from "@/lib/utils";

interface ResultOverlayProps {
  result: ClientResult;
  mySide: Side;
  me: PlayerSnapshot;
  opponentName: string;
  durationSeconds: number;
  onNavigate: () => void;
}

const REASON_LABEL: Record<string, string> = {
  towerDestroyed: "King tower destroyed",
  timerExpiry: "Time ran out",
  surrender: "Surrendered",
  disconnect: "Opponent disconnected",
  draw: "Draw",
};

export function ResultOverlay({ result, mySide, me, opponentName, durationSeconds, onNavigate }: ResultOverlayProps) {
  const outcome = result.winnerSide === "draw" ? "draw" : result.winnerSide === mySide ? "win" : "loss";
  const title = outcome === "win" ? "Victory" : outcome === "loss" ? "Defeat" : "Draw";
  const titleColor = outcome === "win" ? "text-emerald-300" : outcome === "loss" ? "text-rose-400" : "text-slate-300";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 20 }}
        className="w-full max-w-md rounded-3xl border border-arcane-border bg-arcane-panel p-8 text-center shadow-2xl"
      >
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">vs {opponentName}</p>
        <h2 className={cn("mt-2 font-display text-5xl font-black", titleColor)}>{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{REASON_LABEL[result.reason] ?? result.reason}</p>

        {me.trophyDelta !== 0 && (
          <p
            className={cn(
              "mt-3 font-display text-2xl font-bold",
              me.trophyDelta > 0 ? "text-amber-300" : "text-rose-400",
            )}
          >
            {me.trophyDelta > 0 ? `+${me.trophyDelta}` : me.trophyDelta} trophies
          </p>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3 text-left">
          <Stat label="Duration" value={formatDuration(durationSeconds)} />
          <Stat label="Towers Destroyed" value={me.stats.towersDestroyed} />
          <Stat label="Cards Played" value={me.stats.cardsPlayed} />
          <Stat label="Damage Dealt" value={Math.round(me.stats.damageDealt)} />
          <Stat label="Energy Spent" value={me.stats.energySpent} />
        </div>

        <div className="mt-8 flex justify-center gap-3">
          <Link href="/dashboard" onClick={onNavigate}>
            <Button variant="secondary">Dashboard</Button>
          </Link>
          <Link href="/play" onClick={onNavigate}>
            <Button variant="gold">Play Again</Button>
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-arcane-border bg-black/20 p-3">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="font-display text-lg font-bold text-slate-100">{value}</p>
    </div>
  );
}
