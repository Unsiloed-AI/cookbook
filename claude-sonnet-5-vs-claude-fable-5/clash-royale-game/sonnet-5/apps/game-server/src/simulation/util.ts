import type { Side } from "@arcane-towers/shared";
import type { BattleState } from "../schema/BattleState.js";
import type { PlayerState } from "../schema/PlayerState.js";

let idCounter = 0;

export function generateId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface ResolvedTarget {
  x: number;
  y: number;
  isTower: boolean;
}

export function resolveTargetPosition(state: BattleState, targetId: string): ResolvedTarget | null {
  const unit = state.units.get(targetId);
  if (unit) return { x: unit.x, y: unit.y, isTower: false };

  const tower = state.towers.get(targetId);
  if (tower && !tower.destroyed) return { x: tower.x, y: tower.y, isTower: true };

  return null;
}

export function isTargetAlive(state: BattleState, targetId: string): boolean {
  if (!targetId) return false;
  if (state.units.has(targetId)) return true;
  const tower = state.towers.get(targetId);
  return !!tower && !tower.destroyed;
}

export function getPlayerBySide(state: BattleState, side: Side): PlayerState | undefined {
  for (const player of state.players.values()) {
    if (player.side === side) return player;
  }
  return undefined;
}
