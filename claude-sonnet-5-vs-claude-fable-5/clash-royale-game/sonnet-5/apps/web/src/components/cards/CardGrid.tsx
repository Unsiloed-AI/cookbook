import type { CardDefinition } from "@arcane-towers/shared";
import { CardTile } from "./CardTile";

export function CardGrid({ cards }: { cards: CardDefinition[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {cards.map((card) => (
        <CardTile key={card.id} card={card} />
      ))}
    </div>
  );
}
