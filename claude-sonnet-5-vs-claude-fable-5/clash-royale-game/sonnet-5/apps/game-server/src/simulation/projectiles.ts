import { distance, opposingSide, type Side } from "@arcane-towers/shared";
import type { BattleState } from "../schema/BattleState.js";
import { ProjectileState } from "../schema/ProjectileState.js";
import { applyDamageToTarget, pruneDeadUnits } from "./combat.js";
import { generateId, resolveTargetPosition } from "./util.js";

export interface SpawnProjectileParams {
  ownerSide: Side;
  from: { x: number; y: number };
  targetId: string;
  speed: number;
  damage: number;
  splashRadius: number;
  cardId: string;
  now: number;
}

/**
 * Server-authoritative, locked-trajectory (non-homing) projectile: the impact
 * point and impact time are fixed at spawn. Both clients see identical hit
 * outcomes with zero desync risk; the client only cosmetically tweens the
 * sprite between the two authoritative points.
 */
export function spawnProjectile(state: BattleState, params: SpawnProjectileParams): void {
  const target = resolveTargetPosition(state, params.targetId);
  if (!target) return;

  const dist = distance(params.from, target);
  const travelMs = params.speed > 0 ? (dist / params.speed) * 1000 : 0;

  const projectile = new ProjectileState();
  projectile.id = generateId("proj");
  projectile.ownerSide = params.ownerSide;
  projectile.cardId = params.cardId;
  projectile.fromX = params.from.x;
  projectile.fromY = params.from.y;
  projectile.toX = target.x;
  projectile.toY = target.y;
  projectile.spawnedAtMs = params.now;
  projectile.willImpactAtMs = params.now + travelMs;
  projectile.damage = params.damage;
  projectile.splashRadius = params.splashRadius;
  projectile.targetId = params.targetId;

  state.projectiles.set(projectile.id, projectile);
}

export function projectilesTick(state: BattleState, now: number): void {
  for (const [id, projectile] of state.projectiles.entries()) {
    if (projectile.willImpactAtMs > now) continue;

    if (projectile.splashRadius > 0) {
      const impactPoint = { x: projectile.toX, y: projectile.toY };
      const enemySide = opposingSide(projectile.ownerSide);
      for (const unit of [...state.units.values()]) {
        if (unit.ownerSide !== enemySide) continue;
        if (distance(unit, impactPoint) <= projectile.splashRadius) {
          applyDamageToTarget(state, unit.id, projectile.damage, projectile.ownerSide);
        }
      }
    } else if (projectile.targetId) {
      applyDamageToTarget(state, projectile.targetId, projectile.damage, projectile.ownerSide);
    }

    state.projectiles.delete(id);
  }

  pruneDeadUnits(state);
}
