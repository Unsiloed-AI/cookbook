import type { MatchEndReason, Side } from "@arcane-towers/shared";
import type { BattleState } from "../schema/BattleState.js";

function findTower(state: BattleState, side: Side, kind: "king" | "side"): { destroyed: boolean } | undefined {
  for (const tower of state.towers.values()) {
    if (tower.ownerSide === side && tower.kind === kind) return tower;
  }
  return undefined;
}

function countTowersDestroyedOwnedBy(state: BattleState, ownerSide: Side): number {
  let count = 0;
  for (const tower of state.towers.values()) {
    if (tower.ownerSide === ownerSide && tower.destroyed) count += 1;
  }
  return count;
}

function sumRemainingHealth(state: BattleState, ownerSide: Side): number {
  let total = 0;
  for (const tower of state.towers.values()) {
    if (tower.ownerSide === ownerSide) total += tower.health;
  }
  return total;
}

export function finalizeMatch(
  state: BattleState,
  winnerSide: Side | "draw",
  reason: MatchEndReason,
  now: number,
): void {
  if (state.phase === "finished") return;
  state.phase = "finished";
  state.result.winnerSide = winnerSide;
  state.result.reason = reason;
  state.result.endedAtMs = now;
}

function checkKingTowerDestroyed(state: BattleState, now: number): boolean {
  const hostDown = findTower(state, "host", "king")?.destroyed ?? false;
  const guestDown = findTower(state, "guest", "king")?.destroyed ?? false;

  if (hostDown && guestDown) {
    finalizeMatch(state, "draw", "towerDestroyed", now);
    return true;
  }
  if (hostDown) {
    finalizeMatch(state, "guest", "towerDestroyed", now);
    return true;
  }
  if (guestDown) {
    finalizeMatch(state, "host", "towerDestroyed", now);
    return true;
  }
  return false;
}

/**
 * Timer-expiry tiebreak chain, in spec order: more enemy towers destroyed
 * wins; tie -> higher total remaining health across the player's own towers
 * wins; tie -> draw.
 */
export function resolveTimerExpiry(state: BattleState, now: number): void {
  const hostDestroyedEnemyTowers = countTowersDestroyedOwnedBy(state, "guest");
  const guestDestroyedEnemyTowers = countTowersDestroyedOwnedBy(state, "host");

  if (hostDestroyedEnemyTowers !== guestDestroyedEnemyTowers) {
    finalizeMatch(state, hostDestroyedEnemyTowers > guestDestroyedEnemyTowers ? "host" : "guest", "timerExpiry", now);
    return;
  }

  const hostRemainingHp = sumRemainingHealth(state, "host");
  const guestRemainingHp = sumRemainingHealth(state, "guest");

  if (hostRemainingHp !== guestRemainingHp) {
    finalizeMatch(state, hostRemainingHp > guestRemainingHp ? "host" : "guest", "timerExpiry", now);
    return;
  }

  finalizeMatch(state, "draw", "timerExpiry", now);
}

export function resolveSurrender(state: BattleState, surrenderingSide: Side, now: number): void {
  finalizeMatch(state, surrenderingSide === "host" ? "guest" : "host", "surrender", now);
}

export function resolveDisconnectWin(state: BattleState, remainingSide: Side, now: number): void {
  finalizeMatch(state, remainingSide, "disconnect", now);
}

export function checkTick(state: BattleState, now: number): void {
  if (state.phase !== "active") return;

  if (checkKingTowerDestroyed(state, now)) return;

  if (state.matchTimeRemainingMs <= 0) {
    resolveTimerExpiry(state, now);
  }
}
