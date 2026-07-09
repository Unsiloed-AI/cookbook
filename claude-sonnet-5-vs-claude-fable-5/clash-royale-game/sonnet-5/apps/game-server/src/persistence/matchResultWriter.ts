import { prisma } from "@arcane-towers/db";
import {
  STARTER_DECK_CARD_IDS,
  TROPHY_DRAW_DELTA,
  TROPHY_LOSS_DELTA,
  TROPHY_WIN_DELTA,
  type MatchMode,
  type MatchResult,
} from "@arcane-towers/shared";
import type { BattleState } from "../schema/BattleState.js";

function countOwnTowersDestroyed(state: BattleState, side: string): number {
  let count = 0;
  for (const tower of state.towers.values()) {
    if (tower.ownerSide === side && tower.destroyed) count += 1;
  }
  return count;
}

function resolveResult(state: BattleState, side: string): MatchResult {
  if (state.result.winnerSide === "draw") return "draw";
  return state.result.winnerSide === side ? "win" : "loss";
}

function trophyDeltaFor(result: MatchResult, ranked: boolean): number {
  if (!ranked) return 0;
  if (result === "win") return TROPHY_WIN_DELTA;
  if (result === "loss") return TROPHY_LOSS_DELTA;
  return TROPHY_DRAW_DELTA;
}

/**
 * Persists the finished match to Postgres, updates each player's
 * denormalized win/loss/trophy counters, and stamps the (transient,
 * non-persisted-elsewhere) trophyDelta back onto the room's schema state so
 * the result overlay can display it without a follow-up fetch.
 */
export async function persistMatchResult(state: BattleState, mode: MatchMode): Promise<void> {
  if (!state.result.winnerSide) return;

  const ranked = mode === "pvp";
  const durationSeconds = Math.max(0, Math.round(state.elapsedMs / 1000));
  const players = [...state.players.values()];

  for (const player of players) {
    await prisma.player.upsert({
      where: { id: player.playerId },
      update: { username: player.name },
      create: {
        id: player.playerId,
        username: player.name,
        isBot: player.isBot,
        deckCardIds: STARTER_DECK_CARD_IDS,
      },
    });
  }

  await prisma.match.create({
    data: {
      mode,
      endReason: state.result.reason,
      durationSeconds,
      participants: {
        create: players.map((player) => {
          const result = resolveResult(state, player.side);
          const trophyDelta = trophyDeltaFor(result, ranked);
          return {
            playerId: player.playerId,
            result,
            trophyDelta,
            towersDestroyed: player.stats.towersDestroyed,
            towersLost: countOwnTowersDestroyed(state, player.side),
            damageDealt: Math.round(player.stats.damageDealt),
            cardsPlayed: player.stats.cardsPlayed,
            energySpent: player.stats.energySpent,
          };
        }),
      },
    },
  });

  for (const player of players) {
    const result = resolveResult(state, player.side);
    const trophyDelta = trophyDeltaFor(result, ranked);
    player.trophyDelta = trophyDelta;

    await prisma.player.update({
      where: { id: player.playerId },
      data: {
        trophies: { increment: trophyDelta },
        wins: { increment: result === "win" ? 1 : 0 },
        losses: { increment: result === "loss" ? 1 : 0 },
        draws: { increment: result === "draw" ? 1 : 0 },
      },
    });
  }
}
