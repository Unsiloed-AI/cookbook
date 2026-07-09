import { describe, expect, it } from "vitest";
import { buildInitialCycle, getHand, getNextCard, playAndCycle } from "../src/deck.js";

const DECK = ["a", "b", "c", "d", "e", "f", "g", "h"];

describe("deck cycling", () => {
  it("builds the initial cycle as the deck's selection order", () => {
    expect(buildInitialCycle(DECK)).toEqual(DECK);
  });

  it("rejects a deck that isn't exactly 8 cards", () => {
    expect(() => buildInitialCycle(["a", "b"])).toThrow();
  });

  it("slices hand and next card correctly", () => {
    const cycle = buildInitialCycle(DECK);
    expect(getHand(cycle)).toEqual(["a", "b", "c", "d"]);
    expect(getNextCard(cycle)).toBe("e");
  });

  it("moves the played card to the back and preserves relative order of the rest", () => {
    const cycle = buildInitialCycle(DECK);
    const { newCycle, playedCardId } = playAndCycle(cycle, 1);
    expect(playedCardId).toBe("b");
    expect(newCycle).toEqual(["a", "c", "d", "e", "f", "g", "h", "b"]);
  });

  it("returns to the exact original order after a full 8-play cycle", () => {
    let cycle = buildInitialCycle(DECK);
    for (let i = 0; i < 8; i++) {
      const result = playAndCycle(cycle, 0);
      cycle = result.newCycle;
    }
    expect(cycle).toEqual(DECK);
  });

  it("throws on an out-of-range hand index", () => {
    const cycle = buildInitialCycle(DECK);
    expect(() => playAndCycle(cycle, 4)).toThrow();
    expect(() => playAndCycle(cycle, -1)).toThrow();
  });
});
