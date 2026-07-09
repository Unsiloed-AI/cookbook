import type { Side, TowerDef, TowerPosition } from "./types";

/**
 * The arena is a logical grid of tiles. The simulation runs entirely in tile
 * coordinates; the client multiplies by ARENA.tile to get pixels.
 * Side 0 owns the bottom half (large y), side 1 the top half (small y).
 */
export const ARENA = {
  width: 18,
  height: 32,
  /** Pixels per tile on the client. */
  tile: 32,
  /** River band: impassable for ground units except at bridges. */
  riverTop: 15,
  riverBottom: 17,
  riverCenter: 16,
  /** Bridge x-centers (one per lane). */
  bridges: [4.5, 13.5],
  bridgeHalfWidth: 1.5,
  /** Units cannot be deployed within this margin of the arena edge. */
  margin: 0.5,
} as const;

export const ENERGY = {
  start: 5,
  max: 10,
  regenPerSec: 0.5,
  /** Regen doubles when timeRemaining <= overtimeThreshold. */
  overtimeRegenPerSec: 1,
  overtimeThreshold: 60,
} as const;

export const MATCH = {
  durationSec: 180,
  countdownSec: 3,
  deckSize: 8,
  handSize: 4,
  tickRate: 20,
  /** Seconds a disconnected player has to reconnect before forfeiting. */
  reconnectGraceSec: 15,
  /** If a client never signals ready, start anyway after this long. */
  readyTimeoutSec: 15,
} as const;

export const TROPHIES = {
  start: 1000,
  win: 30,
  loss: -30,
} as const;

export const TOWER_DEFS: Record<"main" | "side", TowerDef> = {
  main: { health: 2600, damage: 70, range: 7, attackInterval: 1.0, radius: 1.3 },
  side: { health: 1500, damage: 95, range: 6, attackInterval: 1.1, radius: 1.0 },
};

/** Tower layout for a side. Side 1 mirrors side 0 vertically. */
export function towerPositions(side: Side): TowerPosition[] {
  const mirror = (y: number) => (side === 0 ? y : ARENA.height - y);
  return [
    { id: `t${side}-left`, kind: "side", x: 4.5, y: mirror(26) },
    { id: `t${side}-right`, kind: "side", x: 13.5, y: mirror(26) },
    { id: `t${side}-main`, kind: "main", x: 9, y: mirror(29.5) },
  ];
}

/** Whether a tile position is on the given side's own half (excludes river). */
export function isOnOwnSide(side: Side, y: number): boolean {
  return side === 0 ? y >= ARENA.riverBottom : y <= ARENA.riverTop;
}

/** Deployable area for units/buildings: own half, inside margins. */
export function isValidUnitPlacement(side: Side, x: number, y: number): boolean {
  const m = ARENA.margin;
  if (x < m || x > ARENA.width - m) return false;
  if (y < m || y > ARENA.height - m) return false;
  return isOnOwnSide(side, y);
}

/** Spells can be cast anywhere inside the arena. */
export function isValidSpellPlacement(x: number, y: number): boolean {
  return x >= 0 && x <= ARENA.width && y >= 0 && y <= ARENA.height;
}
