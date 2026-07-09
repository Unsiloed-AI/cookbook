import type { CardDef } from "./types";

/**
 * All playable cards. This is the single source of truth used by the server
 * simulation, the web UI, and the database seed.
 */
export const CARDS: CardDef[] = [
  {
    id: "iron-guard",
    name: "Iron Guard",
    type: "unit",
    cost: 3,
    rarity: "common",
    description: "A dependable armored soldier. Holds the line and trades blows with anything.",
    color: 0x9aa5b1,
    icon: "🗡️",
    unit: {
      health: 680, damage: 84, range: 0.9, attackInterval: 1.1,
      speed: 1.5, count: 1, sight: 5.5, targets: "any", radius: 0.45,
    },
  },
  {
    id: "forest-archer",
    name: "Forest Archer",
    type: "unit",
    cost: 3,
    rarity: "common",
    description: "Keen-eyed marksman who picks off targets from a distance.",
    color: 0x5fbf6e,
    icon: "🏹",
    unit: {
      health: 260, damage: 62, range: 5, attackInterval: 1.0,
      speed: 1.6, count: 1, sight: 6, targets: "any", radius: 0.35,
      projectileSpeed: 9,
    },
  },
  {
    id: "stone-titan",
    name: "Stone Titan",
    type: "unit",
    cost: 5,
    rarity: "epic",
    description: "A living mountain. Ignores enemy troops and marches straight for towers.",
    color: 0xb08d57,
    icon: "🗿",
    unit: {
      health: 1900, damage: 160, range: 1.0, attackInterval: 1.6,
      speed: 0.9, count: 1, sight: 7, targets: "buildings", radius: 0.6,
    },
  },
  {
    id: "spark-mage",
    name: "Spark Mage",
    type: "unit",
    cost: 4,
    rarity: "rare",
    description: "Hurls crackling orbs that burst into splash damage on impact.",
    color: 0xb46ef5,
    icon: "🔮",
    unit: {
      health: 290, damage: 95, range: 4.5, attackInterval: 1.5,
      speed: 1.4, count: 1, sight: 5.5, targets: "any", radius: 0.4,
      splashRadius: 1.4, projectileSpeed: 7,
    },
  },
  {
    id: "goblin-pack",
    name: "Goblin Pack",
    type: "unit",
    cost: 2,
    rarity: "common",
    description: "Three shrieking goblins. Individually pathetic, collectively annoying.",
    color: 0x7ddc5a,
    icon: "👺",
    unit: {
      health: 140, damage: 46, range: 0.7, attackInterval: 0.9,
      speed: 2.4, count: 3, sight: 5.5, targets: "any", radius: 0.3,
    },
  },
  {
    id: "flame-burst",
    name: "Flame Burst",
    type: "spell",
    cost: 4,
    rarity: "epic",
    description: "Scorches an area. Great against swarms; towers resist part of the blast.",
    color: 0xff7038,
    icon: "🔥",
    spell: { damage: 260, radius: 2.5, towerDamageMultiplier: 0.4 },
  },
  {
    id: "cannon-post",
    name: "Cannon Post",
    type: "building",
    cost: 3,
    rarity: "rare",
    description: "A stationary cannon that pounds approaching ground troops until it crumbles.",
    color: 0x8d99ae,
    icon: "💣",
    unit: {
      health: 750, damage: 88, range: 5, attackInterval: 1.0,
      speed: 0, count: 1, sight: 5, targets: "any", radius: 0.55,
      projectileSpeed: 10, lifetime: 30,
    },
  },
  {
    id: "frost-bolt",
    name: "Frost Bolt",
    type: "spell",
    cost: 2,
    rarity: "rare",
    description: "A shard of ice that chips enemies and slows everything it touches.",
    color: 0x6ec9f5,
    icon: "❄️",
    spell: {
      damage: 110, radius: 2, towerDamageMultiplier: 0.4,
      slowMultiplier: 0.5, slowDuration: 4,
    },
  },
  {
    id: "storm-rider",
    name: "Storm Rider",
    type: "unit",
    cost: 4,
    rarity: "epic",
    description: "Lightning-fast cavalry that punishes an undefended lane.",
    color: 0xf5d76e,
    icon: "🐎",
    unit: {
      health: 520, damage: 115, range: 0.9, attackInterval: 1.2,
      speed: 2.6, count: 1, sight: 6, targets: "any", radius: 0.45,
    },
  },
  {
    id: "shield-bearer",
    name: "Shield Bearer",
    type: "unit",
    cost: 2,
    rarity: "common",
    description: "Cheap, slow, and stubborn. Soaks hits so your damage dealers don't have to.",
    color: 0x64b5f6,
    icon: "🛡️",
    unit: {
      health: 580, damage: 42, range: 0.9, attackInterval: 1.3,
      speed: 1.2, count: 1, sight: 5, targets: "any", radius: 0.45,
    },
  },
  {
    id: "thunder-spike",
    name: "Thunder Spike",
    type: "spell",
    cost: 6,
    rarity: "legendary",
    description: "Calls down a devastating bolt on a small area. Expensive, but few things survive it.",
    color: 0xffe14d,
    icon: "⚡",
    spell: { damage: 420, radius: 1.5, towerDamageMultiplier: 0.4 },
  },
  {
    id: "twin-blades",
    name: "Twin Blades",
    type: "unit",
    cost: 3,
    rarity: "common",
    description: "A pair of duelists who fight back to back and move quickly between lanes.",
    color: 0xf58a8a,
    icon: "⚔️",
    unit: {
      health: 320, damage: 68, range: 0.8, attackInterval: 1.0,
      speed: 2.0, count: 2, sight: 5.5, targets: "any", radius: 0.38,
    },
  },
];

export const CARD_MAP: ReadonlyMap<string, CardDef> = new Map(
  CARDS.map((c) => [c.id, c]),
);

export function getCard(id: string): CardDef | undefined {
  return CARD_MAP.get(id);
}

/** The classic starter deck every new player begins with. */
export const DEFAULT_DECK: string[] = [
  "iron-guard",
  "forest-archer",
  "stone-titan",
  "spark-mage",
  "goblin-pack",
  "flame-burst",
  "cannon-post",
  "frost-bolt",
];

/** Validates a deck: exactly 8 unique, known card ids. */
export function isValidDeck(deck: unknown): deck is string[] {
  if (!Array.isArray(deck) || deck.length !== 8) return false;
  if (new Set(deck).size !== 8) return false;
  return deck.every((id) => typeof id === "string" && CARD_MAP.has(id));
}
