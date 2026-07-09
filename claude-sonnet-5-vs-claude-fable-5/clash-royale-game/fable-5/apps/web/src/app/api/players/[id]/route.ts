import { prisma } from "@arcane/db";
import { NextResponse } from "next/server";

/** Fetch a player's persisted profile and aggregate stats. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const player = await prisma.player.findUnique({ where: { id } });
    return NextResponse.json({ player });
  } catch {
    return NextResponse.json({ player: null, dbOffline: true });
  }
}
