import { DEFAULT_DECK, MATCH } from "@arcane/shared";
import { BattleSimulation } from "../BattleSimulation";

/** Two-player sim with known (unshuffled) decks, already in the active phase. */
export function makeSim() {
  const sim = new BattleSimulation();
  const p1 = sim.addPlayer({ id: "p1", name: "One", side: 0, deck: [...DEFAULT_DECK] });
  const p2 = sim.addPlayer({ id: "p2", name: "Two", side: 1, deck: [...DEFAULT_DECK] });
  sim.begin();
  return { sim, p1, p2, state: sim.state };
}

/** Advance the sim by `seconds` using the real tick rate. */
export function runTicks(sim: BattleSimulation, seconds: number): void {
  const dt = 1 / MATCH.tickRate;
  const steps = Math.round(seconds * MATCH.tickRate);
  for (let i = 0; i < steps; i++) sim.tick(dt);
}

export function mainTowerOf(sim: BattleSimulation, playerId: string) {
  const player = sim.state.players.get(playerId)!;
  return [...player.towers.values()].find((t) => t.kind === "main")!;
}

export function sideTowersOf(sim: BattleSimulation, playerId: string) {
  const player = sim.state.players.get(playerId)!;
  return [...player.towers.values()].filter((t) => t.kind === "side");
}
