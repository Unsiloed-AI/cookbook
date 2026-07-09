"use client";

import { TROPHIES } from "@arcane/shared";
import { motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { GameCard } from "@/components/GameCard";
import { SiteHeader } from "@/components/SiteHeader";
import { Button, LinkButton, Panel, StatCard } from "@/components/ui";
import { loadDeck } from "@/lib/deck";
import { ensureProfile, saveProfile, syncProfile, type GuestProfile } from "@/lib/profile";

interface PlayerRow {
  trophies: number;
  wins: number;
  losses: number;
  draws: number;
}

interface MatchRow {
  id: string;
  mode: string;
  result: string;
  trophyDelta: number;
  opponentName: string;
  durationSec: number;
  endReason: string;
  createdAt: string;
  towersDestroyed: number;
  towersLost: number;
}

const RESULT_STYLES: Record<string, { label: string; className: string }> = {
  win: { label: "Victory", className: "text-grass" },
  loss: { label: "Defeat", className: "text-blood" },
  draw: { label: "Draw", className: "text-slate-400" },
};

export default function DashboardPage() {
  const [profile, setProfile] = useState<GuestProfile | null>(null);
  const [stats, setStats] = useState<PlayerRow | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [dbOffline, setDbOffline] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [deck, setDeck] = useState<string[]>([]);

  const refresh = useCallback(async (id: string) => {
    try {
      const [playerRes, matchesRes] = await Promise.all([
        fetch(`/api/players/${id}`).then((r) => r.json()),
        fetch(`/api/players/${id}/matches`).then((r) => r.json()),
      ]);
      if (playerRes.dbOffline || matchesRes.dbOffline) setDbOffline(true);
      if (playerRes.player) setStats(playerRes.player);
      setMatches(matchesRes.matches ?? []);
    } catch {
      setDbOffline(true);
    }
  }, []);

  useEffect(() => {
    const p = ensureProfile();
    setProfile(p);
    setNameDraft(p.name);
    setDeck(loadDeck());
    void refresh(p.id);
  }, [refresh]);

  const commitName = async () => {
    if (!profile) return;
    const name = nameDraft.trim().slice(0, 20);
    if (name.length === 0) return setEditingName(false);
    const updated = { ...profile, name };
    saveProfile(updated);
    setProfile(updated);
    setEditingName(false);
    await syncProfile(updated);
    void refresh(updated.id);
  };

  const trophies = stats?.trophies ?? TROPHIES.start;
  const wins = stats?.wins ?? 0;
  const losses = stats?.losses ?? 0;
  const total = wins + losses + (stats?.draws ?? 0);
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-4xl">🛡️</span>
                {editingName ? (
                  <span className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={nameDraft}
                      maxLength={20}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && commitName()}
                      className="rounded-lg border border-arcane bg-panel-2 px-3 py-1 text-2xl font-black outline-none"
                    />
                    <Button size="sm" onClick={commitName}>
                      Save
                    </Button>
                  </span>
                ) : (
                  <h1
                    className="cursor-pointer text-3xl font-black hover:text-arcane-bright"
                    title="Click to rename"
                    onClick={() => setEditingName(true)}
                  >
                    {profile?.name ?? "…"} <span className="text-base">✏️</span>
                  </h1>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Guest profile · stats update after every match
              </p>
            </div>
            <div className="flex gap-3">
              <LinkButton href="/deck" variant="ghost">
                🃏 Edit Deck
              </LinkButton>
              <LinkButton href="/play" variant="gold" size="lg">
                ⚔️ Play
              </LinkButton>
            </div>
          </div>

          {dbOffline && (
            <Panel className="mt-4 border-yellow-600/50 bg-yellow-950/30 p-3 text-sm text-yellow-200">
              ⚠️ Database is unreachable — stats and history are unavailable.
              Battles still work! Start Postgres with{" "}
              <code className="rounded bg-black/40 px-1">pnpm db:up</code>.
            </Panel>
          )}

          <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon="🏆" label="Trophies" value={trophies} accent="text-gold" />
            <StatCard icon="✅" label="Wins" value={wins} accent="text-grass" />
            <StatCard icon="❌" label="Losses" value={losses} accent="text-blood" />
            <StatCard icon="📈" label="Win rate" value={`${winRate}%`} />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-5">
            <Panel className="p-5 lg:col-span-3">
              <h2 className="font-bold uppercase tracking-wider text-slate-300">
                Recent matches
              </h2>
              {matches.length === 0 ? (
                <p className="mt-6 pb-4 text-center text-slate-500">
                  No matches yet.{" "}
                  <Link href="/play" className="text-arcane-bright hover:underline">
                    Play your first battle →
                  </Link>
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-edge">
                  {matches.map((m) => {
                    const style = RESULT_STYLES[m.result] ?? RESULT_STYLES.draw;
                    return (
                      <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <span className={`font-black ${style.className}`}>{style.label}</span>
                          <span className="ml-2 text-sm text-slate-400">
                            vs {m.opponentName}
                            {m.mode === "practice" && " (practice)"}
                          </span>
                          <div className="text-xs text-slate-500">
                            {formatDuration(m.durationSec)} · 🏰 {m.towersDestroyed}–{m.towersLost} ·{" "}
                            {formatDate(m.createdAt)}
                          </div>
                        </div>
                        {m.mode === "pvp" && (
                          <span
                            className={`shrink-0 text-sm font-bold ${
                              m.trophyDelta > 0
                                ? "text-grass"
                                : m.trophyDelta < 0
                                  ? "text-blood"
                                  : "text-slate-500"
                            }`}
                          >
                            {m.trophyDelta > 0 ? "+" : ""}
                            {m.trophyDelta} 🏆
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>

            <Panel className="p-5 lg:col-span-2">
              <div className="flex items-center justify-between">
                <h2 className="font-bold uppercase tracking-wider text-slate-300">
                  Battle deck
                </h2>
                <Link href="/deck" className="text-sm font-semibold text-arcane-bright hover:underline">
                  Edit →
                </Link>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {deck.map((id) => (
                  <GameCard key={id} cardId={id} size="sm" />
                ))}
              </div>
            </Panel>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
