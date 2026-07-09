import Phaser from "phaser";

export class HealthBar {
  private bg: Phaser.GameObjects.Graphics;
  private fill: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    private width: number,
    private yOffset: number,
    private height = 6,
  ) {
    this.bg = scene.add.graphics();
    this.fill = scene.add.graphics();
    this.bg.fillStyle(0x000000, 0.55);
    this.bg.fillRoundedRect(-width / 2, yOffset, width, height, height / 2);
    container.add([this.bg, this.fill]);
  }

  setRatio(ratio: number, color: number): void {
    const clamped = Phaser.Math.Clamp(ratio, 0, 1);
    this.fill.clear();
    if (clamped <= 0) return;
    this.fill.fillStyle(color, 1);
    this.fill.fillRoundedRect(-this.width / 2, this.yOffset, this.width * clamped, this.height, this.height / 2);
  }

  setVisible(visible: boolean): void {
    this.bg.setVisible(visible);
    this.fill.setVisible(visible);
  }

  destroy(): void {
    this.bg.destroy();
    this.fill.destroy();
  }
}
