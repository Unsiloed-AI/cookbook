import type { CardDefinition, Rarity } from "@arcane-towers/shared";
import { Badge } from "@/components/ui/Badge";
import { CardArt } from "./CardArt";

const RARITY_LABEL: Record<Rarity, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold text-slate-200">{value}</span>
    </div>
  );
}

export function CardTile({ card }: { card: CardDefinition }) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-arcane-border bg-arcane-panel/80 shadow-lg transition-transform duration-200 hover:-translate-y-1 hover:shadow-glow">
      <div className="relative">
        <CardArt
          shape={card.visual.shape}
          primaryColor={card.visual.primaryColor}
          secondaryColor={card.visual.secondaryColor}
          className="aspect-square w-full"
        />
        <div className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-arcane-bg/90 text-sm font-bold text-cyan-300 shadow ring-1 ring-cyan-400/40">
          {card.cost}
        </div>
        <Badge variant={card.rarity} className="absolute right-2 top-2">
          {RARITY_LABEL[card.rarity]}
        </Badge>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-base font-semibold text-slate-100">{card.name}</h3>
          <Badge variant="neutral" className="shrink-0 capitalize">
            {card.category}
          </Badge>
        </div>
        <p className="text-xs leading-relaxed text-slate-400">{card.description}</p>
        <div className="mt-auto space-y-1 border-t border-arcane-border pt-2">
          {card.unit && (
            <>
              <StatRow
                label="Health"
                value={card.unit.spawnCount > 1 ? `${card.unit.health} ×${card.unit.spawnCount}` : card.unit.health}
              />
              <StatRow label="Damage" value={card.unit.damage} />
              <StatRow
                label="Type"
                value={card.unit.stationary ? "Building" : card.unit.attackRange >= 2 ? "Ranged" : "Melee"}
              />
              <StatRow label="Speed" value={card.unit.stationary ? "—" : card.unit.moveSpeed.toFixed(1)} />
            </>
          )}
          {card.spell && (
            <>
              <StatRow label="Damage" value={card.spell.damage} />
              <StatRow label="Radius" value={card.spell.radius} />
              {card.spell.slowFactor && (
                <StatRow label="Slow" value={`${Math.round((1 - card.spell.slowFactor) * 100)}%`} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
