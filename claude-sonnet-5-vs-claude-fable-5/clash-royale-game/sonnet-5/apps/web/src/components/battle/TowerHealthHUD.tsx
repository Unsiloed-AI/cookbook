import { Progress } from "@/components/ui/Progress";
import type { ClientTower, Side } from "@/game/battleTypes";

interface TowerHealthHUDProps {
  towers: ClientTower[];
  side: Side;
  label: string;
}

export function TowerHealthHUD({ towers, side, label }: TowerHealthHUDProps) {
  const mine = towers
    .filter((t) => t.ownerSide === side)
    .sort((a, b) => (a.kind === b.kind ? a.id.localeCompare(b.id) : a.kind === "king" ? 1 : -1));

  return (
    <div className="flex items-center gap-3 rounded-xl border border-arcane-border bg-arcane-panel/70 px-3 py-2">
      <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <div className="flex flex-1 gap-2">
        {mine.map((tower) => (
          <Progress
            key={tower.id}
            value={tower.destroyed ? 0 : (tower.health / tower.maxHealth) * 100}
            className="flex-1"
            barClassName={tower.kind === "king" ? "from-amber-400 to-amber-600" : "from-violet-500 to-violet-700"}
          />
        ))}
      </div>
    </div>
  );
}
