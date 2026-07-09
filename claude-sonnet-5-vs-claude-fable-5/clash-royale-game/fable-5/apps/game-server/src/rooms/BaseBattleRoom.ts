import {
  DEFAULT_DECK,
  isValidDeck,
  MATCH,
  MSG,
  type DeployMessage,
  type EmoteMessage,
  type MatchMode,
} from "@arcane/shared";
import { Room, type Client } from "@colyseus/core";
import { persistMatch } from "../persistence";
import { BattleSimulation } from "../simulation/BattleSimulation";
import { BattleState, type PlayerState } from "./schema/BattleState";

export interface JoinOptions {
  playerId?: string;
  name?: string;
  deck?: string[];
}

/**
 * Shared room behavior for PvP and Practice battles. Rooms stay thin: they
 * translate client intents into simulation calls and broadcast sim events.
 */
export abstract class BaseBattleRoom extends Room<BattleState> {
  abstract readonly mode: MatchMode;
  /** How many human clients are expected before the countdown can start. */
  protected abstract readonly expectedHumans: number;

  state = new BattleState();
  protected sim = new BattleSimulation(this.state);
  protected readySessions = new Set<string>();
  private persisted = false;

  onCreate(): void {
    this.onMessage(MSG.ready, (client) => this.handleReady(client));
    this.onMessage(MSG.deploy, (client, msg: DeployMessage) =>
      this.handleDeploy(client, msg),
    );
    this.onMessage(MSG.surrender, (client) => {
      const player = this.playerFor(client);
      if (player && this.state.phase === "active") {
        this.sim.surrender(player.id);
        this.flushEvents();
      }
    });
    this.onMessage(MSG.emote, (client, msg: EmoteMessage) => {
      const player = this.playerFor(client);
      if (player && typeof msg?.emoteId === "number") {
        this.broadcast(MSG.emoteBroadcast, {
          playerId: player.id,
          emoteId: msg.emoteId,
        });
      }
    });

    this.setSimulationInterval(
      (deltaMs) => this.tick(deltaMs / 1000),
      1000 / MATCH.tickRate,
    );
  }

  /** Hook for subclasses that need per-tick work (e.g. the practice bot). */
  protected onSimTick(_dt: number): void {}

  private tick(dt: number): void {
    if (this.state.phase !== "active") return;
    this.onSimTick(dt);
    this.sim.tick(dt);
    this.flushEvents();
  }

  protected addHumanPlayer(client: Client, options: JoinOptions): PlayerState {
    const name = sanitizeName(options?.name);
    const persistentId =
      typeof options?.playerId === "string" && options.playerId.length > 0
        ? options.playerId.slice(0, 64)
        : client.sessionId;
    const deck = isValidDeck(options?.deck) ? options.deck : [...DEFAULT_DECK];

    // Players are keyed by sessionId so two tabs sharing one guest profile
    // can still fight each other; persistentId is what reaches the database.
    const player = this.sim.addPlayer({
      id: client.sessionId,
      name,
      side: this.state.players.size === 0 ? 0 : 1,
      deck: shuffle(deck),
      sessionId: client.sessionId,
      isBot: false,
    });
    player.persistentId = persistentId;
    return player;
  }

  private handleReady(client: Client): void {
    this.readySessions.add(client.sessionId);
    this.tryStartCountdown();
  }

  protected tryStartCountdown(): void {
    if (this.state.phase !== "waiting") return;
    if (this.state.players.size < this.expectedHumans) return;
    for (const player of this.state.players.values()) {
      if (!player.isBot && !this.readySessions.has(player.sessionId)) return;
    }
    this.startCountdown();
  }

  protected startCountdown(): void {
    if (this.state.phase !== "waiting") return;
    this.lock();
    this.state.phase = "countdown";
    this.state.countdown = MATCH.countdownSec;
    const interval = this.clock.setInterval(() => {
      this.state.countdown -= 1;
      if (this.state.countdown <= 0) {
        interval.clear();
        this.sim.begin();
      }
    }, 1000);
  }

  private handleDeploy(client: Client, msg: DeployMessage): void {
    const player = this.playerFor(client);
    if (!player) return;

    const cardId = typeof msg?.cardId === "string" ? msg.cardId : "";
    const result = this.sim.deploy(
      player.id,
      cardId,
      Number(msg?.x),
      Number(msg?.y),
    );
    if (!result.ok) {
      client.send(MSG.deployRejected, { cardId, reason: result.reason });
    } else {
      // Broadcast deploy/spell effects immediately for snappy feedback.
      this.flushEvents();
    }
  }

  protected flushEvents(): void {
    for (const event of this.sim.events) {
      if (event.type === "effect") {
        this.broadcast(MSG.effect, {
          kind: event.kind,
          x: event.x,
          y: event.y,
          radius: event.radius,
        });
      } else if (event.type === "finished") {
        this.onMatchFinished();
      }
    }
    this.sim.events.length = 0;
  }

  private onMatchFinished(): void {
    if (this.persisted) return;
    this.persisted = true;
    this.lock();
    persistMatch(this.state, this.mode).catch((err) =>
      console.error(`[${this.roomId}] failed to persist match:`, err),
    );
    // Safety net: force-dispose if clients linger on the result screen.
    this.clock.setTimeout(() => this.disconnect(), 120_000);
  }

  async onLeave(client: Client, consented: boolean): Promise<void> {
    const player = this.playerFor(client);
    if (!player || this.state.phase === "finished") return;

    if (this.state.phase === "waiting") {
      // Still matchmaking — free the slot for someone else.
      this.state.players.delete(player.id);
      this.readySessions.delete(client.sessionId);
      return;
    }

    player.connected = false;
    if (consented) {
      // Deliberate exit mid-match counts as giving up.
      this.sim.forfeit(player.id, "disconnect");
      this.flushEvents();
      return;
    }

    try {
      await this.allowReconnection(client, MATCH.reconnectGraceSec);
      player.connected = true;
    } catch {
      // Phase may have changed while we waited for the reconnection window.
      if (!this.isFinished()) {
        this.sim.forfeit(player.id, "disconnect");
        this.flushEvents();
      }
    }
  }

  private isFinished(): boolean {
    return this.state.phase === "finished";
  }

  protected playerFor(client: Client): PlayerState | undefined {
    for (const player of this.state.players.values()) {
      if (player.sessionId === client.sessionId) return player;
    }
    return undefined;
  }
}

function sanitizeName(name: unknown): string {
  const cleaned = typeof name === "string" ? name.trim().slice(0, 20) : "";
  return cleaned.length > 0 ? cleaned : "Challenger";
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
