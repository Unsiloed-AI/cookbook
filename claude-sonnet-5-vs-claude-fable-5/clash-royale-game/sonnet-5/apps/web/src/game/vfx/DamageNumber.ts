import Phaser from "phaser";

export function showDamageNumber(scene: Phaser.Scene, x: number, y: number, amount: number): void {
  if (amount <= 0) return;

  const text = scene.add
    .text(x, y, `-${Math.round(amount)}`, {
      fontFamily: "sans-serif",
      fontSize: "18px",
      fontStyle: "bold",
      color: "#fecaca",
      stroke: "#450a0a",
      strokeThickness: 4,
    })
    .setOrigin(0.5)
    .setDepth(20000);

  scene.tweens.add({
    targets: text,
    y: y - 36,
    alpha: 0,
    duration: 700,
    ease: "Cubic.Out",
    onComplete: () => text.destroy(),
  });
}
