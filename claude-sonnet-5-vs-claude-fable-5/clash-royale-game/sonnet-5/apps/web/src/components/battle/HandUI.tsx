"use client";

import { getCardById } from "@arcane-towers/shared";
import { useEffect, useState } from "react";
import { CardArt } from "@/components/cards/CardArt";
import { CARD_DESELECTED, CARD_SELECTED, DEPLOY_REQUESTED, EventBus } from "@/game/EventBus";
import { cn } from "@/lib/utils";

interface HandUIProps {
  hand: string[];
  energy: number;
}

export function HandUI({ hand, energy }: HandUIProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    const clear = () => setSelectedIndex(null);
    EventBus.on(DEPLOY_REQUESTED, clear);
    return () => {
      EventBus.off(DEPLOY_REQUESTED, clear);
    };
  }, []);

  function handleClick(index: number, cardId: string) {
    const card = getCardById(cardId);
    if (!card) return;

    if (selectedIndex === index) {
      setSelectedIndex(null);
      EventBus.emit(CARD_DESELECTED);
      return;
    }

    if (energy < card.cost) return;

    setSelectedIndex(index);
    EventBus.emit(CARD_SELECTED, { handIndex: index, cardId });
  }

  return (
    <div className="flex justify-center gap-2">
      {hand.map((cardId, index) => {
        const card = getCardById(cardId);
        if (!card) return null;
        const affordable = energy >= card.cost;
        const isSelected = selectedIndex === index;

        return (
          <button
            key={`${cardId}-${index}`}
            type="button"
            onClick={() => handleClick(index, cardId)}
            disabled={!affordable}
            className={cn(
              "relative flex h-20 w-16 flex-col overflow-hidden rounded-lg border-2 transition-all duration-150 sm:h-24 sm:w-[76px]",
              isSelected ? "-translate-y-2 border-amber-400 shadow-glow" : "border-arcane-border",
              !affordable && "grayscale opacity-40",
            )}
          >
            <CardArt
              shape={card.visual.shape}
              primaryColor={card.visual.primaryColor}
              secondaryColor={card.visual.secondaryColor}
              className="h-full w-full"
            />
            <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[10px] font-bold text-cyan-300">
              {card.cost}
            </span>
          </button>
        );
      })}
    </div>
  );
}
