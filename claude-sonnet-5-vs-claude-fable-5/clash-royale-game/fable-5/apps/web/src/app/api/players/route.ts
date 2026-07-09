import { prisma } from "@arcane/db";
import { NextResponse } from "next/server";

/** Upsert a guest profile. Called when a profile is created or renamed. */
export async function POST(req: Request) {
  let id = "";
  let name = "";
  try {
    const body = await req.json();
    id = typeof body?.id === "string" ? body.id.slice(0, 64) : "";
    name = typeof body?.name === "string" ? body.name.trim().slice(0, 20) : "";
  } catch {
    // fall through to validation error
  }
  if (!id || !name) {
    return NextResponse.json({ error: "id and name are required" }, { status: 400 });
  }

  try {
    const player = await prisma.player.upsert({
      where: { id },
      update: { name },
      create: { id, name },
    });
    return NextResponse.json({ player });
  } catch {
    // DB unreachable — the client falls back to local data.
    return NextResponse.json({ player: null, dbOffline: true });
  }
}
