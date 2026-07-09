import Phaser from "phaser";
import type { Side, TowerKind } from "../battleTypes";
import { towerTextureKey } from "../vfx/SpriteFactory";
import { HealthBar } from "./HealthBar";

const TOWER_SIZE_SIDE = 56;
const TOWER_SIZE_KING = 72;

export class TowerSprite {
  readonly container: Phaser.GameObjects.Container;
  private image: Phaser.GameObjects.Image;
  private healthBar: HealthBar;

  constructor(
    scene: Phaser.Scene,
    kind: TowerKind,
    side: Side,
    screenX: number,
    screenY: number,
    health: number,
    maxHealth: number,
  ) {
    const size = kind === "king" ? TOWER_SIZE_KING : TOWER_SIZE_SIDE;
    this.image = scene.add.image(0, 0, towerTextureKey(kind, side)).setDisplaySize(size, size);
    this.container = scene.add.container(screenX, screenY, [this.image]);
    this.container.setDepth(screenY);

    this.healthBar = new HealthBar(scene, this.container, size * 1.1, -size / 2 - 14, 7);
    this.setHealth(health, maxHealth);
  }

  setHealth(health: number, maxHealth: number): void {
    const ratio = health / maxHealth;
    this.healthBar.setRatio(ratio, ratio > 0.3 ? 0xfbbf24 : 0xf87171);
  }

  setDestroyed(destroyed: boolean): void {
    this.image.setTint(destroyed ? 0x4b5563 : 0xffffff);
    this.image.setAlpha(destroyed ? 0.55 : 1);
    this.healthBar.setVisible(!destroyed);
  }

  setActivated(activated: boolean): void {
    this.image.setAlpha(activated ? 1 : 0.6);
  }

  destroy(): void {
    this.healthBar.destroy();
    this.container.destroy();
  }
}
