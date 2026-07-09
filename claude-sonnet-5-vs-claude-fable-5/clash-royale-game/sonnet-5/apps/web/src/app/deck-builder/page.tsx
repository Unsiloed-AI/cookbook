"use client";

import { useEffect, useState } from "react";
import { CARD_DEFINITIONS, DECK_SIZE, getCardById } from "@arcane-towers/shared";
import { CardPicker } from "@/components/deck-builder/CardPicker";
import { DeckSlot } from "@/components/deck-builder/DeckSlot";
import { HandCycleExplainer } from "@/components/deck-builder/HandCycleExplainer";
import { PageFade } from "@/components/PageFade";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { fetchPlayerProfile, saveDeck } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useIdentityStore } from "@/store/useIdentityStore";

export default function DeckBuilderPage() {
  const identity = useIdentityStore((s) => s.identity);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!identity) return;
    fetchPlayerProfile(identity.playerId)
      .then((p) => setSelected(p.deckCardIds))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [identity]);

  function toggleCard(cardId: string) {
    setMessage(null);
    setSelected((prev) => {
      if (prev.includes(cardId)) return prev.filter((id) => id !== cardId);
      if (prev.length >= DECK_SIZE) return prev;
      return [...prev, cardId];
    });
  }

  async function handleSave() {
    if (!identity || selected.length !== DECK_SIZE) return;
    setSaving(true);
    setMessage(null);
    try {
      await saveDeck(identity.playerId, selected);
      setMessage("Deck saved!");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to save deck");
    } finally {
      setSaving(false);
    }
  }

  const isComplete = selected.length === DECK_SIZE;

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <SiteHeader />
      <PageFade>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-slate-100">Deck Builder</h1>
            <p className="mt-1 text-slate-400">Choose exactly 8 cards. Selection order sets your battle cycle.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn("text-sm font-semibold", isComplete ? "text-emerald-400" : "text-slate-400")}>
              {selected.length}/{DECK_SIZE}
            </span>
            <Button variant="gold" disabled={!isComplete || saving} onClick={handleSave}>
              {saving ? "Saving..." : "Save Deck"}
            </Button>
          </div>
        </div>
        {message && <p className="mt-2 text-sm text-cyan-300">{message}</p>}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            {loading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square" />
                ))}
              </div>
            ) : (
              <CardPicker cards={CARD_DEFINITIONS} selected={selected} onToggle={toggleCard} />
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Your Deck</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: DECK_SIZE }).map((_, i) => (
                    <DeckSlot
                      key={i}
                      index={i}
                      card={selected[i] ? getCardById(selected[i]) : undefined}
                      onRemove={toggleCard}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
            <HandCycleExplainer />
          </div>
        </div>
      </PageFade>
    </main>
  );
}
