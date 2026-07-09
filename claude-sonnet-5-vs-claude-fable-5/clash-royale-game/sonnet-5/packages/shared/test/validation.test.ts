import { describe, expect, it } from "vitest";
import { ARENA_HEIGHT, ARENA_WIDTH, RIVER_Y } from "../src/constants.js";
import { canAfford, isValidPlacement } from "../src/validation.js";

describe("canAfford", () => {
  it("allows exact-cost spends", () => {
    expect(canAfford(3, 3)).toBe(true);
  });
  it("allows surplus energy", () => {
    expect(canAfford(5, 3)).toBe(true);
  });
  it("rejects insufficient energy", () => {
    expect(canAfford(2, 3)).toBe(false);
  });
});

describe("isValidPlacement", () => {
  it("allows a troop strictly on the host's own half", () => {
    expect(isValidPlacement("troop", 9, RIVER_Y + 5, "host").valid).toBe(true);
  });

  it("rejects a troop on the enemy half", () => {
    const result = isValidPlacement("troop", 9, RIVER_Y - 5, "host");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("invalidSideForTroop");
  });

  it("rejects a troop exactly on the river line", () => {
    const result = isValidPlacement("troop", 9, RIVER_Y, "host");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("invalidSideForTroop");
  });

  it("allows a spell anywhere in bounds, including the enemy half", () => {
    expect(isValidPlacement("spell", 9, RIVER_Y - 5, "host").valid).toBe(true);
    expect(isValidPlacement("spell", 9, RIVER_Y + 5, "guest").valid).toBe(true);
  });

  it("rejects any card placed out of bounds", () => {
    expect(isValidPlacement("spell", -1, 5, "host").reason).toBe("outOfBounds");
    expect(isValidPlacement("troop", ARENA_WIDTH + 1, RIVER_Y + 2, "host").reason).toBe(
      "outOfBounds",
    );
    expect(isValidPlacement("spell", 5, ARENA_HEIGHT + 1, "guest").reason).toBe("outOfBounds");
  });
});
