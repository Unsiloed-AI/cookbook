import {
  ENERGY_MAX,
  ENERGY_REGEN_MS,
  LATE_MATCH_REGEN_MULTIPLIER,
  LATE_MATCH_REGEN_WINDOW_MS,
} from "@arcane-towers/shared";
import type { BattleState } from "../schema/BattleState.js";
import type { PlayerRuntimeMap } from "./types.js";

/**
 * Ms-based accumulator per player — avoids float drift and gives exact
 * "1 energy every 2000ms" behavior regardless of how deltaMs is chunked.
 * Rate doubles once the match timer is inside its final minute.
 */
export function regenTick(state: BattleState, runtime: PlayerRuntimeMap, deltaMs: number): void {
  const rateMultiplier =
    state.matchTimeRemainingMs <= LATE_MATCH_REGEN_WINDOW_MS ? LATE_MATCH_REGEN_MULTIPLIER : 1;

  for (const player of state.players.values()) {
    if (!player.connected) continue;
    const rt = runtime.get(player.sessionId);
    if (!rt) continue;

    rt.energyAccumMs += deltaMs * rateMultiplier;
    while (rt.energyAccumMs >= ENERGY_REGEN_MS && player.energy < ENERGY_MAX) {
      player.energy += 1;
      rt.energyAccumMs -= ENERGY_REGEN_MS;
    }
    if (player.energy >= ENERGY_MAX) {
      rt.energyAccumMs = 0;
    }
  }
}
