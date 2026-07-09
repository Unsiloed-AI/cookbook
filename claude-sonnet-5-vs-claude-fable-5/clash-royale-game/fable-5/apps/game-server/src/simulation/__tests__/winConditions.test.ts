import { describe, expect, it } from "vitest";
import { makeSim, mainTowerOf, runTicks, sideTowersOf } from "./testUtils";

describe("win conditions", () => {
  it("destroying the main tower ends the match immediately", () => {
    const { sim, state } = makeSim();
    mainTowerOf(sim, "p2").hp = 0;
    sim.tick(0.05);

    expect(state.phase).toBe("finished");
    expect(state.winnerId).toBe("p1");
    expect(state.endReason).toBe("main-tower");
  });

  it("at timeout, more towers destroyed wins", () => {
    const { sim, state, p1 } = makeSim();
    p1.towersDestroyed = 1;
    state.timeRemaining = 0.01;
    sim.tick(0.05);

    expect(state.phase).toBe("finished");
    expect(state.winnerId).toBe("p1");
    expect(state.endReason).toBe("timeout");
  });

  it("at timeout with equal towers, more remaining tower HP wins", () => {
    const { sim, state } = makeSim();
    const [tower] = sideTowersOf(sim, "p1");
    tower.hp -= 500;
    state.timeRemaining = 0.01;
    sim.tick(0.05);

    expect(state.winnerId).toBe("p2");
    expect(state.endReason).toBe("timeout");
  });

  it("declares a draw when everything is equal", () => {
    const { sim, state } = makeSim();
    state.timeRemaining = 0.01;
    sim.tick(0.05);

    expect(state.phase).toBe("finished");
    expect(state.winnerId).toBe("");
    expect(state.endReason).toBe("draw");
  });

  it("surrender hands the win to the opponent", () => {
    const { sim, state } = makeSim();
    sim.surrender("p1");

    expect(state.phase).toBe("finished");
    expect(state.winnerId).toBe("p2");
    expect(state.endReason).toBe("surrender");
  });

  it("the match keeps running while time remains", () => {
    const { sim, state } = makeSim();
    runTicks(sim, 5);
    expect(state.phase).toBe("active");
    expect(state.timeRemaining).toBeCloseTo(175, 0);
  });
});
