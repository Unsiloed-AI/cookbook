import type { BattleState, UnitState } from "../rooms/schema/BattleState";
import {
  edgeDistanceTo,
  isAlive,
  livingEnemyUnits,
  resolveTarget,
  standingEnemyTowers,
  type Targetable,
} from "./helpers";

/** Whether `unit` is allowed to attack `target` at all (ignores range). */
export function canAttack(unit: UnitState, target: Targetable): boolean {
  if (unit.isBuilding && target.kind === "tower") {
    // Defensive buildings only shoot troops, never towers.
    return false;
  }
  if (unit.targets === "buildings") {
    return (
      target.kind === "tower" ||
      (target.kind === "unit" && target.entity.isBuilding)
    );
  }
  return true;
}

/**
 * Choose the best target for a unit:
 *  - nearest attackable enemy unit within sight, otherwise
 *  - nearest standing enemy tower (troops only — buildings never chase).
 */
export function pickTarget(
  state: BattleState,
  unit: UnitState,
): Targetable | undefined {
  let best: Targetable | undefined;
  let bestDist = Infinity;

  for (const enemy of livingEnemyUnits(state, unit.ownerId)) {
    const candidate: Targetable = { kind: "unit", entity: enemy };
    if (!canAttack(unit, candidate)) continue;
    const d = edgeDistanceTo(unit, candidate);
    if (d <= unit.sight && d < bestDist) {
      best = candidate;
      bestDist = d;
    }
  }
  if (best) return best;
  if (unit.isBuilding) return undefined;

  for (const tower of standingEnemyTowers(state, unit.ownerId)) {
    const candidate: Targetable = { kind: "tower", entity: tower };
    const d = edgeDistanceTo(unit, candidate);
    if (d < bestDist) {
      best = candidate;
      bestDist = d;
    }
  }
  return best;
}

/** Re-validate or re-acquire every unit's target. */
export function updateTargeting(state: BattleState): void {
  for (const unit of state.units.values()) {
    if (unit.hp <= 0) continue;

    const current = resolveTarget(state, unit.targetId);
    if (current && isAlive(current) && canAttack(unit, current)) {
      const d = edgeDistanceTo(unit, current);
      const keep = unit.isBuilding
        ? d <= unit.sight
        : current.kind === "tower" || d <= unit.sight * 1.6;
      if (keep) continue;
    }

    unit.targetId = pickTarget(state, unit)?.entity.id ?? "";
  }
}
