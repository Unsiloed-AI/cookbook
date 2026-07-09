import {
  ARENA_WIDTH,
  BRIDGE_X_RANGES,
  canAfford,
  distance,
  getCardById,
  opposingSide,
  RIVER_Y,
  type Side,
} from "@arcane-towers/shared";
import type { BattleState } from "../schema/BattleState.js";
import { validateAndDeploy } from "../simulation/deployment.js";
import type { PlayerRuntimeMap } from "../simulation/types.js";

const DEFENSE_RADIUS = 8;
const MIN_ACTION_DELAY_MS = 900;
const MAX_ACTION_DELAY_MS = 1600;
const OFFENSE_DELAY_MIN_MS = 2500;
const OFFENSE_DELAY_MAX_MS = 5000;

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

interface Threat {
  towerX: number;
  towerY: number;
  enemyX: number;
  enemyY: number;
}

function findThreat(state: BattleState, botSide: Side): Threat | null {
  const enemySide = opposingSide(botSide);
  let best: (Threat & { dist: number }) | null = null;

  for (const tower of state.towers.values()) {
    if (tower.ownerSide !== botSide || tower.destroyed) continue;
    for (const unit of state.units.values()) {
      if (unit.ownerSide !== enemySide) continue;
      const d = distance(tower, unit);
      if (d <= DEFENSE_RADIUS && (!best || d < best.dist)) {
        best = { towerX: tower.x, towerY: tower.y, enemyX: unit.x, enemyY: unit.y, dist: d };
      }
    }
  }

  return best;
}

/**
 * A deliberately simple heuristic opponent for Practice mode. It calls the
 * exact same server-authoritative deployment pipeline a human player's
 * intent would go through — the bot IS a player whose intents are generated
 * server-side, not a separate simulation path.
 */
export class BotController {
  private nextActionAtMs = 0;

  constructor(private readonly sessionId: string) {}

  tick(state: BattleState, runtime: PlayerRuntimeMap, now: number): void {
    if (state.phase !== "active") return;
    if (now < this.nextActionAtMs) return;

    const bot = state.players.get(this.sessionId);
    if (!bot) return;

    const plan = this.pickAction(state, bot.side, bot.energy, [...bot.hand]);
    if (!plan) {
      this.nextActionAtMs = now + randomBetween(MIN_ACTION_DELAY_MS, MAX_ACTION_DELAY_MS);
      return;
    }

    const outcome = validateAndDeploy(state, runtime, this.sessionId, plan.handIndex, plan.x, plan.y, now);
    this.nextActionAtMs =
      now + (outcome.ok ? randomBetween(OFFENSE_DELAY_MIN_MS, OFFENSE_DELAY_MAX_MS) : randomBetween(600, 1200));
  }

  private pickAction(
    state: BattleState,
    side: Side,
    energy: number,
    hand: string[],
  ): { handIndex: number; x: number; y: number } | null {
    const affordable = hand
      .map((cardId, handIndex) => ({ handIndex, card: getCardById(cardId) }))
      .filter((entry): entry is { handIndex: number; card: NonNullable<typeof entry.card> } => !!entry.card)
      .filter((entry) => canAfford(energy, entry.card.cost));

    if (affordable.length === 0) return null;

    const threat = findThreat(state, side);

    if (threat) {
      const troop = affordable.filter((e) => e.card.category === "troop");
      if (troop.length > 0) {
        const pick = troop[Math.floor(Math.random() * troop.length)];
        const towardRiver = side === "host" ? -3 : 3;
        return {
          handIndex: pick.handIndex,
          x: clamp(threat.towerX + randomBetween(-1.5, 1.5), 0, ARENA_WIDTH),
          y: clampOwnHalf(threat.towerY + towardRiver, side),
        };
      }
      const spell = affordable.find((e) => e.card.category === "spell");
      if (spell) {
        return { handIndex: spell.handIndex, x: threat.enemyX, y: threat.enemyY };
      }
      return null;
    }

    const troop = affordable.filter((e) => e.card.category === "troop");
    if (troop.length === 0) return null;

    const pick = troop[Math.floor(Math.random() * troop.length)];
    const [rangeA, rangeB] = BRIDGE_X_RANGES[Math.floor(Math.random() * BRIDGE_X_RANGES.length)];
    const laneX = (rangeA + rangeB) / 2 + randomBetween(-1, 1);
    const forwardY = side === "host" ? RIVER_Y + 4 : RIVER_Y - 4;

    return {
      handIndex: pick.handIndex,
      x: clamp(laneX, 0, ARENA_WIDTH),
      y: clampOwnHalf(forwardY, side),
    };
  }
}

function clampOwnHalf(y: number, side: Side): number {
  return side === "host" ? Math.max(RIVER_Y + 0.5, y) : Math.min(RIVER_Y - 0.5, y);
}
