import { prisma } from "@arcane/db";
import { MATCH, TROPHIES, type MatchMode, type MatchResult } from "@arcane/shared";
import type { BattleState, PlayerState } from "./rooms/schema/BattleState";

function resultFor(state: BattleState, player: PlayerState): MatchResult {
  if (state.winnerId === "") return "draw";
  return state.winnerId === player.id ? "win" : "loss";
}

function towersLost(player: PlayerState): number {
  let lost = 0;
  for (const t of player.towers.values()) {
    if (t.hp <= 0) lost += 1;
  }
  return lost;
}

/**
 * Write the finished match and updated player aggregates to Postgres.
 * Failures are logged by the caller and never crash the room.
 */
export async function persistMatch(
  state: BattleState,
  mode: MatchMode,
): Promise<void> {
  const players = [...state.players.values()];
  if (players.length < 2) return;

  const durationSec = Math.round(MATCH.durationSec - state.timeRemaining);
  const endReason = state.endReason || "timeout";

  for (const p of players) {
    await prisma.player.upsert({
      where: { id: p.persistentId },
      update: p.isBot ? {} : { name: p.name },
      create: { id: p.persistentId, name: p.name, isBot: p.isBot },
    });
  }

  await prisma.match.create({
    data: {
      mode,
      endReason,
      durationSec,
      participants: {
        create: players.map((p) => {
          const result = resultFor(state, p);
          return {
            playerId: p.persistentId,
            result,
            trophyDelta: trophyDeltaFor(mode, result),
            towersDestroyed: p.towersDestroyed,
            towersLost: towersLost(p),
            damageDealt: Math.round(p.damageDealt),
            cardsPlayed: p.cardsPlayed,
            energySpent: p.energySpent,
          };
        }),
      },
    },
  });

  for (const p of players) {
    const result = resultFor(state, p);
    await prisma.player.update({
      where: { id: p.persistentId },
      data: {
        wins: { increment: result === "win" ? 1 : 0 },
        losses: { increment: result === "loss" ? 1 : 0 },
        draws: { increment: result === "draw" ? 1 : 0 },
        trophies: { increment: trophyDeltaFor(mode, result) },
      },
    });
  }
  // Keep trophies from going negative after a losing streak.
  await prisma.player.updateMany({
    where: { trophies: { lt: 0 } },
    data: { trophies: 0 },
  });
}

function trophyDeltaFor(mode: MatchMode, result: MatchResult): number {
  if (mode !== "pvp") return 0;
  if (result === "win") return TROPHIES.win;
  if (result === "loss") return TROPHIES.loss;
  return 0;
}
