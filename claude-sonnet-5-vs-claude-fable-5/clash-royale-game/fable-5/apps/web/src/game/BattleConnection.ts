import {
  ENERGY,
  MSG,
  type DeployRejectedMessage,
  type EffectMessage,
  type EmoteBroadcastMessage,
  type EndReason,
  type MatchMode,
} from "@arcane/shared";
import { Client, type Room } from "colyseus.js";
import type { NetPlayer, NetState, NetTower } from "./netTypes";

export type ConnectionStatus =
  | "connecting"
  | "searching"
  | "countdown"
  | "active"
  | "finished"
  | "disconnected"
  | "error";

export interface TowerHud {
  id: string;
  kind: string;
  hp: number;
  maxHp: number;
}

export interface PlayerHud {
  id: string;
  name: string;
  side: number;
  energy: number;
  hand: string[];
  nextCard: string | null;
  towers: TowerHud[];
  towersDestroyed: number;
  damageDealt: number;
  cardsPlayed: number;
  energySpent: number;
  connected: boolean;
}

export interface HudSnapshot {
  status: ConnectionStatus;
  countdown: number;
  timeRemaining: number;
  overtime: boolean;
  me: PlayerHud | null;
  opponent: PlayerHud | null;
  winnerId: string;
  endReason: EndReason | "";
  mySessionId: string;
  selectedCardId: string | null;
  errorMessage: string | null;
}

const INITIAL_SNAPSHOT: HudSnapshot = {
  status: "connecting",
  countdown: 0,
  timeRemaining: 0,
  overtime: false,
  me: null,
  opponent: null,
  winnerId: "",
  endReason: "",
  mySessionId: "",
  selectedCardId: null,
  errorMessage: null,
};

interface EventMap {
  effect: EffectMessage;
  rejected: DeployRejectedMessage;
  emote: EmoteBroadcastMessage;
}

/**
 * Owns the Colyseus room and exposes:
 *  - an immutable HUD snapshot for React (via useSyncExternalStore),
 *  - transient game events (spells, rejections, emotes) for Phaser/toasts,
 *  - intent senders (deploy, surrender, emote).
 */
export class BattleConnection {
  private client: Client;
  private room: Room | null = null;
  private snapshot: HudSnapshot = INITIAL_SNAPSHOT;
  private listeners = new Set<() => void>();
  private handlers = new Map<keyof EventMap, Set<(payload: never) => void>>();
  private selectedCardId: string | null = null;
  private closedByUs = false;
  private lostConnection = false;
  private tokenKey = "arcane.reconnect";

  constructor(serverUrl: string) {
    this.client = new Client(serverUrl);
  }

