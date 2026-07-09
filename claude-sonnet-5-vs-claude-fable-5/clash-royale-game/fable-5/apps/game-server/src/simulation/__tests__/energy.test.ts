import { ENERGY } from "@arcane/shared";
import { describe, expect, it } from "vitest";
import { makeSim, runTicks } from "./testUtils";

describe("energy regeneration", () => {
  it("players start with the configured energy", () => {
    const { p1 } = makeSim();
    expect(p1.energy).toBe(ENERGY.start);
  });

  it("regenerates at the base rate (1 energy per 2 seconds)", () => {
    const { sim, p1 } = makeSim();
    runTicks(sim, 2);
    expect(p1.energy).toBeCloseTo(ENERGY.start + 1, 1);
  });

  it("caps at max energy", () => {
    const { sim, p1 } = makeSim();
    runTicks(sim, 60);
    expect(p1.energy).toBe(ENERGY.max);
  });

  it("regenerates twice as fast during the final minute", () => {
    const { sim, p1, state } = makeSim();
    state.timeRemaining = ENERGY.overtimeThreshold;
    p1.energy = 0;
    runTicks(sim, 2);
    expect(p1.energy).toBeCloseTo(2, 1);
  });
});
