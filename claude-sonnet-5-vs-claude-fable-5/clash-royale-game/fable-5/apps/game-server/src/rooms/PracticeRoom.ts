import { DEFAULT_DECK, type MatchMode } from "@arcane/shared";
import type { Client } from "@colyseus/core";
import { BotController } from "../simulation/bot";
import { BaseBattleRoom, type JoinOptions } from "./BaseBattleRoom";

/** Durable id of the seeded practice-bot player row. */
export const BOT_PERSISTENT_ID = "bot-trainer";

/** Single-player room against a scripted opponent, reusing the same sim. */
export class PracticeRoom extends BaseBattleRoom {
  readonly mode: MatchMode = "practice";
  protected readonly expectedHumans = 1;
  maxClients = 1;

  private bot?: BotController;

  onJoin(client: Client, options: JoinOptions): void {
    this.addHumanPlayer(client, options);

    const botPlayer = this.sim.addPlayer({
      id: "bot",
      name: "Training Golem",
      side: 1,
      deck: [...DEFAULT_DECK],
      isBot: true,
    });
    botPlayer.persistentId = BOT_PERSISTENT_ID;
    this.bot = new BotController(this.sim, botPlayer.id);

    this.lock();
    this.tryStartCountdown();
  }

  protected override onSimTick(dt: number): void {
    this.bot?.update(dt);
  }
}
