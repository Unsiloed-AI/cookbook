import {
  BOT_DISPLAY_NAME,
  BOT_PLAYER_ID,
  buildInitialCycle,
  CLIENT_INTENT,
  COUNTDOWN_MS,
  DECK_SIZE,
  EMOTE_IDS,
  ENERGY_START,
  getHand,
  getNextCard,
  isValidCardId,
  MATCH_DURATION_MS,
  MAX_COUNTDOWN_WAIT_MS,
  RECONNECT_WINDOW_SECONDS,
  ROOM_DISPOSAL_GRACE_MS,
  SERVER_EVENT,
  STARTER_DECK_CARD_IDS,
  TICK_MS,
  TOWER_POSITIONS,
  getTowerDefinition,
  type DeployCardIntent,
  type EmoteBroadcastPayload,
  type MatchMode,
  type RequestEmoteIntent,
  type Side,
} from "@arcane-towers/shared";
import { Room, type Client } from "colyseus";
import { persistMatchResult } from "../persistence/matchResultWriter.js";
import { BattleState } from "../schema/BattleState.js";
import { PlayerState } from "../schema/PlayerState.js";
import { TowerState } from "../schema/TowerState.js";
import { tick as simulationTick } from "../simulation/BattleSimulation.js";
import { validateAndDeploy } from "../simulation/deployment.js";
import type { PlayerRuntimeMap } from "../simulation/types.js";
import { resolveDisconnectWin, resolveSurrender } from "../simulation/winConditions.js";
import { BotController } from "./BotController.js";

const BOT_SESSION_ID = "bot-session";

interface JoinOptions {
  playerId?: string;
  username?: string;
  deckCardIds?: unknown;
}

export class BattleRoom extends Room<BattleState> {
  private mode: MatchMode = "pvp";
  private runtime: PlayerRuntimeMap = new Map();
  private botController: BotController | null = null;
  private countdownElapsedMs = 0;
  private resultPersisted = false;

  onCreate(options: { mode?: MatchMode }): void {
    this.mode = options.mode ?? "pvp";
    this.maxClients = this.mode === "practice" ? 1 : 2;

    this.state = new BattleState();
    this.state.matchId = this.roomId;
    this.state.mode = this.mode;
    this.state.phase = "waiting";
    this.state.matchTimeRemainingMs = MATCH_DURATION_MS;

    this.setupTowers();

    this.onMessage(CLIENT_INTENT.DEPLOY_CARD, (client, message: DeployCardIntent) =>
      this.handleDeployCard(client, message),
    );
    this.onMessage(CLIENT_INTENT.SELECT_CARD, () => {
      // Cosmetic only — no authoritative effect. Reserved for future opponent-preview hooks.
    });
    this.onMessage(CLIENT_INTENT.REQUEST_EMOTE, (client, message: RequestEmoteIntent) =>
      this.handleEmote(client, message),
    );
    this.onMessage(CLIENT_INTENT.SURRENDER, (client) => this.handleSurrender(client));
    this.onMessage(CLIENT_INTENT.READY, (client) => this.handleReady(client));

    if (this.mode === "practice") {
      this.addBotPlayer();
    }

    this.setSimulationInterval((deltaMs) => this.update(deltaMs), TICK_MS);
  }

  onJoin(client: Client, options: JoinOptions): void {
    const humanCount = [...this.state.players.values()].filter((p) => !p.isBot).length;
    const side: Side = humanCount === 0 ? "host" : "guest";

    const player = new PlayerState();
    player.sessionId = client.sessionId;
    player.playerId = options?.playerId ?? client.sessionId;
    player.name = (options?.username ?? "Player").slice(0, 20);
    player.side = side;
    player.energy = ENERGY_START;
    player.connected = true;
    this.state.players.set(client.sessionId, player);

    const deck = this.resolveDeck(options?.deckCardIds);
    const cycle = buildInitialCycle(deck);
    this.runtime.set(client.sessionId, { fullCycle: cycle, energyAccumMs: 0 });
    for (const id of getHand(cycle)) player.hand.push(id);
    player.nextCard = getNextCard(cycle);

    this.maybeStartCountdown();
  }

  async onLeave(client: Client, consented: boolean): Promise<void> {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    player.connected = false;

    if (this.state.phase !== "active") return;

    if (!consented) {
      try {
        await this.allowReconnection(client, RECONNECT_WINDOW_SECONDS);
        player.connected = true;
        return;
      } catch {
        // Reconnection window expired or was rejected — fall through to disconnect resolution.
      }
    }

    if (this.state.phase === "active") {
      const remainingSide: Side = player.side === "host" ? "guest" : "host";
      const remainingPlayer = [...this.state.players.values()].find((p) => p.side === remainingSide);
      if (remainingPlayer && (remainingPlayer.connected || remainingPlayer.isBot)) {
        resolveDisconnectWin(this.state, remainingSide, Date.now());
      }
    }
  }

