import { distance, getTowerDefinition, getUnitDefinition, type Side } from "@arcane-towers/shared";
import type { BattleState } from "../schema/BattleState.js";
import { spawnProjectile } from "./projectiles.js";
import { getPlayerBySide, resolveTargetPosition } from "./util.js";

const RANGE_EPSILON = 0.05;

function recordDamage(state: BattleState, side: Side, amount: number): void {
  if (amount <= 0) return;
  const player = getPlayerBySide(state, side);
  if (player) player.stats.damageDealt += amount;
}

/**
 * Applies clamped damage to a unit or (non-destroyed) tower, tracking the
 * attacking side's damage-dealt stat and any resulting tower destruction.
 * Returns the actual (clamped) damage applied.
 */
export function applyDamageToTarget(
  state: BattleState,
  targetId: string,
  rawDamage: number,
  attackerSide: Side,
  towerDamageMultiplier = 1,
): number {
  const unit = state.units.get(targetId);
  if (unit) {
    const clamped = Math.min(rawDamage, unit.health);
    unit.health -= clamped;
    recordDamage(state, attackerSide, clamped);
    return clamped;
  }

  const tower = state.towers.get(targetId);
  if (tower && !tower.destroyed) {
    if (!tower.activated) tower.activated = true;
    const dmg = rawDamage * towerDamageMultiplier;
    const clamped = Math.min(dmg, tower.health);
    tower.health -= clamped;
    recordDamage(state, attackerSide, clamped);
    if (tower.health <= 0) {
      tower.destroyed = true;
      const attacker = getPlayerBySide(state, attackerSide);
      if (attacker) attacker.stats.towersDestroyed += 1;
    }
    return clamped;
  }

  return 0;
}

export function pruneDeadUnits(state: BattleState): void {
  for (const [id, unit] of state.units.entries()) {
    if (unit.health <= 0) state.units.delete(id);
  }
}

export function combatTick(state: BattleState, deltaMs: number, now: number): void {
  for (const unit of state.units.values()) {
    unit.attackCooldownRemainingMs = Math.max(0, unit.attackCooldownRemainingMs - deltaMs);

    if (!unit.targetId) {
      unit.state = "moving";
      continue;
    }

    const def = getUnitDefinition(unit.cardId);
    if (!def) continue;

    const target = resolveTargetPosition(state, unit.targetId);
    if (!target) {
      unit.targetId = "";
      unit.state = "moving";
      continue;
    }

    if (distance(unit, target) > def.attackRange + RANGE_EPSILON) {
      unit.state = "moving";
      continue;
    }

    unit.state = "attacking";
    if (unit.attackCooldownRemainingMs > 0) continue;
    unit.attackCooldownRemainingMs = def.attackSpeedMs;

    if (def.projectileSpeed) {
      spawnProjectile(state, {
        ownerSide: unit.ownerSide,
        from: unit,
        targetId: unit.targetId,
        speed: def.projectileSpeed,
        damage: def.damage,
        splashRadius: def.splashRadius ?? 0,
        cardId: unit.cardId,
        now,
      });
    } else {
      applyDamageToTarget(state, unit.targetId, def.damage, unit.ownerSide);
    }
  }

  for (const tower of state.towers.values()) {
    if (tower.destroyed || !tower.activated) continue;
    tower.attackCooldownRemainingMs = Math.max(0, tower.attackCooldownRemainingMs - deltaMs);

    if (!tower.targetId || !state.units.has(tower.targetId)) {
      tower.targetId = "";
      continue;
    }
    if (tower.attackCooldownRemainingMs > 0) continue;

    const def = getTowerDefinition(tower.kind);
    tower.attackCooldownRemainingMs = def.attackSpeedMs;
    applyDamageToTarget(state, tower.targetId, def.damage, tower.ownerSide);
  }

  pruneDeadUnits(state);
}
