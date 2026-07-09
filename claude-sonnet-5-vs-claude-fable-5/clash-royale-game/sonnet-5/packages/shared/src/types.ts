export type Side = "host" | "guest";

export type Rarity = "common" | "rare" | "epic" | "legendary";

export type CardCategory = "troop" | "spell";

export type TargetingMode = "any" | "buildingsOnly";

export type CardShape =
  | "diamond"
  | "triangle"
  | "hexagon"
  | "dotCluster"
  | "spire"
  | "orb"
  | "bolt"
  | "shield"
  | "blade"
  | "colossus";

export interface CardVisual {
  shape: CardShape;
  primaryColor: string;
  secondaryColor: string;
}

export interface UnitDefinition {
  health: number;
  damage: number;
  attackRange: number;
  attackSpeedMs: number;
  moveSpeed: number;
  spawnCount: number;
  targeting: TargetingMode;
  stationary: boolean;
  splashRadius?: number;
  projectileSpeed?: number;
  sightRange: number;
  hitboxRadius: number;
}

export interface SpellDefinition {
  radius: number;
  damage: number;
  towerDamageMultiplier: number;
  slowFactor?: number;
  slowDurationMs?: number;
}

export interface CardDefinition {
  id: string;
  name: string;
  description: string;
  cost: number;
  rarity: Rarity;
  category: CardCategory;
  visual: CardVisual;
  unit?: UnitDefinition;
  spell?: SpellDefinition;
}

export type TowerKind = "side" | "king";

export interface TowerDefinition {
  kind: TowerKind;
  health: number;
  damage: number;
  attackRange: number;
  attackSpeedMs: number;
}

export type MatchMode = "pvp" | "practice";

export type MatchEndReason =
  | "towerDestroyed"
  | "timerExpiry"
  | "surrender"
  | "disconnect"
  | "draw";

export type MatchResult = "win" | "loss" | "draw";

export interface MatchSummaryDTO {
  matchId: string;
  mode: MatchMode;
  result: MatchResult;
  opponentName: string;
  isBotOpponent: boolean;
  durationSeconds: number;
  endReason: MatchEndReason;
  towersDestroyed: number;
  towersLost: number;
  cardsPlayed: number;
  damageDealt: number;
  energySpent: number;
  trophyDelta: number;
  createdAt: string;
}

export interface PlayerProfileDTO {
  id: string;
  username: string;
  trophies: number;
  wins: number;
  losses: number;
  draws: number;
  deckCardIds: string[];
  winRate: number;
}
