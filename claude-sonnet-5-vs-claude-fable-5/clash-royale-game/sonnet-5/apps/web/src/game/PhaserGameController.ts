import Phaser from "phaser";
import { BattleScene } from "./BattleScene";
import type { BattleRoom, Side } from "./battleTypes";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./coords";
import { EventBus } from "./EventBus";

export class PhaserGameController {
  private game: Phaser.Game | null = null;

  mount(parent: HTMLElement, room: BattleRoom, mySide: Side): void {
    if (this.game) return;

    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      transparent: true,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [BattleScene],
    });

    this.game.registry.set("room", room);
    this.game.registry.set("mySide", mySide);
  }

  destroy(): void {
    this.game?.destroy(true);
    this.game = null;
  }

  getEventBus() {
    return EventBus;
  }
}
