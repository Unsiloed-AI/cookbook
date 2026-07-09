import { ARENA_WIDTH, RIVER_Y } from "./constants.js";
import type { Side, TowerDefinition, TowerKind } from "./types.js";

export const TOWER_STATS: Record<TowerKind, TowerDefinition> = {
  side: {
    kind: "side",
    health: 1400,
    damage: 90,
    attackRange: 5.5,
    attackSpeedMs: 800,
  },
  king: {
    kind: "king",
    health: 2400,
    damage: 110,
    attackRange: 6.0,
    attackSpeedMs: 800,
  },
};

export interface TowerPlacement {
  id: string;
  side: Side;
  kind: TowerKind;
  x: number;
  y: number;
}

const KING_INSET = 3;
const SIDE_LANE_OFFSET = 3.5;
const SIDE_INSET = 8;

// Host occupies the bottom half of the arena, guest the top half. Positions are
// mirrored across RIVER_Y so the arena reads symmetrically for both players.
export const TOWER_POSITIONS: TowerPlacement[] = [
  { id: "host-king", side: "host", kind: "king", x: ARENA_WIDTH / 2, y: RIVER_Y + (RIVER_Y - KING_INSET) },
  { id: "host-left", side: "host", kind: "side", x: SIDE_LANE_OFFSET, y: RIVER_Y + SIDE_INSET },
  { id: "host-right", side: "host", kind: "side", x: ARENA_WIDTH - SIDE_LANE_OFFSET, y: RIVER_Y + SIDE_INSET },
  { id: "guest-king", side: "guest", kind: "king", x: ARENA_WIDTH / 2, y: KING_INSET },
  { id: "guest-left", side: "guest", kind: "side", x: SIDE_LANE_OFFSET, y: RIVER_Y - SIDE_INSET },
  { id: "guest-right", side: "guest", kind: "side", x: ARENA_WIDTH - SIDE_LANE_OFFSET, y: RIVER_Y - SIDE_INSET },
];

export function getTowerDefinition(kind: TowerKind): TowerDefinition {
  return TOWER_STATS[kind];
}

export function opposingSide(side: Side): Side {
  return side === "host" ? "guest" : "host";
}
