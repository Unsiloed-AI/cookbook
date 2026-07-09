import { RIVER_Y } from "@arcane-towers/shared";
import { describe, expect, it } from "vitest";
import { validateAndDeploy } from "../../src/simulation/deployment.js";
import { createTestState } from "../fixtures.js";

describe("deployment validation", () => {
  it("deploys a valid troop: spends energy, tracks stats, spawns a unit, cycles the hand", () => {
    const { state, runtime } = createTestState();
    const host = [...state.players.values()][0];
    host.energy = 5;
    const before = state.units.size;

    const result = validateAndDeploy(state, runtime, host.sessionId, 0, 9, RIVER_Y + 5, Date.now());

    expect(result.ok).toBe(true);
    expect(host.energy).toBe(3);
    expect(host.stats.cardsPlayed).toBe(1);
    expect(host.stats.energySpent).toBe(2);
    expect(state.units.size).toBe(before + 1);

    expect(host.hand[0]).toBe("kestrel-swarm");
    expect(host.hand[3]).toBe("bulwark-spire");
    expect(host.nextCard).toBe("frostveil-mist");
  });

  it("spawns 3 units for a swarm card", () => {
    const { state, runtime } = createTestState();
    const host = [...state.players.values()][0];
    host.energy = 10;
    const before = state.units.size;

    const result = validateAndDeploy(state, runtime, host.sessionId, 1, 9, RIVER_Y + 5, Date.now());

    expect(result.ok).toBe(true);
    expect(state.units.size).toBe(before + 3);
  });

  it("rejects insufficient energy and mutates no state", () => {
    const { state, runtime } = createTestState();
    const host = [...state.players.values()][0];
    host.energy = 1;
    const before = state.units.size;

    const result = validateAndDeploy(state, runtime, host.sessionId, 0, 9, RIVER_Y + 5, Date.now());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("insufficientEnergy");
    expect(host.energy).toBe(1);
    expect(state.units.size).toBe(before);
    expect(host.hand[0]).toBe("glimmer-sprite");
  });

  it("rejects a troop placed on the enemy half", () => {
    const { state, runtime } = createTestState();
    const host = [...state.players.values()][0];
    host.energy = 5;

    const result = validateAndDeploy(state, runtime, host.sessionId, 0, 9, RIVER_Y - 5, Date.now());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalidSideForTroop");
  });

  it("rejects deployment when the match isn't active", () => {
    const { state, runtime } = createTestState();
    state.phase = "countdown";
    const host = [...state.players.values()][0];
    host.energy = 5;

    const result = validateAndDeploy(state, runtime, host.sessionId, 0, 9, RIVER_Y + 5, Date.now());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("matchNotActive");
  });
});
