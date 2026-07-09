import { prisma } from "@arcane-towers/db";
import type { PlayerProfileDTO } from "@arcane-towers/shared";
import { NextResponse } from "next/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const player = await prisma.player.findUnique({ where: { id } });
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const totalMatches = player.wins + player.losses + player.draws;
  const dto: PlayerProfileDTO = {
    id: player.id,
    username: player.username,
    trophies: player.trophies,
    wins: player.wins,
    losses: player.losses,
    draws: player.draws,
    deckCardIds: player.deckCardIds,
    winRate: totalMatches > 0 ? player.wins / totalMatches : 0,
  };

  return NextResponse.json(dto);
}
