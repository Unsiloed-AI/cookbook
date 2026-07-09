import Phaser from "phaser";

/**
 * The only channel Phaser and React use to talk to each other. It carries
 * exactly the signals with no corresponding network state — everything else
 * flows through the Colyseus Room, which both sides read independently.
 * Phaser never calls room.send() directly; only React does, via these events.
 */
export const CARD_SELECTED = "cardSelected";
export const CARD_DESELECTED = "cardDeselected";
export const DEPLOY_REQUESTED = "deployRequested";

export interface CardSelectedPayload {
  handIndex: number;
  cardId: string;
}

export interface DeployRequestedPayload {
  handIndex: number;
  worldX: number;
  worldY: number;
}

export const EventBus = new Phaser.Events.EventEmitter();
