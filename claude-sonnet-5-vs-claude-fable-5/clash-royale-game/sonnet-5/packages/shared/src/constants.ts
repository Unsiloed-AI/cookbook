// Arena world-space geometry. Host (bottom) occupies y in (RIVER_Y, ARENA_HEIGHT],
// guest (top) occupies y in [0, RIVER_Y). All simulation and rendering code shares
// this single coordinate frame; the Phaser client is the only place it gets flipped
// for the guest's point of view (see apps/web worldToScreen).
export const ARENA_WIDTH = 18;
export const ARENA_HEIGHT = 32;
export const RIVER_Y = 16;
export const BRIDGE_X_RANGES: Array<[number, number]> = [
  [2, 5],
  [13, 16],
];

export const TICK_HZ = 25;
export const TICK_MS = 1000 / TICK_HZ;

export const MATCH_DURATION_MS = 3 * 60 * 1000;
export const COUNTDOWN_MS = 3000;
export const MAX_COUNTDOWN_WAIT_MS = 6000;
export const ROOM_DISPOSAL_GRACE_MS = 10_000;
export const RECONNECT_WINDOW_SECONDS = 15;

export const ENERGY_START = 5;
export const ENERGY_MAX = 10;
export const ENERGY_REGEN_MS = 2000;
export const LATE_MATCH_REGEN_WINDOW_MS = 60_000;
export const LATE_MATCH_REGEN_MULTIPLIER = 2;

export const HAND_SIZE = 4;
export const DECK_SIZE = 8;

export const STARTING_TROPHIES = 1000;
export const TROPHY_WIN_DELTA = 30;
export const TROPHY_LOSS_DELTA = -30;
export const TROPHY_DRAW_DELTA = 0;

export const STARTER_DECK_CARD_IDS = [
  "glimmer-sprite",
  "kestrel-swarm",
  "blade-acolyte",
  "sparkfletcher",
  "bulwark-spire",
  "frostveil-mist",
  "stone-golem",
  "cataclysm-bolt",
];

export type EmoteId = "gg" | "laugh" | "cry" | "angry" | "thanks";

export const EMOTE_IDS: EmoteId[] = ["gg", "laugh", "cry", "angry", "thanks"];

export const BOT_PLAYER_ID = "arcane-sentinel-bot";
export const BOT_DISPLAY_NAME = "Arcane Sentinel";
