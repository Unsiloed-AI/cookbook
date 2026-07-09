import { prisma } from "@arcane-towers/db";
import {
  BOT_DISPLAY_NAME,
  BOT_PLAYER_ID,
  type MatchEndReason,
  type MatchMode,
  type MatchResult,
  type MatchSummaryDTO,
} from "@arcane-towers/shared";
import { NextResponse } from "next/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const participations = await prisma.matchParticipant.findMany({
    where: { playerId: id },
    include: {
      match: { include: { participants: { include: { player: true } } } },
    },
    orderBy: { match: { createdAt: "desc" } },
    take: 20,
  });

  const summaries: MatchSummaryDTO[] = participations.map((participant) => {
    const opponent = participant.match.participants.find((other) => other.playerId !== id);
    const isBotOpponent = opponent?.playerId === BOT_PLAYER_ID;

    return {
      matchId: participant.matchId,
      mode: participant.match.mode as MatchMode,
      result: participant.result as MatchResult,
      opponentName: isBotOpponent ? BOT_DISPLAY_NAME : (opponent?.player?.username ?? "Unknown"),
      isBotOpponent,
      durationSeconds: participant.match.durationSeconds,
      endReason: participant.match.endReason as MatchEndReason,
      towersDestroyed: participant.towersDestroyed,
      towersLost: participant.towersLost,
      cardsPlayed: participant.cardsPlayed,
      damageDealt: participant.damageDealt,
      energySpent: participant.energySpent,
      trophyDelta: participant.trophyDelta,
      createdAt: participant.match.createdAt.toISOString(),
    };
  });

  return NextResponse.json(summaries);
}
