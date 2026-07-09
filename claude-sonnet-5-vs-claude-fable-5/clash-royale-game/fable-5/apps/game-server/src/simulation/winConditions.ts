import type { PlayerState, TowerState } from "../rooms/schema/BattleState";
import type { BattleSimulation } from "./BattleSimulation";

export function mainTower(player: PlayerState): TowerState | undefined {
  for (const t of player.towers.values()) {
    if (t.kind === "main") return t;
  }
  return undefined;
}

export function remainingTowerHp(player: PlayerState): number {
  let total = 0;
  for (const t of player.towers.values()) total += Math.max(0, t.hp);
  return total;
}

/**
 * End-of-match rules:
 *  - a destroyed main tower ends the match instantly,
 *  - at timeout: more towers destroyed wins, then more remaining tower HP,
 *    otherwise the match is a draw.
 */
export function checkWinConditions(sim: BattleSimulation): void {
  const { state } = sim;
  if (state.phase !== "active") return;

  const players = [...state.players.values()];
  if (players.length < 2) return;
  const [a, b] = players;

  const aMainDown = (mainTower(a)?.hp ?? 0) <= 0;
  const bMainDown = (mainTower(b)?.hp ?? 0) <= 0;
  if (aMainDown || bMainDown) {
    if (aMainDown && bMainDown) sim.finish("", "draw");
    else sim.finish(aMainDown ? b.id : a.id, "main-tower");
    return;
  }

  if (state.timeRemaining > 0) return;

  if (a.towersDestroyed !== b.towersDestroyed) {
    sim.finish(
      a.towersDestroyed > b.towersDestroyed ? a.id : b.id,
      "timeout",
    );
    return;
  }
  const aHp = remainingTowerHp(a);
  const bHp = remainingTowerHp(b);
  if (aHp !== bHp) {
    sim.finish(aHp > bHp ? a.id : b.id, "timeout");
    return;
  }
  sim.finish("", "draw");
}
