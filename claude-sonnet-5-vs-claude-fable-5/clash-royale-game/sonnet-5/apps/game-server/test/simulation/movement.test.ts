import { RIVER_Y } from "@arcane-towers/shared";
import { describe, expect, it } from "vitest";
import { UnitState } from "../../src/schema/UnitState.js";
import { getMovementWaypoint, movementTick } from "../../src/simulation/movement.js";
import { createTestState } from "../fixtures.js";

describe("movement", () => {
  it("routes toward the nearest bridge when crossing the river outside a bridge x-range", () => {
    const unit = { x: 9, y: RIVER_Y + 5 };
    const target = { x: 9, y: RIVER_Y - 5 };

    const waypoint = getMovementWaypoint(unit, target);

    expect(waypoint.y).toBe(unit.y);
    expect(waypoint.x).not.toBe(9);
  });

  it("paths directly to the target once already aligned with a bridge", () => {
    const unit = { x: 3.5, y: RIVER_Y + 5 };
    const target = { x: 3.5, y: RIVER_Y - 5 };

    const waypoint = getMovementWaypoint(unit, target);

    expect(waypoint).toEqual(target);
  });

  it("a slowed unit covers less distance per tick than an identical unslowed unit", () => {
    const { state: slowState } = createTestState();
    const { state: normalState } = createTestState();
    const now = Date.now();

    const slowUnit = new UnitState();
    slowUnit.id = "s1";
    slowUnit.ownerSide = "host";
    slowUnit.cardId = "blade-acolyte";
    slowUnit.x = 9;
    slowUnit.y = RIVER_Y + 10;
    slowUnit.health = 340;
    slowUnit.maxHealth = 340;
    slowUnit.targetId = "guest-king";
    slowUnit.slowedUntilMs = now + 10_000;
    slowUnit.slowFactor = 0.5;
    slowState.units.set(slowUnit.id, slowUnit);

    const normalUnit = new UnitState();
    normalUnit.id = "n1";
    normalUnit.ownerSide = "host";
    normalUnit.cardId = "blade-acolyte";
    normalUnit.x = 9;
    normalUnit.y = RIVER_Y + 10;
    normalUnit.health = 340;
    normalUnit.maxHealth = 340;
    normalUnit.targetId = "guest-king";
    normalState.units.set(normalUnit.id, normalUnit);

    movementTick(slowState, 200, now);
    movementTick(normalState, 200, now);

    const slowDist = Math.hypot(slowUnit.x - 9, slowUnit.y - (RIVER_Y + 10));
    const normalDist = Math.hypot(normalUnit.x - 9, normalUnit.y - (RIVER_Y + 10));

    expect(slowDist).toBeLessThan(normalDist);
  });
});
