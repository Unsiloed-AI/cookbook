"use client";

import { getCard } from "@arcane/shared";
import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { GameCard } from "@/components/GameCard";
import { LinkButton, Panel } from "@/components/ui";
import { SiteHeader } from "@/components/SiteHeader";
import { loadDeck } from "@/lib/deck";
import { ensureProfile, type GuestProfile } from "@/lib/profile";

export default function PlayPage() {
  const [profile, setProfile] = useState<GuestProfile | null>(null);
  const [deck, setDeck] = useState<string[]>([]);

  useEffect(() => {
    setProfile(ensureProfile());
    setDeck(loadDeck());
  }, []);

  const avgCost =
    deck.length > 0
      ? (deck.reduce((s, id) => s + (getCard(id)?.cost ?? 0), 0) / deck.length).toFixed(1)
      : "—";

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-12">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-center text-4xl font-black">Choose your battle</h1>
          <p className="mt-2 text-center text-slate-400">
            Fighting as{" "}
            <span className="font-bold text-arcane-bright">{profile?.name ?? "…"}</span>
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <Panel className="flex flex-col items-center p-8 text-center transition-colors hover:border-gold/60">
              <span className="text-5xl">⚔️</span>
              <h2 className="mt-4 text-2xl font-black">Ranked 1v1</h2>
              <p className="mt-2 text-sm text-slate-400">
                Match against another player in real time. Win trophies, climb
                the ladder.
              </p>
              <LinkButton href="/battle?mode=pvp" variant="gold" size="lg" className="mt-6">
                Find Opponent
              </LinkButton>
            </Panel>

            <Panel className="flex flex-col items-center p-8 text-center transition-colors hover:border-arcane/60">
              <span className="text-5xl">🤖</span>
              <h2 className="mt-4 text-2xl font-black">Practice vs Bot</h2>
              <p className="mt-2 text-sm text-slate-400">
                Warm up against the Training Golem. No trophies at stake —
                experiment freely.
              </p>
              <LinkButton href="/battle?mode=practice" variant="primary" size="lg" className="mt-6">
                Start Practice
              </LinkButton>
            </Panel>
          </div>

          <Panel className="mt-8 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold uppercase tracking-wider text-slate-300">
                Battle deck{" "}
                <span className="ml-1 text-sm font-semibold normal-case text-slate-500">
                  avg cost {avgCost}
                </span>
              </h3>
              <Link href="/deck" className="text-sm font-semibold text-arcane-bright hover:underline">
                Edit deck →
              </Link>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {deck.map((id) => (
                <GameCard key={id} cardId={id} size="sm" />
              ))}
            </div>
          </Panel>

          <p className="mt-6 text-center text-sm text-slate-500">
            Tip: open the game in two browser tabs and click{" "}
            <span className="font-semibold text-slate-300">Find Opponent</span>{" "}
            in both to battle yourself locally.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
