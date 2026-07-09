import type { CardDefinition } from "@arcane-towers/shared";
import { CardArt } from "@/components/cards/CardArt";

interface DeckSlotProps {
  index: number;
  card?: CardDefinition;
  onRemove?: (cardId: string) => void;
}

export function DeckSlot({ index, card, onRemove }: DeckSlotProps) {
  if (!card) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-arcane-border text-xs text-slate-600">
        {index + 1}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onRemove?.(card.id)}
      className="relative aspect-square overflow-hidden rounded-lg border border-arcane-border"
      title={`Remove ${card.name}`}
    >
      <CardArt
        shape={card.visual.shape}
        primaryColor={card.visual.primaryColor}
        secondaryColor={card.visual.secondaryColor}
        className="h-full w-full"
      />
      <span className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white shadow">
        {index + 1}
      </span>
    </button>
  );
}
