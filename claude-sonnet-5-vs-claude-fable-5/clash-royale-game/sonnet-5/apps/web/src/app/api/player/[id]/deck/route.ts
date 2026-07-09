import { prisma } from "@arcane-towers/db";
import { DECK_SIZE, isValidCardId } from "@arcane-towers/shared";
import { NextResponse } from "next/server";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const deckCardIds = body?.deckCardIds;

  if (!Array.isArray(deckCardIds) || deckCardIds.length !== DECK_SIZE) {
    return NextResponse.json({ error: `Deck must contain exactly ${DECK_SIZE} cards` }, { status: 400 });
  }

  const unique = new Set(deckCardIds);
  if (unique.size !== DECK_SIZE || !deckCardIds.every((cid) => typeof cid === "string" && isValidCardId(cid))) {
    return NextResponse.json({ error: "Deck must contain 8 unique, valid card ids" }, { status: 400 });
  }

  const player = await prisma.player.update({
    where: { id },
    data: { deckCardIds },
  });

  return NextResponse.json({ deckCardIds: player.deckCardIds });
}
