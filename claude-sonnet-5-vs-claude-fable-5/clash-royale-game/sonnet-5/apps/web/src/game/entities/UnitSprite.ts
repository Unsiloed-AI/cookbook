import { getCardById } from "@arcane-towers/shared";
import Phaser from "phaser";
import { unitTextureKey } from "../vfx/SpriteFactory";
import { HealthBar } from "./HealthBar";

const UNIT_SIZE = 34;

export class UnitSprite {
  readonly container: Phaser.GameObjects.Container;
  private image: Phaser.GameObjects.Image;
  private healthBar: HealthBar;
  private lastHealth: number;

  constructor(
    scene: Phaser.Scene,
    cardId: string,
    screenX: number,
    screenY: number,
    health: number,
    maxHealth: number,
  ) {
    const card = getCardById(cardId);
    const size = card?.unit ? UNIT_SIZE * (0.85 + card.unit.hitboxRadius * 0.5) : UNIT_SIZE;

    this.image = scene.add.image(0, 0, unitTextureKey(cardId)).setDisplaySize(size, size);
    this.container = scene.add.container(screenX, screenY, [this.image]);
    this.container.setDepth(screenY);
    this.container.setScale(0.4);

    scene.tweens.add({ targets: this.container, scale: 1, duration: 220, ease: "Back.Out" });

    this.healthBar = new HealthBar(scene, this.container, size * 1.15, -size / 2 - 12);

    this.lastHealth = maxHealth;
    this.updateHealth(health, maxHealth);
  }

  moveToward(screenX: number, screenY: number, lerpFactor: number): void {
    this.container.x = Phaser.Math.Linear(this.container.x, screenX, lerpFactor);
    this.container.y = Phaser.Math.Linear(this.container.y, screenY, lerpFactor);
    this.container.setDepth(this.container.y);
  }

  setAttacking(attacking: boolean): void {
    const targetScale = attacking ? 1.08 : 1;
    if (Math.abs(this.container.scaleX - targetScale) > 0.02) {
      this.image.scene.tweens.add({ targets: this.container, scale: targetScale, duration: 120 });
    }
  }

  updateHealth(health: number, maxHealth: number): number {
    const damage = this.lastHealth - health;
    this.healthBar.setRatio(health / maxHealth, health / maxHealth > 0.3 ? 0x34d399 : 0xf87171);
    if (damage > 0) this.flash();
    this.lastHealth = health;
    return damage;
  }

  get screenX(): number {
    return this.container.x;
  }

  get screenY(): number {
    return this.container.y;
  }

  private flash(): void {
    this.image.setTintFill(0xffffff);
    this.image.scene.time.delayedCall(80, () => {
      if (this.image.active) this.image.clearTint();
    });
  }

  destroy(): void {
    this.healthBar.destroy();
    this.container.destroy();
  }
}
