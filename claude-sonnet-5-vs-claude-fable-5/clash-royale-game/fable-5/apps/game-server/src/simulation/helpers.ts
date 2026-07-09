import type {
  BattleState,
  PlayerState,
  TowerState,
  UnitState,
} from "../rooms/schema/BattleState";

/** Anything a unit, tower, spell or projectile can damage. */
export type Targetable =
  | { kind: "unit"; entity: UnitState }
  | { kind: "tower"; entity: TowerState };

export function isAlive(t: Targetable): boolean {
  return t.entity.hp > 0;
}

/** Look up a unit or tower by id across the whole battle state. */
export function resolveTarget(
  state: BattleState,
  id: string,
): Targetable | undefined {
  if (!id) return undefined;
  const unit = state.units.get(id);
  if (unit) return { kind: "unit", entity: unit };
  for (const player of state.players.values()) {
    const tower = player.towers.get(id);
    if (tower) return { kind: "tower", entity: tower };
  }
  return undefined;
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

/** Distance between body edges (used for range checks). */
export function edgeDistance(
  a: { x: number; y: number; radius: number },
  b: { x: number; y: number; radius: number },
): number {
  return Math.max(0, dist(a.x, a.y, b.x, b.y) - a.radius - b.radius);
}

export function edgeDistanceTo(
  a: { x: number; y: number; radius: number },
  t: Targetable,
): number {
  return edgeDistance(a, t.entity);
}

export function opponentOf(
  state: BattleState,
  playerId: string,
): PlayerState | undefined {
  for (const p of state.players.values()) {
    if (p.id !== playerId) return p;
  }
  return undefined;
}

export function livingEnemyUnits(
  state: BattleState,
  ownerId: string,
): UnitState[] {
  const result: UnitState[] = [];
  for (const u of state.units.values()) {
    if (u.ownerId !== ownerId && u.hp > 0) result.push(u);
  }
  return result;
}

export function standingEnemyTowers(
  state: BattleState,
  ownerId: string,
): TowerState[] {
  const result: TowerState[] = [];
  for (const p of state.players.values()) {
    if (p.id === ownerId) continue;
    for (const t of p.towers.values()) {
      if (t.hp > 0) result.push(t);
    }
  }
  return result;
}
