"use client";

import { getCard, type CardDef, type Rarity } from "@arcane/shared";

export const RARITY_COLORS: Record<Rarity, string> = {
  common: "#9aa5b1",
  rare: "#6ec9f5",
  epic: "#b46ef5",
  legendary: "#f5c95c",
};

const SIZES = {
  sm: { w: "w-16", icon: "text-2xl", name: "text-[9px]", cost: "h-5 w-5 text-[11px]" },
  md: { w: "w-24", icon: "text-4xl", name: "text-[11px]", cost: "h-6 w-6 text-sm" },
  lg: { w: "w-32", icon: "text-5xl", name: "text-sm", cost: "h-7 w-7 text-base" },
};

export function GameCard({
  cardId,
  size = "md",
  selected = false,
  disabled = false,
  dimmed = false,
  onClick,
}: {
  cardId: string;
  size?: keyof typeof SIZES;
  selected?: boolean;
  disabled?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
}) {
  const card = getCard(cardId);
  if (!card) return null;
  const s = SIZES[size];
  const rarity = RARITY_COLORS[card.rarity];
  const cardColor = `#${card.color.toString(16).padStart(6, "0")}`;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group relative ${s.w} aspect-[3/4] shrink-0 rounded-xl border-2 transition-all duration-150
        ${onClick && !disabled ? "cursor-pointer hover:-translate-y-1" : ""}
        ${selected ? "-translate-y-2 shadow-lg shadow-arcane/50" : ""}
        ${dimmed ? "opacity-40 saturate-50" : ""}
        ${disabled ? "cursor-not-allowed" : ""}`}
      style={{
        borderColor: selected ? "#a99cff" : rarity,
        background: `linear-gradient(160deg, ${cardColor}33 0%, #0e1322 55%, ${rarity}22 100%)`,
      }}
      title={`${card.name} — ${card.description}`}
    >
      <span
        className={`absolute -left-1.5 -top-1.5 z-10 flex ${s.cost} items-center justify-center rounded-full border border-yellow-200/60 bg-gradient-to-b from-gold to-[#c99a2e] font-black text-[#2a1f05] shadow`}
      >
        {card.cost}
      </span>
      <span
        className={`flex h-full w-full flex-col items-center justify-center gap-1 ${s.icon}`}
      >
        <span className="drop-shadow-lg transition-transform duration-150 group-hover:scale-110">
          {card.icon}
        </span>
      </span>
      <span
        className={`absolute inset-x-0 bottom-0 rounded-b-[10px] bg-black/60 px-1 py-0.5 text-center font-bold leading-tight text-slate-100 ${s.name}`}
      >
        {card.name}
      </span>
    </button>
  );
}

/** Compact stat chips used on the cards page and deck builder. */
export function CardStats({ card }: { card: CardDef }) {
  const chips: Array<[string, string | number]> = [];
  if (card.unit) {
    chips.push(["❤️", card.unit.health], ["⚔️", card.unit.damage]);
    if (card.unit.range > 1) chips.push(["🎯", card.unit.range]);
    if (card.unit.speed > 0) chips.push(["👟", card.unit.speed]);
    if (card.unit.count > 1) chips.push(["👥", `×${card.unit.count}`]);
    if (card.unit.lifetime) chips.push(["⏳", `${card.unit.lifetime}s`]);
  }
  if (card.spell) {
    chips.push(["💥", card.spell.damage], ["⭕", card.spell.radius]);
    if (card.spell.slowDuration) chips.push(["🐌", `${card.spell.slowDuration}s`]);
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map(([icon, value]) => (
        <span
          key={icon}
          className="rounded-md bg-panel-2 px-1.5 py-0.5 text-xs font-semibold text-slate-300"
        >
          {icon} {value}
        </span>
      ))}
    </div>
  );
}
