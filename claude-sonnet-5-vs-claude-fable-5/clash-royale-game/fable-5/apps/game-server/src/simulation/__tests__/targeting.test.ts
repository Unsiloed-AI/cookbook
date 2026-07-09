import { getCard } from "@arcane/shared";
import { describe, expect, it } from "vitest";
import { updateTargeting } from "../targeting";
import { makeSim, sideTowersOf } from "./testUtils";

describe("targeting", () => {
  it("prefers the nearest enemy unit within sight", () => {
    const { sim, state, p1, p2 } = makeSim();
    const guard = sim.spawnUnit(p1, getCard("iron-guard")!, 9, 20);
    const near = sim.spawnUnit(p2, getCard("goblin-pack")!, 9, 18);
    sim.spawnUnit(p2, getCard("goblin-pack")!, 9, 15.2);

    updateTargeting(state);
    expect(guard.targetId).toBe(near.id);
  });

  it("falls back to the nearest standing enemy tower", () => {
    const { sim, state, p1 } = makeSim();
    const guard = sim.spawnUnit(p1, getCard("iron-guard")!, 4.5, 18);
    updateTargeting(state);
    const [nearestEnemyTower] = sideTowersOf(sim, "p2");
    expect(guard.targetId).toBe(nearestEnemyTower.id);
  });

  it("building-targeting units ignore enemy troops", () => {
    const { sim, state, p1, p2 } = makeSim();
    const titan = sim.spawnUnit(p1, getCard("stone-titan")!, 4.5, 18);
    sim.spawnUnit(p2, getCard("goblin-pack")!, 4.5, 17); // right in its face

    updateTargeting(state);
    const target = sim.state.players.get("p2")!.towers.get(titan.targetId);
    expect(target).toBeDefined(); // locked on a tower, not the goblin
  });

  it("building-targeting units do attack enemy buildings", () => {
    const { sim, state, p1, p2 } = makeSim();
    const titan = sim.spawnUnit(p1, getCard("stone-titan")!, 9, 18);
    const cannon = sim.spawnUnit(p2, getCard("cannon-post")!, 9, 14);

    updateTargeting(state);
    expect(titan.targetId).toBe(cannon.id);
  });

  it("defensive buildings never target towers", () => {
    const { sim, state, p1 } = makeSim();
    const cannon = sim.spawnUnit(p1, getCard("cannon-post")!, 9, 18);
    updateTargeting(state);
    expect(cannon.targetId).toBe("");
  });
});
