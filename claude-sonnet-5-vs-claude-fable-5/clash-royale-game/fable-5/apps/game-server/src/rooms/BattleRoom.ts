import { MATCH, type MatchMode } from "@arcane/shared";
import type { Client } from "@colyseus/core";
import { BaseBattleRoom, type JoinOptions } from "./BaseBattleRoom";

/**
 * Ranked 1v1 room. Matchmaking is handled by Colyseus' `joinOrCreate`:
 * the first player creates the room and waits; the second fills it, the room
 * locks, and the countdown starts once both clients report ready.
 */
export class BattleRoom extends BaseBattleRoom {
  readonly mode: MatchMode = "pvp";
  protected readonly expectedHumans = 2;
  maxClients = 2;

  onJoin(client: Client, options: JoinOptions): void {
    this.addHumanPlayer(client, options);

    if (this.state.players.size === this.expectedHumans) {
      this.lock();
      // If a client never signals ready (e.g. stalled load), start anyway.
      this.clock.setTimeout(() => {
        if (this.state.phase === "waiting") this.startCountdown();
      }, MATCH.readyTimeoutSec * 1000);
      this.tryStartCountdown();
    }
  }
}
