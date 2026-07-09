import { describe, expect, it } from "vitest";
import { BattleState } from "../../src/schema/BattleState.js";
import { checkTick, resolveTimerExpiry } from "../../src/simulation/winConditions.js";
import { createTestState } from "../fixtures.js";

function towerById(state: BattleState, id: string) {
  return [...state.towers.values()].find((t) => t.id === id)!;
}

describe("win conditions", () => {
  it("resolves a win for the opposing side when a king tower is destroyed", () => {
    const { state } = createTestState();
    towerById(state, "host-king").destroyed = true;

    checkTick(state, Date.now());

    expect(state.phase).toBe("finished");
    expect(state.result.winnerSide).toBe("guest");
    expect(state.result.reason).toBe("towerDestroyed");
  });

  it("resolves a draw when both king towers are destroyed simultaneously", () => {
    const { state } = createTestState();
    towerById(state, "host-king").destroyed = true;
    towerById(state, "guest-king").destroyed = true;

    checkTick(state, Date.now());

    expect(state.result.winnerSide).toBe("draw");
  });

  it("timer expiry: more enemy towers destroyed wins", () => {
    const { state } = createTestState();
    towerById(state, "guest-left").destroyed = true;

    resolveTimerExpiry(state, Date.now());

    expect(state.result.winnerSide).toBe("host");
  });

  it("timer expiry: tied destroyed towers falls back to higher remaining own HP", () => {
    const { state } = createTestState();
    towerById(state, "host-left").health = 100;

    resolveTimerExpiry(state, Date.now());

    expect(state.result.winnerSide).toBe("guest");
  });

  it("timer expiry: a full tie is a draw", () => {
    const { state } = createTestState();

    resolveTimerExpiry(state, Date.now());

    expect(state.result.winnerSide).toBe("draw");
  });
});
