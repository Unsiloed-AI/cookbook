import { prisma } from "@arcane-towers/db";
import { STARTER_DECK_CARD_IDS } from "@arcane-towers/shared";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body.id !== "string" || typeof body.username !== "string" || !body.id || !body.username) {
    return NextResponse.json({ error: "id and username are required" }, { status: 400 });
  }

  const username = body.username.slice(0, 20);

  const player = await prisma.player.upsert({
    where: { id: body.id },
    update: { username },
    create: {
      id: body.id,
      username,
      deckCardIds: STARTER_DECK_CARD_IDS,
    },
  });

  return NextResponse.json({ id: player.id, username: player.username });
}
