import { getCardById } from "@arcane-towers/shared";
import { CardArt } from "@/components/cards/CardArt";

export function DeckPreview({ deckCardIds }: { deckCardIds: string[] }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {deckCardIds.map((id) => {
        const card = getCardById(id);
        if (!card) return null;
        return (
          <div key={id} className="flex flex-col items-center gap-1">
            <CardArt
              shape={card.visual.shape}
              primaryColor={card.visual.primaryColor}
              secondaryColor={card.visual.secondaryColor}
              className="aspect-square w-full rounded-lg"
            />
            <span className="w-full truncate text-center text-[10px] text-slate-400">{card.name}</span>
          </div>
        );
      })}
    </div>
  );
}
