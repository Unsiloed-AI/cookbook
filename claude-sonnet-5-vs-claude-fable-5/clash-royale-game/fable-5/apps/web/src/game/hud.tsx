"use client";

import { EMOTES, ENERGY, getCard, MATCH, TROPHIES, type MatchMode } from "@arcane/shared";
import { AnimatePresence, motion } from "framer-motion";
import { GameCard } from "@/components/GameCard";
import { Button } from "@/components/ui";
import type { HudSnapshot, PlayerHud } from "./BattleConnection";

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

// ----- top bar ---------------------------------------------------------------

export function TopBar({ hud }: { hud: HudSnapshot }) {
  const { me, opponent, timeRemaining, overtime, status } = hud;
  const urgent = status === "active" && timeRemaining <= 30;
  return (
    <div className="flex items-center justify-between gap-3 border-b border-edge bg-panel px-4 py-2">
      <PlayerBadge player={opponent} enemy placeholder="Waiting…" />
      <div className="text-center">
        <div
          className={`font-mono text-2xl font-black tabular-nums ${
            urgent ? "animate-pulse text-blood" : "text-white"
          }`}
        >
          {status === "active" || status === "finished" ? formatClock(timeRemaining) : "3:00"}
        </div>
        {overtime && status === "active" && (
          <div className="text-[10px] font-black uppercase tracking-widest text-gold">
            ⚡ 2× energy
          </div>
        )}
      </div>
      <PlayerBadge player={me} placeholder="You" alignRight />
    </div>
  );
}

function PlayerBadge({
  player,
  enemy = false,
  alignRight = false,
  placeholder,
}: {
  player: PlayerHud | null;
  enemy?: boolean;
  alignRight?: boolean;
  placeholder: string;
}) {
  const towersAlive = player ? player.towers.filter((t) => t.hp > 0).length : 3;
  return (
    <div className={`min-w-0 flex-1 ${alignRight ? "text-right" : ""}`}>
      <div className="truncate font-bold">
        {enemy ? "🔴" : "🔵"} {player?.name ?? placeholder}
        {player && !player.connected && (
          <span className="ml-2 text-xs font-semibold text-yellow-400">reconnecting…</span>
        )}
      </div>
      <div className="text-xs text-slate-400">
        🏰 {towersAlive}/3 · 👑 {player?.towersDestroyed ?? 0}
      </div>
    </div>
  );
}

// ----- energy + hand -----------------------------------------------------------

