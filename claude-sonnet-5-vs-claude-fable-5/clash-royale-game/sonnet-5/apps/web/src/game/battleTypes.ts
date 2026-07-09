import type { ArraySchema, MapSchema } from "@colyseus/schema";
import type { Room } from "colyseus.js";

/**
 * Client-side mirror of the game-server's @colyseus/schema state shape.
 * Field names/types must stay in lockstep with apps/game-server/src/schema —
 * this is a duck-typed view, not a shared import, so the web app never
 * depends on game-server internals (see architecture notes in README).
 */
export type Side = "host" | "guest";
export type MatchPhase = "waiting" | "countdown" | "active" | "finished";
export type UnitMotionState = "moving" | "attacking";
export type TowerKind = "side" | "king";

export interface ClientPlayerStats {
  cardsPlayed: number;
  damageDealt: number;
  energySpent: number;
  towersDestroyed: number;
}

export interface ClientPlayer {
  sessionId: string;
  playerId: string;
  name: string;
  side: Side;
  isBot: boolean;
  connected: boolean;
  ready: boolean;
  energy: number;
  hand: ArraySchema<string>;
  nextCard: string;
  stats: ClientPlayerStats;
  trophyDelta: number;
}

export interface ClientUnit {
  id: string;
  ownerSide: Side;
  cardId: string;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  state: UnitMotionState;
  targetId: string;
  attackCooldownRemainingMs: number;
  slowedUntilMs: number;
  slowFactor: number;
}

export interface ClientTower {
  id: string;
  ownerSide: Side;
  kind: TowerKind;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  activated: boolean;
  destroyed: boolean;
  targetId: string;
}

export interface ClientProjectile {
  id: string;
  ownerSide: Side;
  cardId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  spawnedAtMs: number;
  willImpactAtMs: number;
  damage: number;
  splashRadius: number;
  targetId: string;
}

export interface ClientEffect {
  id: string;
  cardId: string;
  x: number;
  y: number;
  radius: number;
  spawnedAtMs: number;
  durationMs: number;
}

export interface ClientResult {
  winnerSide: Side | "draw" | "";
  reason: string;
  endedAtMs: number;
}

export interface ClientBattleState {
  matchId: string;
  mode: "pvp" | "practice";
  phase: MatchPhase;
  countdownRemainingMs: number;
  matchTimeRemainingMs: number;
  elapsedMs: number;
  players: MapSchema<ClientPlayer>;
  units: MapSchema<ClientUnit>;
  towers: MapSchema<ClientTower>;
  projectiles: MapSchema<ClientProjectile>;
  effects: MapSchema<ClientEffect>;
  result: ClientResult;
}

export type BattleRoom = Room<ClientBattleState>;

/** Plain-data snapshot of a player, for React state — decoupled from the live schema instance. */
export interface PlayerSnapshot {
  sessionId: string;
  playerId: string;
  name: string;
  side: Side;
  isBot: boolean;
  energy: number;
  hand: string[];
  nextCard: string;
  stats: ClientPlayerStats;
  trophyDelta: number;
}

export function toPlayerSnapshot(player: ClientPlayer): PlayerSnapshot {
  return {
    sessionId: player.sessionId,
    playerId: player.playerId,
    name: player.name,
    side: player.side,
    isBot: player.isBot,
    energy: player.energy,
    hand: [...player.hand],
    nextCard: player.nextCard,
    stats: { ...player.stats },
    trophyDelta: player.trophyDelta,
  };
}
