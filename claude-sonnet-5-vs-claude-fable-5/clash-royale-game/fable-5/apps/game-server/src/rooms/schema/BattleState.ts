import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import type {
  EndReason,
  MatchPhase,
  TargetPriority,
  TowerKind,
  UnitBehaviorState,
} from "@arcane/shared";

/**
 * Synced state schemas. Decorated fields replicate to clients; plain fields
 * are simulation-internal and never leave the server.
 */

export class TowerState extends Schema {
  @type("string") id = "";
  @type("string") ownerId = "";
  @type("string") kind: TowerKind = "side";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") hp = 0;
  @type("number") maxHp = 0;

  // sim-only
  damage = 0;
  range = 0;
  attackInterval = 1;
  radius = 1;
  cooldown = 0;
}

export class UnitState extends Schema {
  @type("string") id = "";
  @type("string") ownerId = "";
  @type("string") cardId = "";
  @type("uint8") side: 0 | 1 = 0;
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") hp = 0;
  @type("number") maxHp = 0;
  @type("string") state: UnitBehaviorState = "moving";
  @type("string") targetId = "";
  @type("boolean") slowed = false;
  @type("boolean") isBuilding = false;

  // sim-only
  damage = 0;
  range = 0;
  attackInterval = 1;
  speed = 0;
  sight = 5;
  radius = 0.4;
  targets: TargetPriority = "any";
  splashRadius = 0;
  projectileSpeed = 0;
  cooldown = 0;
  /** Sim-time timestamp until which the unit is slowed. */
  slowUntil = 0;
  /** Remaining lifetime for buildings; Infinity for troops. */
  lifetime = Infinity;
}

export class ProjectileState extends Schema {
  @type("string") id = "";
  @type("string") cardId = "";
  @type("number") x = 0;
  @type("number") y = 0;

  // sim-only
  ownerId = "";
  targetId = "";
  damage = 0;
  speed = 8;
  splashRadius = 0;
}

export class PlayerState extends Schema {
  @type("string") id = "";
  @type("string") name = "";
  @type("uint8") side: 0 | 1 = 0;
  @type("number") energy = 0;
  @type(["string"]) hand = new ArraySchema<string>();
  @type(["string"]) queue = new ArraySchema<string>();
  @type("boolean") connected = true;
  @type({ map: TowerState }) towers = new MapSchema<TowerState>();

  // match stats (synced so the result screen has them without extra plumbing)
  @type("number") damageDealt = 0;
  @type("uint16") cardsPlayed = 0;
  @type("uint16") energySpent = 0;
  @type("uint8") towersDestroyed = 0;

  // sim-only
  sessionId = "";
  /** Durable profile id used for persistence (PlayerState.id is per-session). */
  persistentId = "";
  isBot = false;
}

export class BattleState extends Schema {
  @type("string") phase: MatchPhase = "waiting";
  @type("uint8") countdown = 0;
  @type("number") timeRemaining = 0;
  @type("string") winnerId = "";
  @type("string") endReason: EndReason | "" = "";
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: UnitState }) units = new MapSchema<UnitState>();
  @type({ map: ProjectileState }) projectiles = new MapSchema<ProjectileState>();

  // sim-only
  simTime = 0;
}
