"use client";

import { CARDS, DEFAULT_DECK, getCard, MATCH } from "@arcane/shared";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { GameCard } from "@/components/GameCard";
import { SiteHeader } from "@/components/SiteHeader";
import { Button, LinkButton, Panel } from "@/components/ui";
import { loadDeck, saveDeck } from "@/lib/deck";

export default function DeckPage() {
  const [deck, setDeck] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setDeck(loadDeck());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded && deck.length === MATCH.deckSize) saveDeck(deck);
  }, [deck, loaded]);

  const avgCost = useMemo(() => {
    if (deck.length === 0) return 0;
    const total = deck.reduce((sum, id) => sum + (getCard(id)?.cost ?? 0), 0);
    return total / deck.length;
  }, [deck]);

  const toggleCard = (cardId: string) => {
    setDeck((current) => {
      if (current.includes(cardId)) return current.filter((id) => id !== cardId);
      if (current.length >= MATCH.deckSize) return current;
      return [...current, cardId];
    });
  };

  const isComplete = deck.length === MATCH.deckSize;
  if (!loaded) return <div className="min-h-screen" />;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">Deck Builder</h1>
            <p className="mt-1 text-slate-400">
              Pick exactly {MATCH.deckSize} cards. You battle with a rotating
              hand of {MATCH.handSize}.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setDeck([...DEFAULT_DECK])}>
              Reset to starter
            </Button>
            <LinkButton href="/play" variant="gold" size="sm" aria-disabled={!isComplete}>
              ⚔️ Battle
            </LinkButton>
          </div>
        </div>

        <Panel className="mt-6 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold uppercase tracking-wider text-slate-300">
              Your deck
              <span className={`ml-2 ${isComplete ? "text-grass" : "text-blood"}`}>
                {deck.length}/{MATCH.deckSize}
              </span>
            </h2>
            <span className="text-sm text-slate-400">
              Avg. energy cost:{" "}
              <span className="font-bold text-gold">{avgCost.toFixed(1)}</span>
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {deck.map((id) => (
              <motion.div key={id} layout initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                <GameCard cardId={id} size="md" onClick={() => toggleCard(id)} />
              </motion.div>
            ))}
            {Array.from({ length: MATCH.deckSize - deck.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex aspect-[3/4] w-24 items-center justify-center rounded-xl border-2 border-dashed border-edge text-2xl text-slate-600"
              >
                +
              </div>
            ))}
          </div>
          {!isComplete && (
            <p className="mt-3 text-sm text-blood">
              Add {MATCH.deckSize - deck.length} more card
              {MATCH.deckSize - deck.length === 1 ? "" : "s"} to save your deck.
            </p>
          )}
        </Panel>

        <h2 className="mt-10 font-bold uppercase tracking-wider text-slate-300">
          Collection
        </h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {CARDS.map((card) => (
            <GameCard
              key={card.id}
              cardId={card.id}
              size="md"
              dimmed={deck.includes(card.id)}
              onClick={() => toggleCard(card.id)}
            />
          ))}
        </div>
        <p className="mt-3 text-sm text-slate-500">
          Click a card to add it to your deck, or click a deck card to remove it.
        </p>
      </main>
    </div>
  );
}
