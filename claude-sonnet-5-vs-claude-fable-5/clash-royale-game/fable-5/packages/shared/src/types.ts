export type CardType = "unit" | "spell" | "building";
export type Rarity = "common" | "rare" | "epic" | "legendary";

/** What a unit is allowed to attack. */
export type TargetPriority = "any" | "buildings";

export type MatchPhase = "waiting" | "countdown" | "active" | "finished";
export type UnitBehaviorState = "moving" | "attacking" | "dead";
export type MatchMode = "pvp" | "practice";
export type MatchResult = "win" | "loss" | "draw";
export type EndReason =
  | "main-tower"
  | "timeout"
  | "surrender"
  | "disconnect"
  | "draw";

/** Side 0 deploys on the bottom half, side 1 on the top half. */
export type Side = 0 | 1;

export interface UnitStats {
  health: number;
  damage: number;
  /** Attack range in tiles (distance between body edges). */
  range: number;
  /** Seconds between attacks. */
  attackInterval: number;
  /** Movement speed in tiles per second. 0 for buildings. */
  speed: number;
  /** How many units the card spawns. */
  count: number;
  /** Aggro radius in tiles. */
  sight: number;
  targets: TargetPriority;
  /** Body radius in tiles, used for collision/range math and rendering. */
  radius: number;
  splashRadius?: number;
  /** Set for ranged units — projectile travel speed in tiles/sec. */
  projectileSpeed?: number;
  /** Buildings decay and expire after this many seconds. */
  lifetime?: number;
}

export interface SpellStats {
  damage: number;
  radius: number;
  /** Towers take damage * this multiplier. */
  towerDamageMultiplier: number;
  slowMultiplier?: number;
  slowDuration?: number;
}

export interface CardDef {
  id: string;
  name: string;
  type: CardType;
  cost: number;
  rarity: Rarity;
  description: string;
  /** Accent color used by procedural art (0xRRGGBB). */
  color: number;
  /** Emoji glyph used as the card/unit icon. */
  icon: string;
  unit?: UnitStats;
  spell?: SpellStats;
}

export interface TowerDef {
  health: number;
  damage: number;
  range: number;
  attackInterval: number;
  radius: number;
}

export type TowerKind = "main" | "side";

export interface TowerPosition {
  id: string;
  kind: TowerKind;
  x: number;
  y: number;
}

export interface PlayerMatchStats {
  damageDealt: number;
  cardsPlayed: number;
  energySpent: number;
  towersDestroyed: number;
  towersLost: number;
}
