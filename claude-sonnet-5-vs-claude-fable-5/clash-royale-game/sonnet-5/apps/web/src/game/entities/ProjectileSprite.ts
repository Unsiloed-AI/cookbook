import Phaser from "phaser";
import { projectileTextureKey } from "../vfx/SpriteFactory";

export function launchProjectile(
  scene: Phaser.Scene,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  durationMs: number,
  onImpact?: () => void,
): void {
  const sprite = scene.add.image(fromX, fromY, projectileTextureKey()).setDepth(16000);
  const angle = Phaser.Math.Angle.Between(fromX, fromY, toX, toY);
  sprite.setRotation(angle);

  scene.tweens.add({
    targets: sprite,
    x: toX,
    y: toY,
    duration: Math.max(60, durationMs),
    ease: "Linear",
    onComplete: () => {
      sprite.destroy();
      onImpact?.();
    },
  });
}
