import type { MatchSummaryDTO, PlayerProfileDTO } from "@arcane-towers/shared";

export async function upsertPlayer(id: string, username: string): Promise<void> {
  await fetch("/api/player", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, username }),
  });
}

export async function fetchPlayerProfile(playerId: string): Promise<PlayerProfileDTO> {
  const res = await fetch(`/api/player/${playerId}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load player profile");
  return res.json();
}

export async function fetchMatchHistory(playerId: string): Promise<MatchSummaryDTO[]> {
  const res = await fetch(`/api/player/${playerId}/matches`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load match history");
  return res.json();
}

export async function saveDeck(playerId: string, deckCardIds: string[]): Promise<void> {
  const res = await fetch(`/api/player/${playerId}/deck`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deckCardIds }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to save deck");
  }
}
