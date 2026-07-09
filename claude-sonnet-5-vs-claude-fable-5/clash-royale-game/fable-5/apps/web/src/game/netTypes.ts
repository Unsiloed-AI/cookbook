import type { EndReason, MatchPhase, TowerKind, UnitBehaviorState } from "@arcane/shared";

/**
 * Structural types for the server's reflected Colyseus state. The client has
 * no schema classes — colyseus.js reconstructs the state from the handshake —
 * so these interfaces describe the shape we read.
 */

export interface NetTower {
  id: string;
  ownerId: string;
  kind: TowerKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

export interface NetUnit {
  id: string;
  ownerId: string;
  cardId: string;
  side: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  state: UnitBehaviorState;
  targetId: string;
  slowed: boolean;
  isBuilding: boolean;
}

export interface NetProjectile {
  id: string;
  cardId: string;
  x: number;
  y: number;
}

export interface NetMap<T> {
  get(key: string): T | undefined;
  forEach(cb: (value: T, key: string) => void): void;
  size: number;
}

export interface NetPlayer {
  id: string;
  name: string;
  side: number;
  energy: number;
  hand: string[];
  queue: string[];
  connected: boolean;
  towers: NetMap<NetTower>;
  damageDealt: number;
  cardsPlayed: number;
  energySpent: number;
  towersDestroyed: number;
}

export interface NetState {
  phase: MatchPhase;
  countdown: number;
  timeRemaining: number;
  winnerId: string;
  endReason: EndReason | "";
  players: NetMap<NetPlayer>;
  units: NetMap<NetUnit>;
  projectiles: NetMap<NetProjectile>;
}
