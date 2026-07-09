import { ARENA } from "@arcane/shared";
import type { BattleState, UnitState } from "../rooms/schema/BattleState";
import { edgeDistanceTo, isAlive, resolveTarget } from "./helpers";

const ATTACK_EPSILON = 0.15;

/** Nearest bridge x-center to the given x. */
export function nearestBridgeX(x: number): number {
  return ARENA.bridges.reduce((best, bx) =>
    Math.abs(bx - x) < Math.abs(best - x) ? bx : best,
  );
}

function inRiverBand(y: number): boolean {
  return y > ARENA.riverTop && y < ARENA.riverBottom;
}

/**
 * Where the unit should head this tick to eventually reach (tx, ty).
 * Ground units cannot cross the river except over a bridge, so a unit whose
 * target is on the other side routes through the nearest bridge first.
 */
export function waypointFor(
  unit: { x: number; y: number },
  tx: number,
  ty: number,
): { x: number; y: number } {
  const needsCross =
    (unit.y <= ARENA.riverTop && ty >= ARENA.riverBottom) ||
    (unit.y >= ARENA.riverBottom && ty <= ARENA.riverTop);
  if (!needsCross) return { x: tx, y: ty };

  const bx = nearestBridgeX(unit.x);
  if (Math.abs(unit.x - bx) > 0.35) {
    // First line up with the bridge on our own side.
    const entryY =
      unit.y >= ARENA.riverBottom ? ARENA.riverBottom + 0.3 : ARENA.riverTop - 0.3;
    return { x: bx, y: entryY };
  }
  // Then walk straight across.
  const exitY =
    unit.y >= ARENA.riverBottom ? ARENA.riverTop - 0.5 : ARENA.riverBottom + 0.5;
  return { x: bx, y: exitY };
}

function stepTowards(unit: UnitState, wx: number, wy: number, dt: number): void {
  const dx = wx - unit.x;
  const dy = wy - unit.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-4) return;
  const speed = unit.speed * (unit.slowed ? 0.5 : 1);
  const step = Math.min(len, speed * dt);
  unit.x += (dx / len) * step;
  unit.y += (dy / len) * step;

  // While on the river band, stay within the bridge column.
  if (inRiverBand(unit.y)) {
    const bx = nearestBridgeX(unit.x);
    const half = ARENA.bridgeHalfWidth - unit.radius;
    unit.x = Math.min(bx + half, Math.max(bx - half, unit.x));
  }
  unit.x = Math.min(ARENA.width - unit.radius, Math.max(unit.radius, unit.x));
  unit.y = Math.min(ARENA.height - unit.radius, Math.max(unit.radius, unit.y));
}

export function updateMovement(state: BattleState, dt: number): void {
  for (const unit of state.units.values()) {
    if (unit.hp <= 0 || unit.speed === 0) continue;

    const target = resolveTarget(state, unit.targetId);
    if (!target || !isAlive(target)) {
      unit.state = "moving";
      continue; // targeting will re-acquire next tick
    }

    if (edgeDistanceTo(unit, target) <= unit.range + ATTACK_EPSILON) {
      unit.state = "attacking";
      continue;
    }

    unit.state = "moving";
    const wp = waypointFor(unit, target.entity.x, target.entity.y);
    stepTowards(unit, wp.x, wp.y, dt);
  }
}