  // ----- React store interface -------------------------------------------

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): HudSnapshot => this.snapshot;

  on<K extends keyof EventMap>(
    event: K,
    fn: (payload: EventMap[K]) => void,
  ): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(fn as (payload: never) => void);
    return () => set.delete(fn as (payload: never) => void);
  }

  private emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    this.handlers.get(event)?.forEach((fn) => (fn as (p: EventMap[K]) => void)(payload));
  }

  // ----- lifecycle ---------------------------------------------------------

  async connect(
    mode: MatchMode,
    opts: { playerId: string; name: string; deck: string[] },
  ): Promise<void> {
    const roomName = mode === "pvp" ? "battle" : "practice";
    this.tokenKey = `arcane.reconnect.${roomName}`;

    // Resume a live match after a page refresh, if possible.
    const savedToken = sessionStorage.getItem(this.tokenKey);
    if (savedToken) {
      try {
        this.room = await this.client.reconnect(savedToken);
      } catch {
        sessionStorage.removeItem(this.tokenKey);
      }
    }
    if (!this.room) {
      try {
        this.room = await this.client.joinOrCreate(roomName, opts);
      } catch (err) {
        this.snapshot = {
          ...INITIAL_SNAPSHOT,
          status: "error",
          errorMessage:
            err instanceof Error && err.message
              ? err.message
              : "Could not reach the game server. Is it running?",
        };
        this.notify();
        return;
      }
    }

    sessionStorage.setItem(this.tokenKey, this.room.reconnectionToken);
    this.wire();
    this.room.send(MSG.ready);
    this.refresh();
  }

  getRoom(): Room | null {
    return this.room;
  }

  get mySessionId(): string {
    return this.room?.sessionId ?? "";
  }

  leave(): void {
    this.closedByUs = true;
    sessionStorage.removeItem(this.tokenKey);
    void this.room?.leave();
    this.room = null;
  }

  // ----- intents -----------------------------------------------------------

  setSelectedCard(cardId: string | null): void {
    this.selectedCardId = cardId;
    this.refresh();
  }

  deploy(cardId: string, x: number, y: number): void {
    this.room?.send(MSG.deploy, { cardId, x, y });
  }

  surrender(): void {
    this.room?.send(MSG.surrender);
  }

  sendEmote(emoteId: number): void {
    this.room?.send(MSG.emote, { emoteId });
  }

  // ----- internals -----------------------------------------------------------

  private wire(): void {
    const room = this.room;
    if (!room) return;

    room.onStateChange(() => this.refresh());
    room.onMessage(MSG.effect, (msg: EffectMessage) => this.emit("effect", msg));
    room.onMessage(MSG.deployRejected, (msg: DeployRejectedMessage) =>
      this.emit("rejected", msg),
    );
    room.onMessage(MSG.emoteBroadcast, (msg: EmoteBroadcastMessage) =>
      this.emit("emote", msg),
    );
    room.onError((_code, message) => {
      this.snapshot = {
        ...this.snapshot,
        status: "error",
        errorMessage: message ?? "Room error",
      };
      this.notify();
    });
    room.onLeave(() => {
      if (this.closedByUs) return;
      const phase = (room.state as NetState | undefined)?.phase;
      if (phase !== "finished") {
        this.lostConnection = true;
      }
      this.refresh();
    });
  }

  private refresh(): void {
    const room = this.room;
    if (!room) return;
    const state = room.state as unknown as NetState | undefined;
    if (!state || state.players === undefined) return;

    let me: PlayerHud | null = null;
    let opponent: PlayerHud | null = null;
    state.players.forEach((p) => {
      const hud = toPlayerHud(p);
      if (p.id === room.sessionId || (p as { sessionId?: string }).sessionId === room.sessionId) {
        me = hud;
      } else {
        opponent = hud;
      }
    });

    let status: ConnectionStatus;
    switch (state.phase) {
      case "waiting":
        status = "searching";
        break;
      case "countdown":
        status = "countdown";
        break;
      case "active":
        status = "active";
        break;
      case "finished":
        status = "finished";
        sessionStorage.removeItem(this.tokenKey);
        break;
      default:
        status = "connecting";
    }
    if (this.lostConnection && status !== "finished") status = "disconnected";

    this.snapshot = {
      status,
      countdown: state.countdown,
      timeRemaining: state.timeRemaining,
      overtime: state.phase === "active" && state.timeRemaining <= ENERGY.overtimeThreshold,
      me,
      opponent,
      winnerId: state.winnerId,
      endReason: state.endReason,
      mySessionId: room.sessionId,
      selectedCardId: this.selectedCardId,
      errorMessage: this.snapshot.errorMessage,
    };
    this.notify();
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }
}

function toPlayerHud(p: NetPlayer): PlayerHud {
  const towers: TowerHud[] = [];
  p.towers.forEach((t: NetTower) =>
    towers.push({ id: t.id, kind: t.kind, hp: t.hp, maxHp: t.maxHp }),
  );
  towers.sort((a, b) => a.id.localeCompare(b.id));
  return {
    id: p.id,
    name: p.name,
    side: p.side,
    energy: p.energy,
    hand: [...p.hand],
    nextCard: p.queue.length > 0 ? p.queue[0] : null,
    towers,
    towersDestroyed: p.towersDestroyed,
    damageDealt: p.damageDealt,
    cardsPlayed: p.cardsPlayed,
    energySpent: p.energySpent,
    connected: p.connected,
  };
}
