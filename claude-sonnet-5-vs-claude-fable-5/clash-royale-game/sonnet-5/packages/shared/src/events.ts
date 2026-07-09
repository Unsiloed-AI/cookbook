import type { EmoteId } from "./constants.js";

// Client -> server intents. The server treats every one of these as untrusted
// input and re-validates against authoritative state before applying anything.
export interface DeployCardIntent {
  handIndex: number;
  x: number;
  y: number;
}

export interface SelectCardIntent {
  handIndex: number;
}

export interface RequestEmoteIntent {
  emoteId: EmoteId;
}

export type SurrenderIntent = Record<string, never>;
export type ReadyIntent = Record<string, never>;

export const CLIENT_INTENT = {
  DEPLOY_CARD: "deployCard",
  SELECT_CARD: "selectCard",
  REQUEST_EMOTE: "requestEmote",
  SURRENDER: "surrender",
  READY: "ready",
} as const;

export type ClientIntentType = (typeof CLIENT_INTENT)[keyof typeof CLIENT_INTENT];

// Server -> client ephemeral (non-schema) broadcasts. These are reserved for
// signals where a missed/late message is harmless — anything that affects
// correctness after a reconnect lives in synced Schema state instead.
export type DeployRejectionReason =
  | "matchNotActive"
  | "invalidPlayer"
  | "invalidHandIndex"
  | "unknownCard"
  | "insufficientEnergy"
  | "outOfBounds"
  | "invalidSideForTroop";

export interface DeployRejectedPayload {
  reason: DeployRejectionReason;
  handIndex: number;
}

export interface EmoteBroadcastPayload {
  side: "host" | "guest";
  emoteId: EmoteId;
}

export const SERVER_EVENT = {
  DEPLOY_REJECTED: "deployRejected",
  EMOTE: "emote",
} as const;
