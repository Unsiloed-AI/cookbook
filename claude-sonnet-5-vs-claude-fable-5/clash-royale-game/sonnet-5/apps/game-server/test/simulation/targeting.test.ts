import { describe, expect, it } from "vitest";
import { BattleState } from "../../src/schema/BattleState.js";
import { UnitState } from "../../src/schema/UnitState.js";
import { targetingTick } from "../../src/simulation/targeting.js";
import { createTestState } from "../fixtures.js";

interface UnitSpec {
  id: string;
  side: "host" | "guest";
  cardId: string;
  x: number;
  y: number;
}

function makeUnit(state: BattleState, spec: UnitSpec): UnitState {
  const unit = new UnitState();
  unit.id = spec.id;
  unit.ownerSide = spec.side;
  unit.cardId = spec.cardId;
  unit.x = spec.x;
  unit.y = spec.y;
  unit.health = 100;
  unit.maxHealth = 100;
  state.units.set(unit.id, unit);
  return unit;
}

function towerById(state: BattleState, id: string) {
  return [...state.towers.values()].find((t) => t.id === id)!;
}

describe("targeting", () => {
  it("'any' targeting picks the nearest enemy unit over a farther tower", () => {
    const { state } = createTestState();
    const attacker = makeUnit(state, { id: "a1", side: "host", cardId: "blade-acolyte", x: 9, y: 20 });
    makeUnit(state, { id: "e1", side: "guest", cardId: "glimmer-sprite", x: 9, y: 18 });

    targetingTick(state);

    expect(attacker.targetId).toBe("e1");
  });

  it("'buildingsOnly' targeting ignores a closer enemy unit and targets the nearest tower", () => {
    const { state } = createTestState();
    const golem = makeUnit(state, { id: "g1", side: "host", cardId: "stone-golem", x: 9, y: 20 });
    makeUnit(state, { id: "e1", side: "guest", cardId: "glimmer-sprite", x: 9, y: 18 });

    targetingTick(state);

    expect(golem.targetId).not.toBe("e1");
    expect(golem.targetId.startsWith("guest-")).toBe(true);
  });

  it("excludes destroyed towers from targeting", () => {
    const { state } = createTestState();
    const golem = makeUnit(state, { id: "g1", side: "host", cardId: "stone-golem", x: 3.5, y: 20 });
    towerById(state, "guest-left").destroyed = true;

    targetingTick(state);

    expect(golem.targetId).not.toBe("guest-left");
  });

  it("a tower only targets enemy units within its attack range", () => {
    const { state } = createTestState();
    const sideTower = towerById(state, "host-left");
    makeUnit(state, { id: "far", side: "guest", cardId: "glimmer-sprite", x: sideTower.x, y: sideTower.y - 100 });

    targetingTick(state);

    expect(sideTower.targetId).toBe("");
  });
});
