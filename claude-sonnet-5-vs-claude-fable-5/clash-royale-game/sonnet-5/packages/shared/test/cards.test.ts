import { describe, expect, it } from "vitest";
import { CARD_DEFINITIONS, getCardById, isValidCardId } from "../src/cards.js";
import { DECK_SIZE, STARTER_DECK_CARD_IDS } from "../src/constants.js";

describe("card roster integrity", () => {
  it("has at least 8 cards, each with a unique id", () => {
    expect(CARD_DEFINITIONS.length).toBeGreaterThanOrEqual(8);
    const ids = new Set(CARD_DEFINITIONS.map((c) => c.id));
    expect(ids.size).toBe(CARD_DEFINITIONS.length);
  });

  it("gives every card a positive cost and non-empty name/description", () => {
    for (const card of CARD_DEFINITIONS) {
      expect(card.cost).toBeGreaterThan(0);
      expect(card.name.length).toBeGreaterThan(0);
      expect(card.description.length).toBeGreaterThan(0);
    }
  });

  it("gives troop cards a unit definition and spell cards a spell definition, exclusively", () => {
    for (const card of CARD_DEFINITIONS) {
      if (card.category === "troop") {
        expect(card.unit).toBeDefined();
        expect(card.spell).toBeUndefined();
      } else {
        expect(card.spell).toBeDefined();
        expect(card.unit).toBeUndefined();
      }
    }
  });

  it("resolves known ids and rejects unknown ones", () => {
    expect(getCardById("glimmer-sprite")?.name).toBe("Glimmer Sprite");
    expect(isValidCardId("glimmer-sprite")).toBe(true);
    expect(isValidCardId("not-a-real-card")).toBe(false);
  });

  it("has a valid starter deck of exactly DECK_SIZE known cards", () => {
    expect(STARTER_DECK_CARD_IDS.length).toBe(DECK_SIZE);
    for (const id of STARTER_DECK_CARD_IDS) {
      expect(isValidCardId(id)).toBe(true);
    }
    expect(new Set(STARTER_DECK_CARD_IDS).size).toBe(DECK_SIZE);
  });
});
