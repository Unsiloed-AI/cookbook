import {
  ARENA,
  ENERGY,
  MATCH,
  TOWER_DEFS,
  towerPositions,
  type CardDef,
  type EffectKind,
  type EndReason,
  type Side,
} from "@arcane/shared";
import {
  BattleState,
  PlayerState,
  ProjectileState,
  TowerState,
  UnitState,
} from "../rooms/schema/BattleState";
import { updateCombat } from "./combat";
import { cycleHand, validateDeploy } from "./deploy";
import {
  dist,
  livingEnemyUnits,
  opponentOf,
  standingEnemyTowers,
  type Targetable,
} from "./helpers";
import { regenEnergy } from "./energy";
import { updateMovement } from "./movement";
import { castSpell } from "./spells";
import { updateTargeting } from "./targeting";
import { checkWinConditions } from "./winConditions";

export type SimEvent =
  | { type: "effect"; kind: EffectKind; x: number; y: number; radius?: number }
  | { type: "finished" };

export type DeployOutcome = { ok: true } | { ok: false; reason: string };

/**
 * Server-authoritative battle simulation. Owns all game rules; the Colyseus
 * rooms are thin adapters that forward intents and broadcast `events`.
 */
export class BattleSimulation {
  readonly state: BattleState;
  readonly events: SimEvent[] = [];
  private seq = 0;

  constructor(state: BattleState = new BattleState()) {
    this.state = state;
  }

  addPlayer(opts: {
    id: string;
    name: string;
    side: Side;
    deck: string[];
    sessionId?: string;
    isBot?: boolean;
  }): PlayerState {
    const p = new PlayerState();
    p.id = opts.id;
    p.name = opts.name;
    p.side = opts.side;
    p.energy = ENERGY.start;
    p.sessionId = opts.sessionId ?? "";
    p.isBot = opts.isBot ?? false;
    p.hand.push(...opts.deck.slice(0, MATCH.handSize));
    p.queue.push(...opts.deck.slice(MATCH.handSize));

    for (const pos of towerPositions(opts.side)) {
      const def = TOWER_DEFS[pos.kind];
      const t = new TowerState();
      t.id = pos.id;
      t.ownerId = opts.id;
      t.kind = pos.kind;
      t.x = pos.x;
      t.y = pos.y;
      t.hp = def.health;
      t.maxHp = def.health;
      t.damage = def.damage;
      t.range = def.range;
      t.attackInterval = def.attackInterval;
      t.radius = def.radius;
      p.towers.set(t.id, t);
    }

    this.state.players.set(p.id, p);
    return p;
  }

  begin(): void {
    this.state.phase = "active";
    this.state.timeRemaining = MATCH.durationSec;
  }

  tick(dt: number): void {
    const { state } = this;
    if (state.phase !== "active") return;

    state.simTime += dt;
    state.timeRemaining = Math.max(0, state.timeRemaining - dt);

    regenEnergy(state, dt);
    this.updateTimedEffects(dt);
    updateTargeting(state);
    updateMovement(state, dt);
    updateCombat(this, dt);
    this.reapDead();
    checkWinConditions(this);
  }

  /** Validate and execute a card play. Returns a rejection reason on failure. */
  deploy(playerId: string, cardId: string, x: number, y: number): DeployOutcome {
    const v = validateDeploy(this.state, playerId, cardId, x, y);
    if (!v.ok) return v;

    const { player, card } = v;
    player.energy -= card.cost;
    player.cardsPlayed += 1;
    player.energySpent += card.cost;
    cycleHand(player, cardId);

    if (card.type === "spell") {
      castSpell(this, player, card, x, y);
    } else {
      const count = card.unit?.count ?? 1;
      for (let i = 0; i < count; i++) {
        const [ox, oy] = spawnOffset(i, count);
        this.spawnUnit(player, card, x + ox, y + oy);
      }
      this.events.push({ type: "effect", kind: "deploy", x, y });
    }
    return { ok: true };
  }

