import { prisma } from "@arcane/db";
import { NextResponse } from "next/server";

/** Recent match history for a player, newest first. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const rows = await prisma.matchPlayer.findMany({
      where: { playerId: id },
      orderBy: { match: { createdAt: "desc" } },
      take: 12,
      include: {
        match: {
          include: { participants: { include: { player: true } } },
        },
      },
    });

    const matches = rows.map((mp) => {
      const opponent = mp.match.participants.find((p) => p.id !== mp.id);
      return {
        id: mp.id,
        mode: mp.match.mode,
        result: mp.result,
        trophyDelta: mp.trophyDelta,
        opponentName: opponent?.player.name ?? "Unknown",
        durationSec: mp.match.durationSec,
        endReason: mp.match.endReason,
        createdAt: mp.match.createdAt,
        towersDestroyed: mp.towersDestroyed,
        towersLost: mp.towersLost,
        damageDealt: mp.damageDealt,
        cardsPlayed: mp.cardsPlayed,
      };
    });
    return NextResponse.json({ matches });
  } catch {
    return NextResponse.json({ matches: [], dbOffline: true });
  }
}
