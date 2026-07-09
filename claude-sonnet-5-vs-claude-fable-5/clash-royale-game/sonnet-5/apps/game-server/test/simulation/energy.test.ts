import { ENERGY_MAX } from "@arcane-towers/shared";
import { describe, expect, it } from "vitest";
import { regenTick } from "../../src/simulation/energy.js";
import { createTestState } from "../fixtures.js";

describe("energy regen", () => {
  it("gains exactly 1 energy after 2000ms fed in smaller chunks", () => {
    const { state, runtime } = createTestState();
    const player = [...state.players.values()][0];
    player.energy = 5;

    regenTick(state, runtime, 800);
    regenTick(state, runtime, 800);
    expect(player.energy).toBe(5);

    regenTick(state, runtime, 400);
    expect(player.energy).toBe(6);
  });

  it("caps at ENERGY_MAX and does not overflow the accumulator", () => {
    const { state, runtime } = createTestState();
    const player = [...state.players.values()][0];
    player.energy = ENERGY_MAX;

    regenTick(state, runtime, 10_000);
    expect(player.energy).toBe(ENERGY_MAX);
  });

  it("doubles the regen rate in the final 60 seconds", () => {
    const { state, runtime } = createTestState();
    state.matchTimeRemainingMs = 30_000;
    const player = [...state.players.values()][0];
    player.energy = 0;

    regenTick(state, runtime, 2000);
    expect(player.energy).toBe(2);
  });

  it("does not regenerate energy for disconnected players", () => {
    const { state, runtime } = createTestState();
    const player = [...state.players.values()][0];
    player.connected = false;
    player.energy = 3;

    regenTick(state, runtime, 5000);
    expect(player.energy).toBe(3);
  });
});
