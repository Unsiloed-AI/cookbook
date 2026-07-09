import type { BattleSimulation } from "./BattleSimulation";
import {
  edgeDistanceTo,
  isAlive,
  livingEnemyUnits,
  resolveTarget,
} from "./helpers";

const ATTACK_EPSILON = 0.15;
const PROJECTILE_HIT_DISTANCE = 0.35;
const TOWER_PROJECTILE_SPEED = 11;

/** Units and buildings swing/shoot at their targets. */
function updateUnitAttacks(sim: BattleSimulation, dt: number): void {
  const { state } = sim;
  for (const unit of state.units.values()) {
    unit.cooldown = Math.max(0, unit.cooldown - dt);
    if (unit.hp <= 0) continue;

    const target = resolveTarget(state, unit.targetId);
    if (!target || !isAlive(target)) continue;
    if (edgeDistanceTo(unit, target) > unit.range + ATTACK_EPSILON) continue;

    unit.state = "attacking";
    if (unit.cooldown > 0) continue;
    unit.cooldown = unit.attackInterval;

    if (unit.projectileSpeed > 0) {
      sim.spawnProjectile({
        ownerId: unit.ownerId,
        cardId: unit.cardId,
        x: unit.x,
        y: unit.y,
        targetId: target.entity.id,
        damage: unit.damage,
        speed: unit.projectileSpeed,
        splashRadius: unit.splashRadius,
      });
    } else {
      sim.dealDamage(unit.ownerId, target, unit.damage);
    }
  }
}

/** Towers shoot the nearest enemy troop in range. */
function updateTowerAttacks(sim: BattleSimulation, dt: number): void {
  const { state } = sim;
  for (const player of state.players.values()) {
    for (const tower of player.towers.values()) {
      tower.cooldown = Math.max(0, tower.cooldown - dt);
      if (tower.hp <= 0) continue;

      let nearest = null as ReturnType<typeof livingEnemyUnits>[number] | null;
      let nearestDist = Infinity;
      for (const enemy of livingEnemyUnits(state, player.id)) {
        const d = edgeDistanceTo(tower, { kind: "unit", entity: enemy });
        if (d <= tower.range && d < nearestDist) {
          nearest = enemy;
          nearestDist = d;
        }
      }
      if (!nearest || tower.cooldown > 0) continue;

      tower.cooldown = tower.attackInterval;
      sim.spawnProjectile({
        ownerId: player.id,
        cardId: "tower",
        x: tower.x,
        y: tower.y,
        targetId: nearest.id,
        damage: tower.damage,
        speed: TOWER_PROJECTILE_SPEED,
        splashRadius: 0,
      });
    }
  }
}

/** Homing projectiles fly toward their target and hit on contact. */
function updateProjectiles(sim: BattleSimulation, dt: number): void {
  const { state } = sim;
  for (const proj of [...state.projectiles.values()]) {
    const target = resolveTarget(state, proj.targetId);
    if (!target || !isAlive(target)) {
      state.projectiles.delete(proj.id);
      continue;
    }
    const tx = target.entity.x;
    const ty = target.entity.y;
    const dx = tx - proj.x;
    const dy = ty - proj.y;
    const len = Math.hypot(dx, dy);
    const step = proj.speed * dt;

    if (len - target.entity.radius <= Math.max(step, PROJECTILE_HIT_DISTANCE)) {
      if (proj.splashRadius > 0) {
        sim.dealSplashDamage(proj.ownerId, tx, ty, proj.splashRadius, proj.damage, 1);
      } else {
        sim.dealDamage(proj.ownerId, target, proj.damage);
      }
      state.projectiles.delete(proj.id);
      continue;
    }
    proj.x += (dx / len) * step;
    proj.y += (dy / len) * step;
  }
}

export function updateCombat(sim: BattleSimulation, dt: number): void {
  updateUnitAttacks(sim, dt);
  updateTowerAttacks(sim, dt);
  updateProjectiles(sim, dt);
}