  spawnUnit(owner: PlayerState, card: CardDef, x: number, y: number): UnitState {
    const stats = card.unit;
    if (!stats) throw new Error(`Card ${card.id} has no unit stats`);

    const u = new UnitState();
    u.id = `u${++this.seq}`;
    u.ownerId = owner.id;
    u.cardId = card.id;
    u.side = owner.side;
    u.x = clamp(x, stats.radius, ARENA.width - stats.radius);
    u.y = clamp(y, stats.radius, ARENA.height - stats.radius);
    u.hp = stats.health;
    u.maxHp = stats.health;
    u.damage = stats.damage;
    u.range = stats.range;
    u.attackInterval = stats.attackInterval;
    u.speed = stats.speed;
    u.sight = stats.sight;
    u.radius = stats.radius;
    u.targets = stats.targets;
    u.splashRadius = stats.splashRadius ?? 0;
    u.projectileSpeed = stats.projectileSpeed ?? 0;
    u.isBuilding = card.type === "building";
    u.lifetime = stats.lifetime ?? Infinity;

    this.state.units.set(u.id, u);
    return u;
  }

  spawnProjectile(opts: {
    ownerId: string;
    cardId: string;
    x: number;
    y: number;
    targetId: string;
    damage: number;
    speed: number;
    splashRadius: number;
  }): void {
    const pr = new ProjectileState();
    pr.id = `p${++this.seq}`;
    pr.cardId = opts.cardId;
    pr.x = opts.x;
    pr.y = opts.y;
    pr.ownerId = opts.ownerId;
    pr.targetId = opts.targetId;
    pr.damage = opts.damage;
    pr.speed = opts.speed;
    pr.splashRadius = opts.splashRadius;
    this.state.projectiles.set(pr.id, pr);
  }

  /** Apply damage to a unit or tower, crediting the source's stats. */
  dealDamage(
    sourceOwnerId: string,
    target: Targetable,
    amount: number,
    towerMultiplier = 1,
  ): void {
    const entity = target.entity;
    const raw = target.kind === "tower" ? amount * towerMultiplier : amount;
    const applied = Math.min(entity.hp, raw);
    if (applied <= 0) return;

    entity.hp -= applied;
    const source = this.state.players.get(sourceOwnerId);
    if (source) source.damageDealt += Math.round(applied);

    if (target.kind === "tower" && entity.hp <= 0) {
      const towerOwner = (entity as TowerState).ownerId;
      const opponent = opponentOf(this.state, towerOwner);
      if (opponent) opponent.towersDestroyed += 1;
      this.events.push({
        type: "effect",
        kind: "tower-explode",
        x: entity.x,
        y: entity.y,
      });
    }
  }

  /** Area damage around (x, y) hitting enemy units and towers. */
  dealSplashDamage(
    sourceOwnerId: string,
    x: number,
    y: number,
    radius: number,
    damage: number,
    towerMultiplier: number,
  ): void {
    for (const unit of livingEnemyUnits(this.state, sourceOwnerId)) {
      if (dist(x, y, unit.x, unit.y) - unit.radius <= radius) {
        this.dealDamage(sourceOwnerId, { kind: "unit", entity: unit }, damage);
      }
    }
    for (const tower of standingEnemyTowers(this.state, sourceOwnerId)) {
      if (dist(x, y, tower.x, tower.y) - tower.radius <= radius) {
        this.dealDamage(
          sourceOwnerId,
          { kind: "tower", entity: tower },
          damage,
          towerMultiplier,
        );
      }
    }
  }

  surrender(playerId: string): void {
    const opponent = opponentOf(this.state, playerId);
    this.finish(opponent?.id ?? "", "surrender");
  }

  /** End the match against a player (e.g. they abandoned the game). */
  forfeit(playerId: string, reason: EndReason): void {
    const opponent = opponentOf(this.state, playerId);
    this.finish(opponent?.id ?? "", reason);
  }

  finish(winnerId: string, reason: EndReason): void {
    if (this.state.phase === "finished") return;
    this.state.phase = "finished";
    this.state.winnerId = winnerId;
    this.state.endReason = reason;
    this.events.push({ type: "finished" });
  }

  /** Building lifetimes and slow-debuff expiry. */
  private updateTimedEffects(dt: number): void {
    for (const unit of this.state.units.values()) {
      if (Number.isFinite(unit.lifetime)) {
        unit.lifetime -= dt;
        if (unit.lifetime <= 0) unit.hp = 0;
      }
      if (unit.slowed && this.state.simTime >= unit.slowUntil) {
        unit.slowed = false;
      }
    }
  }

  private reapDead(): void {
    for (const unit of [...this.state.units.values()]) {
      if (unit.hp <= 0) {
        unit.state = "dead";
        this.state.units.delete(unit.id);
      }
    }
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Spread multi-unit spawns in a small ring around the drop point. */
function spawnOffset(i: number, n: number): [number, number] {
  if (n === 1) return [0, 0];
  const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
  return [Math.cos(angle) * 0.6, Math.sin(angle) * 0.6];
}
