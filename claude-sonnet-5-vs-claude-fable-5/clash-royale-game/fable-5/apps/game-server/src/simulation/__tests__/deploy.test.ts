import { getCard } from "@arcane/shared";
import { describe, expect, it } from "vitest";
import { BattleSimulation } from "../BattleSimulation";
import { makeSim } from "./testUtils";

describe("card deployment", () => {
  it("spawns a unit, spends energy, and tracks stats", () => {
    const { sim, p1, state } = makeSim();
    const result = sim.deploy("p1", "iron-guard", 9, 24);

    expect(result.ok).toBe(true);
    expect(p1.energy).toBe(5 - getCard("iron-guard")!.cost);
    expect(p1.cardsPlayed).toBe(1);
    expect(p1.energySpent).toBe(3);
    expect(state.units.size).toBe(1);
    const unit = [...state.units.values()][0];
    expect(unit.cardId).toBe("iron-guard");
    expect(unit.ownerId).toBe("p1");
  });

  it("cycles the played card to the back of the queue", () => {
    const { sim, p1 } = makeSim();
    // starting hand: iron-guard, forest-archer, stone-titan, spark-mage
    sim.deploy("p1", "iron-guard", 9, 24);

    expect([...p1.hand]).toEqual([
      "goblin-pack",
      "forest-archer",
      "stone-titan",
      "spark-mage",
    ]);
    expect(p1.queue[p1.queue.length - 1]).toBe("iron-guard");
    expect(p1.hand.includes("iron-guard")).toBe(false);
  });

  it("rejects a card that is not in the hand", () => {
    const { sim } = makeSim();
    const result = sim.deploy("p1", "frost-bolt", 9, 24); // still in queue
    expect(result).toEqual({ ok: false, reason: "Card is not in your hand" });
  });

  it("rejects when energy is insufficient", () => {
    const { sim, p1 } = makeSim();
    p1.energy = 2;
    const result = sim.deploy("p1", "stone-titan", 9, 24);
    expect(result).toEqual({ ok: false, reason: "Not enough energy" });
    expect(p1.cardsPlayed).toBe(0);
  });

  it("rejects unit placement on the opponent's side", () => {
    const { sim, state } = makeSim();
    const result = sim.deploy("p1", "iron-guard", 9, 8); // top half = p2's side
    expect(result.ok).toBe(false);
    expect(state.units.size).toBe(0);
  });

  it("rejects unit placement on the river", () => {
    const { sim } = makeSim();
    const result = sim.deploy("p1", "iron-guard", 9, 16);
    expect(result.ok).toBe(false);
  });

  it("allows spells anywhere, including the opponent's side", () => {
    const sim = customSim(["flame-burst", "iron-guard", "goblin-pack", "frost-bolt"]);
    expect(sim.deploy("p1", "flame-burst", 9, 4).ok).toBe(true);
  });

  it("restricts buildings to the player's own side", () => {
    const sim = customSim(["cannon-post", "iron-guard", "goblin-pack", "frost-bolt"]);
    expect(sim.deploy("p1", "cannon-post", 9, 8).ok).toBe(false);
    expect(sim.deploy("p1", "cannon-post", 9, 22).ok).toBe(true);
  });

  it("rejects any deploy when the match is not active", () => {
    const sim = new BattleSimulation();
    sim.addPlayer({ id: "p1", name: "One", side: 0, deck: ["iron-guard"] });
    const result = sim.deploy("p1", "iron-guard", 9, 24);
    expect(result).toEqual({ ok: false, reason: "Match is not active" });
  });

  it("spawns one unit per count for swarm cards", () => {
    const sim = customSim(["goblin-pack", "iron-guard", "shield-bearer", "frost-bolt"]);
    const result = sim.deploy("p1", "goblin-pack", 9, 24);
    expect(result.ok).toBe(true);
    expect(sim.state.units.size).toBe(3);
  });
});

/** Sim where p1 uses the given deck (first four cards form the hand). */
function customSim(deck: string[]): BattleSimulation {
  const sim = new BattleSimulation();
  sim.addPlayer({ id: "p1", name: "One", side: 0, deck });
  sim.addPlayer({ id: "p2", name: "Two", side: 1, deck });
  sim.begin();
  return sim;
}
