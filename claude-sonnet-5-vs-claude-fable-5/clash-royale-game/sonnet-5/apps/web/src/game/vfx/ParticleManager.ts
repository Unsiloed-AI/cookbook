import Phaser from "phaser";

export function spawnDeployBurst(scene: Phaser.Scene, x: number, y: number, color: number): void {
  const ring = scene.add.circle(x, y, 10, color, 0.35).setDepth(15000);
  scene.tweens.add({
    targets: ring,
    radius: 34,
    alpha: 0,
    duration: 380,
    ease: "Cubic.Out",
    onUpdate: () => ring.setScale(ring.radius / 10),
    onComplete: () => ring.destroy(),
  });
}

export function spawnDeathPoof(scene: Phaser.Scene, x: number, y: number, color: number): void {
  const count = 7;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const dist = 18 + Math.random() * 14;
    const dot = scene.add.circle(x, y, 3 + Math.random() * 2, color, 0.9).setDepth(15000);
    scene.tweens.add({
      targets: dot,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      alpha: 0,
      duration: 420 + Math.random() * 120,
      ease: "Cubic.Out",
      onComplete: () => dot.destroy(),
    });
  }
}

export function spawnSpellRing(scene: Phaser.Scene, x: number, y: number, radiusPx: number, color: number, durationMs: number): void {
  const ring = scene.add.circle(x, y, radiusPx, color, 0.12).setStrokeStyle(3, color, 0.7).setDepth(14000);
  ring.setScale(0.3);
  scene.tweens.add({
    targets: ring,
    scale: 1,
    duration: Math.max(150, durationMs * 0.5),
    ease: "Cubic.Out",
  });
  scene.tweens.add({
    targets: ring,
    alpha: 0,
    delay: Math.max(0, durationMs * 0.3),
    duration: Math.max(150, durationMs * 0.6),
    onComplete: () => ring.destroy(),
  });
}

export function spawnImpactSpark(scene: Phaser.Scene, x: number, y: number, color: number): void {
  const spark = scene.add.circle(x, y, 5, color, 0.9).setDepth(15000);
  scene.tweens.add({
    targets: spark,
    scale: 2.2,
    alpha: 0,
    duration: 220,
    ease: "Cubic.Out",
    onComplete: () => spark.destroy(),
  });
}
