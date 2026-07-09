import {
  getCard,
  isValidSpellPlacement,
  isValidUnitPlacement,
  type CardDef,
} from "@arcane/shared";
import type { BattleState, PlayerState } from "../rooms/schema/BattleState";

export type DeployValidation =
  | { ok: true; player: PlayerState; card: CardDef }
  | { ok: false; reason: string };

/**
 * Server-side gatekeeper for every card play. The client is never trusted:
 * phase, hand membership, energy, and placement zone are all re-checked here.
 */
export function validateDeploy(
  state: BattleState,
  playerId: string,
  cardId: string,
  x: number,
  y: number,
): DeployValidation {
  if (state.phase !== "active") {
    return { ok: false, reason: "Match is not active" };
  }
  const player = state.players.get(playerId);
  if (!player) return { ok: false, reason: "Unknown player" };

  const card = getCard(cardId);
  if (!card) return { ok: false, reason: "Unknown card" };

  if (!player.hand.includes(cardId)) {
    return { ok: false, reason: "Card is not in your hand" };
  }
  if (player.energy < card.cost) {
    return { ok: false, reason: "Not enough energy" };
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return { ok: false, reason: "Invalid position" };
  }

  if (card.type === "spell") {
    if (!isValidSpellPlacement(x, y)) {
      return { ok: false, reason: "Target is outside the arena" };
    }
  } else if (!isValidUnitPlacement(player.side, x, y)) {
    return { ok: false, reason: "You can only deploy on your side" };
  }

  return { ok: true, player, card };
}

/**
 * Deck cycle: the played card leaves the hand, the front of the queue takes
 * its slot, and the played card goes to the back of the queue.
 */
export function cycleHand(player: PlayerState, cardId: string): void {
  const idx = player.hand.indexOf(cardId);
  if (idx === -1) return;
  const next = player.queue.shift();
  if (next !== undefined) {
    player.hand[idx] = next;
  } else {
    player.hand.splice(idx, 1);
  }
  player.queue.push(cardId);
}