  private update(deltaMs: number): void {
    if (this.state.phase === "countdown") {
      this.state.countdownRemainingMs = Math.max(0, this.state.countdownRemainingMs - deltaMs);
      this.countdownElapsedMs += deltaMs;

      const allReady = [...this.state.players.values()].every((p) => p.isBot || p.ready);
      const timerDone = this.state.countdownRemainingMs <= 0;

      if ((timerDone && allReady) || this.countdownElapsedMs >= MAX_COUNTDOWN_WAIT_MS) {
        this.startMatch();
      }
      return;
    }

    simulationTick(this.state, this.runtime, deltaMs);

    if (this.botController) {
      this.botController.tick(this.state, this.runtime, Date.now());
    }

    if (this.state.phase === "finished" && !this.resultPersisted) {
      this.resultPersisted = true;
      void this.handleMatchFinished();
    }
  }

  private handleDeployCard(client: Client, message: DeployCardIntent): void {
    const handIndex = Number(message?.handIndex);
    const x = Number(message?.x);
    const y = Number(message?.y);

    const outcome = validateAndDeploy(this.state, this.runtime, client.sessionId, handIndex, x, y, Date.now());
    if (!outcome.ok) {
      this.send(client, SERVER_EVENT.DEPLOY_REJECTED, { reason: outcome.reason, handIndex });
    }
  }

  private handleSurrender(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (!player || this.state.phase !== "active") return;
    resolveSurrender(this.state, player.side, Date.now());
  }

  private handleReady(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (player) player.ready = true;
  }

  private handleEmote(client: Client, message: RequestEmoteIntent): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    if (!EMOTE_IDS.includes(message?.emoteId)) return;

    const payload: EmoteBroadcastPayload = { side: player.side, emoteId: message.emoteId };
    this.broadcast(SERVER_EVENT.EMOTE, payload);
  }

  private async handleMatchFinished(): Promise<void> {
    try {
      await persistMatchResult(this.state, this.mode);
    } catch (err) {
      console.error("[BattleRoom] failed to persist match result", err);
    }

    this.clock.setTimeout(() => {
      this.disconnect();
    }, ROOM_DISPOSAL_GRACE_MS);
  }

  private setupTowers(): void {
    for (const pos of TOWER_POSITIONS) {
      const tower = new TowerState();
      tower.id = pos.id;
      tower.ownerSide = pos.side;
      tower.kind = pos.kind;
      tower.x = pos.x;
      tower.y = pos.y;
      const def = getTowerDefinition(pos.kind);
      tower.health = def.health;
      tower.maxHealth = def.health;
      tower.activated = pos.kind === "side";
      this.state.towers.set(tower.id, tower);
    }
  }

  private addBotPlayer(): void {
    const bot = new PlayerState();
    bot.sessionId = BOT_SESSION_ID;
    bot.playerId = BOT_PLAYER_ID;
    bot.name = BOT_DISPLAY_NAME;
    bot.side = "guest";
    bot.isBot = true;
    bot.connected = true;
    bot.energy = ENERGY_START;
    this.state.players.set(bot.sessionId, bot);

    const cycle = buildInitialCycle(STARTER_DECK_CARD_IDS);
    this.runtime.set(bot.sessionId, { fullCycle: cycle, energyAccumMs: 0 });
    for (const id of getHand(cycle)) bot.hand.push(id);
    bot.nextCard = getNextCard(cycle);

    this.botController = new BotController(bot.sessionId);
  }

  private maybeStartCountdown(): void {
    if (this.state.phase !== "waiting") return;
    const requiredHumans = this.mode === "practice" ? 1 : 2;
    const humanCount = [...this.state.players.values()].filter((p) => !p.isBot).length;

    if (humanCount >= requiredHumans) {
      this.state.phase = "countdown";
      this.state.countdownRemainingMs = COUNTDOWN_MS;
      this.countdownElapsedMs = 0;
    }
  }

  private startMatch(): void {
    this.state.phase = "active";
    this.state.matchTimeRemainingMs = MATCH_DURATION_MS;
    this.state.elapsedMs = 0;
  }

  private resolveDeck(candidate: unknown): string[] {
    if (Array.isArray(candidate) && candidate.length === DECK_SIZE) {
      const unique = new Set(candidate);
      if (unique.size === DECK_SIZE && candidate.every((id) => typeof id === "string" && isValidCardId(id))) {
        return candidate as string[];
      }
    }
    return [...STARTER_DECK_CARD_IDS];
  }
}
