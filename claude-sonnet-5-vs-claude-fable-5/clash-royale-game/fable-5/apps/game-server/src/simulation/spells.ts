import type { CardDef, EffectKind } from "@arcane/shared";
import type { PlayerState } from "../rooms/schema/BattleState";
import type { BattleSimulation } from "./BattleSimulation";
import { dist, livingEnemyUnits } from "./helpers";

const EFFECT_BY_CARD: Record<string, EffectKind> = {
  "flame-burst": "spell-fire",
  "frost-bolt": "spell-frost",
  "thunder-spike": "spell-bolt",
};

/** Apply an instant area spell at (x, y). */
export function castSpell(
  sim: BattleSimulation,
  caster: PlayerState,
  card: CardDef,
  x: number,
  y: number,
): void {
  const spell = card.spell;
  if (!spell) return;

  sim.dealSplashDamage(
    caster.id,
    x,
    y,
    spell.radius,
    spell.damage,
    spell.towerDamageMultiplier,
  );

  if (spell.slowDuration) {
    for (const unit of livingEnemyUnits(sim.state, caster.id)) {
      if (dist(x, y, unit.x, unit.y) - unit.radius <= spell.radius) {
        unit.slowed = true;
        unit.slowUntil = sim.state.simTime + spell.slowDuration;
      }
    }
  }

  sim.events.push({
    type: "effect",
    kind: EFFECT_BY_CARD[card.id] ?? "spell-fire",
    x,
    y,
    radius: spell.radius,
  });
}
