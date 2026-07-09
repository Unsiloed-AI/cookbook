import { distance, getTowerDefinition, getUnitDefinition, opposingSide } from "@arcane-towers/shared";
import type { BattleState } from "../schema/BattleState.js";
import { isTargetAlive } from "./util.js";

function nearestEnemyUnitId(state: BattleState, from: { x: number; y: number }, enemySide: string): string | null {
  let bestId: string | null = null;
  let bestDist = Infinity;
  for (const unit of state.units.values()) {
    if (unit.ownerSide !== enemySide) continue;
    const d = distance(from, unit);
    if (d < bestDist) {
      bestDist = d;
      bestId = unit.id;
    }
  }
  return bestId;
}

function nearestEnemyTowerId(state: BattleState, from: { x: number; y: number }, enemySide: string): string | null {
  let bestId: string | null = null;
  let bestDist = Infinity;
  for (const tower of state.towers.values()) {
    if (tower.ownerSide !== enemySide || tower.destroyed) continue;
    const d = distance(from, tower);
    if (d < bestDist) {
      bestDist = d;
      bestId = tower.id;
    }
  }
  return bestId;
}

function nearestEnemyUnitInRange(
  state: BattleState,
  from: { x: number; y: number },
  enemySide: string,
  range: number,
): string | null {
  let bestId: string | null = null;
  let bestDist = Infinity;
  for (const unit of state.units.values()) {
    if (unit.ownerSide !== enemySide) continue;
    const d = distance(from, unit);
    if (d <= range && d < bestDist) {
      bestDist = d;
      bestId = unit.id;
    }
  }
  return bestId;
}

/**
 * Sticky targeting: units only re-acquire a target when the current one is
 * gone (dead unit / destroyed tower), avoiding target flip-flopping. Towers
 * re-evaluate every tick since a stationary attacker has no "chase" cost.
 */
export function targetingTick(state: BattleState): void {
  for (const unit of state.units.values()) {
    if (unit.targetId && isTargetAlive(state, unit.targetId)) continue;

    const def = getUnitDefinition(unit.cardId);
    if (!def) continue;
    const enemySide = opposingSide(unit.ownerSide);

    if (def.targeting === "buildingsOnly") {
      unit.targetId = nearestEnemyTowerId(state, unit, enemySide) ?? "";
      continue;
    }

    const nearestUnit = nearestEnemyUnitId(state, unit, enemySide);
    unit.targetId = nearestUnit ?? nearestEnemyTowerId(state, unit, enemySide) ?? "";
  }

  for (const tower of state.towers.values()) {
    if (tower.destroyed) {
      tower.targetId = "";
      continue;
    }

    const def = getTowerDefinition(tower.kind);
    const enemySide = opposingSide(tower.ownerSide);
    const candidate = nearestEnemyUnitInRange(state, tower, enemySide, def.attackRange);

    if (tower.kind === "king" && !tower.activated && candidate) {
      tower.activated = true;
    }

    tower.targetId = tower.activated ? (candidate ?? "") : "";
  }
}
