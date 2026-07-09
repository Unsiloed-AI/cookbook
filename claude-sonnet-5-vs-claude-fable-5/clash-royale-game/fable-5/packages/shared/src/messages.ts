/** Message channel names exchanged over the Colyseus room. */
export const MSG = {
  // client -> server intents
  ready: "ready",
  deploy: "deploy",
  surrender: "surrender",
  emote: "emote",
  // server -> client events
  deployRejected: "deployRejected",
  effect: "effect",
  emoteBroadcast: "emoteBroadcast",
} as const;

export interface DeployMessage {
  cardId: string;
  x: number;
  y: number;
}

export interface DeployRejectedMessage {
  cardId: string;
  reason: string;
}

export type EffectKind =
  | "spell-fire"
  | "spell-frost"
  | "spell-bolt"
  | "deploy"
  | "tower-explode";

/** Transient visual events that are not part of persistent state. */
export interface EffectMessage {
  kind: EffectKind;
  x: number;
  y: number;
  radius?: number;
}

export interface EmoteMessage {
  emoteId: number;
}

export interface EmoteBroadcastMessage {
  playerId: string;
  emoteId: number;
}

export const EMOTES = ["👍", "😄", "😱", "🔥"] as const;