export function EnergyBar({ energy, overtime }: { energy: number; overtime: boolean }) {
  const whole = Math.floor(energy);
  const fraction = energy - whole;
  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-fuchsia-300/50 bg-gradient-to-b from-fuchsia-500 to-purple-700 text-sm font-black text-white shadow ${
          overtime ? "animate-pulse" : ""
        }`}
      >
        {whole}
      </span>
      <div className="flex h-4 flex-1 gap-1">
        {Array.from({ length: ENERGY.max }).map((_, i) => (
          <div key={i} className="relative flex-1 overflow-hidden rounded-sm bg-panel-2">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-fuchsia-500 to-purple-500 transition-[width] duration-100"
              style={{ width: i < whole ? "100%" : i === whole ? `${fraction * 100}%` : "0%" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function HandView({
  hud,
  onSelect,
}: {
  hud: HudSnapshot;
  onSelect: (cardId: string) => void;
}) {
  const me = hud.me;
  if (!me) return null;
  const canPlay = hud.status === "active";
  return (
    <div className="flex items-end justify-center gap-2">
      <div className="mr-1 flex flex-col items-center">
        <span className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">
          Next
        </span>
        {me.nextCard ? <GameCard cardId={me.nextCard} size="sm" dimmed /> : null}
      </div>
      {me.hand.map((cardId, i) => {
        const card = getCard(cardId);
        const affordable = !!card && me.energy >= card.cost;
        return (
          <GameCard
            key={`${cardId}-${i}`}
            cardId={cardId}
            size="md"
            selected={hud.selectedCardId === cardId}
            dimmed={!affordable}
            disabled={!canPlay}
            onClick={() => affordable && onSelect(cardId)}
          />
        );
      })}
    </div>
  );
}

// ----- overlays -----------------------------------------------------------------

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-abyss/80 backdrop-blur-sm">
      {children}
    </div>
  );
}

export function SearchingOverlay({ mode, onCancel }: { mode: MatchMode; onCancel: () => void }) {
  return (
    <Overlay>
      <motion.div
        className="text-6xl"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 2.4, ease: "linear" }}
      >
        🔮
      </motion.div>
      <h2 className="mt-6 text-2xl font-black">
        {mode === "pvp" ? "Searching for opponent…" : "Preparing battle…"}
      </h2>
      {mode === "pvp" && (
        <p className="mt-2 max-w-xs text-center text-sm text-slate-400">
          Waiting for another challenger. Open a second browser tab and hit
          Play to battle yourself.
        </p>
      )}
      <Button variant="ghost" className="mt-8" onClick={onCancel}>
        Cancel
      </Button>
    </Overlay>
  );
}

export function CountdownOverlay({ hud }: { hud: HudSnapshot }) {
  return (
    <Overlay>
      <p className="text-lg font-bold text-slate-300">
        ⚔️ {hud.opponent ? `Opponent found: ${hud.opponent.name}` : "Opponent found!"}
      </p>
      <AnimatePresence mode="popLayout">
        <motion.div
          key={hud.countdown}
          initial={{ scale: 2.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="mt-4 text-8xl font-black text-gold"
        >
          {hud.countdown > 0 ? hud.countdown : "GO!"}
        </motion.div>
      </AnimatePresence>
    </Overlay>
  );
}

export function DisconnectedOverlay({
  message,
  onBack,
}: {
  message: string;
  onBack: () => void;
}) {
  return (
    <Overlay>
      <span className="text-5xl">🔌</span>
      <h2 className="mt-4 text-2xl font-black">Connection lost</h2>
      <p className="mt-2 max-w-sm text-center text-sm text-slate-400">{message}</p>
      <Button className="mt-8" onClick={onBack}>
        Back to Dashboard
      </Button>
    </Overlay>
  );
}

export function ResultOverlay({
  hud,
  mode,
  onPlayAgain,
  onDashboard,
}: {
  hud: HudSnapshot;
  mode: MatchMode;
  onPlayAgain: () => void;
  onDashboard: () => void;
}) {
  const me = hud.me;
  const opponent = hud.opponent;
  const isDraw = hud.winnerId === "";
  const won = !isDraw && hud.winnerId === me?.id;

  const title = isDraw ? "Draw" : won ? "Victory!" : "Defeat";
  const titleClass = isDraw ? "text-slate-300" : won ? "text-gold" : "text-blood";
  const subtitle = describeEnd(hud, won, isDraw);
  const duration = MATCH.durationSec - hud.timeRemaining;
  const trophyDelta = mode === "pvp" ? (isDraw ? 0 : won ? TROPHIES.win : TROPHIES.loss) : 0;

  return (
    <Overlay>
      <motion.div
        initial={{ scale: 0.7, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0.4 }}
        className="w-full max-w-md rounded-2xl border border-edge bg-panel p-8 text-center shadow-2xl"
      >
        <div className="text-6xl">{isDraw ? "🤝" : won ? "🏆" : "💀"}</div>
        <h2 className={`mt-3 text-5xl font-black ${titleClass}`}>{title}</h2>
        <p className="mt-2 text-sm text-slate-400">{subtitle}</p>
        {mode === "pvp" && !isDraw && (
          <p className={`mt-1 text-lg font-black ${won ? "text-grass" : "text-blood"}`}>
            {trophyDelta > 0 ? "+" : ""}
            {trophyDelta} 🏆
          </p>
        )}

        <div className="mt-6 grid grid-cols-3 gap-y-2 rounded-xl bg-panel-2 p-4 text-sm">
          <div className="text-left font-bold text-arcane-bright">{me?.name ?? "You"}</div>
          <div className="text-xs uppercase tracking-wider text-slate-500" />
          <div className="text-right font-bold text-blood">{opponent?.name ?? "Opponent"}</div>
          <StatRow label="Towers" a={me?.towersDestroyed} b={opponent?.towersDestroyed} />
          <StatRow label="Damage" a={me?.damageDealt} b={opponent?.damageDealt} />
          <StatRow label="Cards" a={me?.cardsPlayed} b={opponent?.cardsPlayed} />
          <StatRow label="Energy" a={me?.energySpent} b={opponent?.energySpent} />
          <div className="col-span-3 mt-1 border-t border-edge pt-2 text-xs text-slate-500">
            Match duration {formatClock(duration)}
          </div>
        </div>

        <div className="mt-6 flex justify-center gap-3">
          <Button variant="ghost" onClick={onDashboard}>
            Dashboard
          </Button>
          <Button variant="gold" onClick={onPlayAgain}>
            ⚔️ Play Again
          </Button>
        </div>
      </motion.div>
    </Overlay>
  );
}

function StatRow({ label, a, b }: { label: string; a?: number; b?: number }) {
  return (
    <>
      <div className="text-left font-semibold tabular-nums">{fmt(a)}</div>
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-right font-semibold tabular-nums">{fmt(b)}</div>
    </>
  );
}

function fmt(n?: number): string {
  if (n === undefined) return "—";
  return n >= 10000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n)}`;
}

function describeEnd(hud: HudSnapshot, won: boolean, isDraw: boolean): string {
  switch (hud.endReason) {
    case "main-tower":
      return won ? "You destroyed the enemy citadel!" : "Your citadel has fallen.";
    case "timeout":
      return "Time's up — tower score decides the winner.";
    case "surrender":
      return won ? "Your opponent surrendered." : "You surrendered.";
    case "disconnect":
      return won ? "Your opponent left the match." : "You left the match.";
    case "draw":
      return "Perfectly matched — nobody blinked.";
    default:
      return isDraw ? "An even fight." : "";
  }
}

// ----- emotes -------------------------------------------------------------------

export function EmotePicker({ onEmote }: { onEmote: (id: number) => void }) {
  return (
    <div className="flex gap-1">
      {EMOTES.map((emoji, i) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onEmote(i)}
          className="cursor-pointer rounded-lg border border-edge bg-panel-2 px-2 py-1 text-lg transition-transform hover:scale-110"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

export interface EmoteBubble {
  key: number;
  emoteId: number;
  mine: boolean;
}

export function EmoteBubbles({ bubbles }: { bubbles: EmoteBubble[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <AnimatePresence>
        {bubbles.map((b) => (
          <motion.div
            key={b.key}
            initial={{ opacity: 0, scale: 0.4, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className={`absolute ${
              b.mine ? "bottom-10 right-6" : "left-6 top-10"
            } rounded-2xl border border-edge bg-panel px-3 py-2 text-3xl shadow-xl`}
          >
            {EMOTES[b.emoteId] ?? "👍"}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
