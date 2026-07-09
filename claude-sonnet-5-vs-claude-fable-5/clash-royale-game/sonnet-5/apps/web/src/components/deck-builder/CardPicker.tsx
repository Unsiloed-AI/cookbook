"use client";

import type { CardDefinition } from "@arcane-towers/shared";
import { CardArt } from "@/components/cards/CardArt";
import { cn } from "@/lib/utils";

interface CardPickerProps {
  cards: CardDefinition[];
  selected: string[];
  onToggle: (cardId: string) => void;
}

export function CardPicker({ cards, selected, onToggle }: CardPickerProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {cards.map((card) => {
        const index = selected.indexOf(card.id);
        const isSelected = index !== -1;

        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onToggle(card.id)}
            className={cn(
              "relative flex flex-col overflow-hidden rounded-xl border text-left transition-all duration-150",
              isSelected ? "border-violet-400 shadow-glow" : "border-arcane-border hover:border-slate-500",
            )}
          >
            <CardArt
              shape={card.visual.shape}
              primaryColor={card.visual.primaryColor}
              secondaryColor={card.visual.secondaryColor}
              className="aspect-square w-full"
            />
            <div className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-arcane-bg/90 text-xs font-bold text-cyan-300 ring-1 ring-cyan-400/40">
              {card.cost}
            </div>
            {isSelected && (
              <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white shadow">
                {index + 1}
              </div>
            )}
            <div className={cn("p-2", isSelected ? "bg-violet-950/40" : "bg-arcane-panel/80")}>
              <p className="truncate text-xs font-semibold text-slate-100">{card.name}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
