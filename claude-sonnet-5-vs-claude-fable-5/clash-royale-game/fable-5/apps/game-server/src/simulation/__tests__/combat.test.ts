import { getCard, TOWER_DEFS } from "@arcane/shared";
import { describe, expect, it } from "vitest";
import { makeSim, runTicks, sideTowersOf } from "./testUtils";

describe("combat", () => {
  it("melee units close in and kill each other", () => {
    const { sim, state, p1, p2 } = makeSim();
    const guard = sim.spawnUnit(p1, getCard("iron-guard")!, 9, 20);
    const goblin = sim.spawnUnit(p2, getCard("goblin-pack")!, 9, 18.5);

    runTicks(sim, 6);
    // Iron Guard (680hp/84dmg) easily beats a single goblin (140hp/46dmg).
    expect(state.units.has(goblin.id)).toBe(false);
    expect(state.units.has(guard.id)).toBe(true);
    expect(guard.hp).toBeLessThan(guard.maxHp);
  });

  it("units damage towers and the attacker's stats are credited", () => {
    const { sim, p1, p2 } = makeSim();
    const [leftTower] = sideTowersOf(sim, "p2");
    sim.spawnUnit(p1, getCard("iron-guard")!, leftTower.x, leftTower.y + 2);

    runTicks(sim, 5);
    expect(leftTower.hp).toBeLessThan(leftTower.maxHp);
    expect(p1.damageDealt).toBeGreaterThan(0);
    expect(p2.damageDealt).toBeGreaterThan(0); // the tower fought back
  });

  it("towers shoot units that come into range", () => {
    const { sim, state, p2 } = makeSim();
    const [leftTower] = sideTowersOf(sim, "p1");
    const goblin = sim.spawnUnit(p2, getCard("goblin-pack")!, leftTower.x, leftTower.y - 3);
    goblin.speed = 0; // pin it under the tower

    runTicks(sim, 6);
    expect(state.units.has(goblin.id)).toBe(false); // shot down
  });

  it("spells hit units for full damage but towers at a reduced rate", () => {
    const { sim, p1, p2 } = makeSim();
    const spell = getCard("flame-burst")!.spell!;
    const guard = sim.spawnUnit(p1, getCard("iron-guard")!, 4.5, 24);
    const [leftTower] = sideTowersOf(sim, "p1");
    p2.energy = 10;
    p2.hand[0] = "flame-burst"; // pull the spell out of the queue for the test

    // p2 bombs p1's left side tower; the guard stands inside the blast.
    expect(sim.deploy("p2", "flame-burst", leftTower.x, leftTower.y).ok).toBe(true);

    expect(guard.hp).toBe(guard.maxHp - spell.damage);
    expect(leftTower.hp).toBe(
      TOWER_DEFS.side.health - spell.damage * spell.towerDamageMultiplier,
    );
  });

  it("frost bolt slows units and the slow expires", () => {
    const { sim, p1, p2 } = makeSim();
    const guard = sim.spawnUnit(p1, getCard("iron-guard")!, 9, 20);
    p2.energy = 10;
    // frost-bolt starts in p2's queue — put it in hand directly for the test
    p2.hand[0] = "frost-bolt";

    sim.deploy("p2", "frost-bolt", guard.x, guard.y);
    expect(guard.slowed).toBe(true);
    expect(guard.hp).toBe(guard.maxHp - getCard("frost-bolt")!.spell!.damage);

    runTicks(sim, 4.5);
    expect(guard.slowed).toBe(false);
  });

  it("buildings expire when their lifetime runs out", () => {
    const { sim, state, p1 } = makeSim();
    const cannon = sim.spawnUnit(p1, getCard("cannon-post")!, 9, 22);
    runTicks(sim, 31);
    expect(state.units.has(cannon.id)).toBe(false);
  });
});
