import { describe, expect, it } from "vitest";
import { UnitState } from "../../src/schema/UnitState.js";
import { BattleState } from "../../src/schema/BattleState.js";
import { combatTick } from "../../src/simulation/combat.js";
import { projectilesTick } from "../../src/simulation/projectiles.js";
import { createTestState } from "../fixtures.js";

interface UnitSpec {
  id: string;
  side: "host" | "guest";
  cardId: string;
  x: number;
  y: number;
  health: number;
}

function makeUnit(state: BattleState, spec: UnitSpec): UnitState {
  const unit = new UnitState();
  unit.id = spec.id;
  unit.ownerSide = spec.side;
  unit.cardId = spec.cardId;
  unit.x = spec.x;
  unit.y = spec.y;
  unit.health = spec.health;
  unit.maxHealth = spec.health;
  state.units.set(unit.id, unit);
  return unit;
}

describe("combat", () => {
  it("melee attacker applies clamped damage on a single tick when in range and off cooldown", () => {
    const { state } = createTestState();
    const attacker = makeUnit(state, { id: "a1", side: "host", cardId: "blade-acolyte", x: 9, y: 20, health: 340 });
    const defender = makeUnit(state, { id: "d1", side: "guest", cardId: "glimmer-sprite", x: 9, y: 20.5, health: 30 });
    attacker.targetId = defender.id;

    combatTick(state, 40, Date.now());

    expect(state.units.has("d1")).toBe(false);
  });

  it("does not double-hit within the same attack cooldown window", () => {
    const { state } = createTestState();
    const attacker = makeUnit(state, { id: "a1", side: "host", cardId: "blade-acolyte", x: 9, y: 20, health: 340 });
    const defender = makeUnit(state, {
      id: "d1",
      side: "guest",
      cardId: "ironclad-vanguard",
      x: 9,
      y: 20.5,
      health: 1150,
    });
    attacker.targetId = defender.id;

    const now = Date.now();
    combatTick(state, 40, now);
    const healthAfterFirstHit = defender.health;

    combatTick(state, 40, now + 40);
    expect(defender.health).toBe(healthAfterFirstHit);
  });

  it("ranged attacker spawns a projectile with no immediate damage; impact resolves later", () => {
    const { state } = createTestState();
    const attacker = makeUnit(state, { id: "a1", side: "host", cardId: "sparkfletcher", x: 9, y: 25, health: 170 });
    const defender = makeUnit(state, { id: "d1", side: "guest", cardId: "glimmer-sprite", x: 9, y: 22, health: 120 });
    attacker.targetId = defender.id;

    const now = Date.now();
    combatTick(state, 40, now);

    expect(state.projectiles.size).toBe(1);
    expect(defender.health).toBe(120);

    const projectile = [...state.projectiles.values()][0];
    expect(projectile.willImpactAtMs).toBeGreaterThan(now);

    projectilesTick(state, projectile.willImpactAtMs - 1);
    expect(state.projectiles.size).toBe(1);

    projectilesTick(state, projectile.willImpactAtMs);
    expect(state.projectiles.size).toBe(0);
    expect(defender.health).toBeLessThan(120);
  });
});
