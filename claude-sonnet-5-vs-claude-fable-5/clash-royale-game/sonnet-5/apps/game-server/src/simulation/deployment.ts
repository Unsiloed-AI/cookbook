import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  canAfford,
  getCardById,
  getHand,
  getNextCard,
  getSwarmSpawnOffsets,
  HAND_SIZE,
  isValidPlacement,
  playAndCycle,
  type DeployRejectionReason,
} from "@arcane-towers/shared";
import type { BattleState } from "../schema/BattleState.js";
import { UnitState } from "../schema/UnitState.js";
import { resolveSpell } from "./spells.js";
import type { PlayerRuntimeMap } from "./types.js";
import { generateId } from "./util.js";

export type DeployOutcome = { ok: true } | { ok: false; reason: DeployRejectionReason };

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function spawnUnits(
  state: BattleState,
  cardId: string,
  unitDef: NonNullable<ReturnType<typeof getCardById>>["unit"],
  x: number,
  y: number,
  side: "host" | "guest",
): void {
  if (!unitDef) return;
  const offsets = getSwarmSpawnOffsets(unitDef.spawnCount);
  for (const offset of offsets) {
    const unit = new UnitState();
    unit.id = generateId("unit");
    unit.ownerSide = side;
    unit.cardId = cardId;
    unit.x = clamp(x + offset.x, 0, ARENA_WIDTH);
    unit.y = clamp(y + offset.y, 0, ARENA_HEIGHT);
    unit.health = unitDef.health;
    unit.maxHealth = unitDef.health;
    unit.state = "moving";
    state.units.set(unit.id, unit);
  }
}

/**
 * The single authoritative validation + application pipeline for a
 * deployCard intent. Fail-fast with a distinct reason per rejection; no
 * state is mutated unless every check passes.
 */
export function validateAndDeploy(
  state: BattleState,
  runtime: PlayerRuntimeMap,
  sessionId: string,
  handIndex: number,
  x: number,
  y: number,
  now: number,
): DeployOutcome {
  if (state.phase !== "active") {
    return { ok: false, reason: "matchNotActive" };
  }

  const player = state.players.get(sessionId);
  if (!player || !player.connected) {
    return { ok: false, reason: "invalidPlayer" };
  }

  if (
    !Number.isInteger(handIndex) ||
    handIndex < 0 ||
    handIndex >= HAND_SIZE ||
    handIndex >= player.hand.length
  ) {
    return { ok: false, reason: "invalidHandIndex" };
  }

  const cardId = player.hand[handIndex];
  const card = getCardById(cardId);
  if (!card) {
    return { ok: false, reason: "unknownCard" };
  }

  if (!canAfford(player.energy, card.cost)) {
    return { ok: false, reason: "insufficientEnergy" };
  }

  const placement = isValidPlacement(card.category, x, y, player.side);
  if (!placement.valid) {
    return { ok: false, reason: placement.reason! };
  }

  player.energy -= card.cost;
  player.stats.cardsPlayed += 1;
  player.stats.energySpent += card.cost;

  const rt = runtime.get(sessionId);
  if (rt) {
    const { newCycle } = playAndCycle(rt.fullCycle, handIndex);
    rt.fullCycle = newCycle;
    const newHand = getHand(newCycle);
    player.hand.clear();
    for (const id of newHand) player.hand.push(id);
    player.nextCard = getNextCard(newCycle);
  }

  if (card.category === "troop" && card.unit) {
    spawnUnits(state, card.id, card.unit, x, y, player.side);
  } else if (card.category === "spell" && card.spell) {
    resolveSpell(state, card, x, y, player.side, now);
  }

  return { ok: true };
}
