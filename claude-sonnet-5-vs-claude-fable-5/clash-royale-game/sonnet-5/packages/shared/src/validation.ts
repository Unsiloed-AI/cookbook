import { ARENA_HEIGHT, ARENA_WIDTH, RIVER_Y } from "./constants.js";
import type { CardCategory, Side } from "./types.js";

export function canAfford(energy: number, cost: number): boolean {
  return energy >= cost;
}

export function isInBounds(x: number, y: number): boolean {
  return x >= 0 && x <= ARENA_WIDTH && y >= 0 && y <= ARENA_HEIGHT;
}

export type PlacementRejectionReason = "outOfBounds" | "invalidSideForTroop";

export interface PlacementCheck {
  valid: boolean;
  reason?: PlacementRejectionReason;
}

/**
 * Troops must land strictly on the deploying player's own half of the arena;
 * spells may be cast anywhere in bounds (the game's one explicit placement
 * exception). Landing exactly on the river line counts as the enemy half.
 */
export function isValidPlacement(
  category: CardCategory,
  x: number,
  y: number,
  side: Side,
): PlacementCheck {
  if (!isInBounds(x, y)) {
    return { valid: false, reason: "outOfBounds" };
  }

  if (category === "spell") {
    return { valid: true };
  }

  const onOwnHalf = side === "host" ? y > RIVER_Y : y < RIVER_Y;
  if (!onOwnHalf) {
    return { valid: false, reason: "invalidSideForTroop" };
  }

  return { valid: true };
}
