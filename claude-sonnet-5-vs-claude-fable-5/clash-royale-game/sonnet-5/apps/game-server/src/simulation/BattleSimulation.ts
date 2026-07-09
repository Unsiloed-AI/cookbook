import type { BattleState } from "../schema/BattleState.js";
import { combatTick } from "./combat.js";
import { regenTick } from "./energy.js";
import { movementTick } from "./movement.js";
import { projectilesTick } from "./projectiles.js";
import { pruneExpiredEffects } from "./spells.js";
import { targetingTick } from "./targeting.js";
import type { PlayerRuntimeMap } from "./types.js";
import { checkTick } from "./winConditions.js";

/**
 * Fixed-order tick orchestrator. This is the one place that decides how the
 * simulation's sub-systems compose each frame — every gameplay rule lives in
 * one of the imported modules, kept free of any Colyseus room/schema-class
 * networking concerns so it can be driven directly from tests.
 */
export function tick(state: BattleState, runtime: PlayerRuntimeMap, deltaMs: number): void {
  if (state.phase === "countdown") {
    state.countdownRemainingMs = Math.max(0, state.countdownRemainingMs - deltaMs);
    return;
  }

  if (state.phase !== "active") return;

  const now = Date.now();
  state.elapsedMs += deltaMs;
  state.matchTimeRemainingMs = Math.max(0, state.matchTimeRemainingMs - deltaMs);

  regenTick(state, runtime, deltaMs);
  movementTick(state, deltaMs, now);
  targetingTick(state);
  combatTick(state, deltaMs, now);
  projectilesTick(state, now);
  pruneExpiredEffects(state, now);
  checkTick(state, now);
}
