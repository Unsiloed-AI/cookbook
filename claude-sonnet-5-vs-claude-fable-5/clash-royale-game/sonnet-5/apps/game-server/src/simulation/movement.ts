import {
  BRIDGE_X_RANGES,
  distance,
  getUnitDefinition,
  moveToward,
  RIVER_Y,
  type Vec2,
} from "@arcane-towers/shared";
import type { BattleState } from "../schema/BattleState.js";
import { resolveTargetPosition } from "./util.js";

const BRIDGE_CENTERS = BRIDGE_X_RANGES.map(([min, max]) => (min + max) / 2);

function isInBridgeXRange(x: number): boolean {
  return BRIDGE_X_RANGES.some(([min, max]) => x >= min && x <= max);
}

function nearestBridgeCenterX(x: number): number {
  let best = BRIDGE_CENTERS[0];
  let bestDist = Math.abs(x - best);
  for (const bx of BRIDGE_CENTERS) {
    const d = Math.abs(x - bx);
    if (d < bestDist) {
      bestDist = d;
      best = bx;
    }
  }
  return best;
}

/**
 * Two-waypoint bridge heuristic: if the unit and its target are on opposite
 * sides of the river and the unit isn't already lined up with a bridge, first
 * walk horizontally to the nearest bridge; otherwise head straight at the
 * target. Simple, but sufficient given one static river and two crossings.
 */
export function getMovementWaypoint(unit: Vec2, target: Vec2): Vec2 {
  const unitOnHostHalf = unit.y > RIVER_Y;
  const targetOnHostHalf = target.y > RIVER_Y;

  if (unitOnHostHalf === targetOnHostHalf || isInBridgeXRange(unit.x)) {
    return target;
  }

  return { x: nearestBridgeCenterX(unit.x), y: unit.y };
}

export function movementTick(state: BattleState, deltaMs: number, now: number): void {
  for (const unit of state.units.values()) {
    const def = getUnitDefinition(unit.cardId);
    if (!def || def.stationary) continue;
    if (!unit.targetId) {
      unit.state = "moving";
      continue;
    }

    const target = resolveTargetPosition(state, unit.targetId);
    if (!target) continue;

    if (distance(unit, target) <= def.attackRange) {
      // Already in range — combat.ts handles the attack, no need to move.
      continue;
    }

    const waypoint = getMovementWaypoint(unit, target);
    const isSlowed = unit.slowedUntilMs > now;
    const speed = def.moveSpeed * (isSlowed ? unit.slowFactor : 1);
    const maxDistance = speed * (deltaMs / 1000);

    const next = moveToward(unit, waypoint, maxDistance);
    unit.x = next.x;
    unit.y = next.y;
    unit.state = "moving";
  }
}
