import { ENERGY } from "@arcane/shared";
import type { BattleState } from "../rooms/schema/BattleState";

/** Current regen rate — doubles during the final stretch of the match. */
export function energyRegenRate(state: BattleState): number {
  return state.timeRemaining <= ENERGY.overtimeThreshold
    ? ENERGY.overtimeRegenPerSec
    : ENERGY.regenPerSec;
}

export function regenEnergy(state: BattleState, dt: number): void {
  const rate = energyRegenRate(state);
  for (const player of state.players.values()) {
    player.energy = Math.min(ENERGY.max, player.energy + rate * dt);
  }
}
