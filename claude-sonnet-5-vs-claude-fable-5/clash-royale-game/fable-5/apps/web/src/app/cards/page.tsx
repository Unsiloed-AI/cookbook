import { CARDS } from "@arcane/shared";
import { CardStats, GameCard, RARITY_COLORS } from "@/components/GameCard";
import { SiteHeader } from "@/components/SiteHeader";
import { Panel } from "@/components/ui";

export const metadata = { title: "Cards — Arcane Towers" };

export default function CardsPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-3xl font-black">Card Library</h1>
        <p className="mt-1 text-slate-400">
          Every card in the game. Pick your favorites in the{" "}
          <a href="/deck" className="text-arcane-bright hover:underline">
            deck builder
          </a>
          .
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((card) => (
            <Panel key={card.id} className="flex gap-4 p-4">
              <GameCard cardId={card.id} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="truncate text-lg font-bold">{card.name}</h2>
                  <span
                    className="shrink-0 text-xs font-black uppercase tracking-wider"
                    style={{ color: RARITY_COLORS[card.rarity] }}
                  >
                    {card.rarity}
                  </span>
                </div>
                <div className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {card.type} · {card.cost} energy
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-slate-400">
                  {card.description}
                </p>
                <div className="mt-2">
                  <CardStats card={card} />
                </div>
              </div>
            </Panel>
          ))}
        </div>
      </main>
    </div>
  );
}
