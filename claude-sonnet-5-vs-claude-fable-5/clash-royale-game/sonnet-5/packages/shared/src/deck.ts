import { DECK_SIZE, HAND_SIZE } from "./constants.js";

export interface PlayAndCycleResult {
  newCycle: string[];
  playedCardId: string;
}

/**
 * The starting cycle order is simply the deck selection order (no shuffle) —
 * a documented MVP simplification. The full DECK_SIZE-length order is the
 * canonical representation; hand/nextCard are just views over its first slots.
 */
export function buildInitialCycle(deckCardIds: string[]): string[] {
  if (deckCardIds.length !== DECK_SIZE) {
    throw new Error(`Deck must contain exactly ${DECK_SIZE} cards, got ${deckCardIds.length}`);
  }
  return [...deckCardIds];
}

export function getHand(cycle: string[]): string[] {
  return cycle.slice(0, HAND_SIZE);
}

export function getNextCard(cycle: string[]): string {
  return cycle[HAND_SIZE];
}

/**
 * Plays the card at `handIndex` (0..HAND_SIZE-1) and rotates it to the back of
 * the cycle. Throws on an out-of-range index — callers must validate first.
 */
export function playAndCycle(cycle: string[], handIndex: number): PlayAndCycleResult {
  if (handIndex < 0 || handIndex >= HAND_SIZE || handIndex >= cycle.length) {
    throw new Error(`Invalid hand index: ${handIndex}`);
  }
  const playedCardId = cycle[handIndex];
  const newCycle = [...cycle.slice(0, handIndex), ...cycle.slice(handIndex + 1), playedCardId];
  return { newCycle, playedCardId };
}
