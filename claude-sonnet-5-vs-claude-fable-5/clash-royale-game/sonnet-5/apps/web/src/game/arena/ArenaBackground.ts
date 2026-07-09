import { BRIDGE_X_RANGES, RIVER_Y } from "@arcane-towers/shared";
import Phaser from "phaser";
import { CANVAS_HEIGHT, CANVAS_WIDTH, PIXELS_PER_UNIT } from "../coords";

export function drawArenaBackground(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  g.setDepth(-1000);

  g.fillStyle(0x141a33, 1);
  g.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT / 2);
  g.fillStyle(0x151f2e, 1);
  g.fillRect(0, CANVAS_HEIGHT / 2, CANVAS_WIDTH, CANVAS_HEIGHT / 2);

  g.fillStyle(0xffffff, 0.02);
  for (const [minX, maxX] of BRIDGE_X_RANGES) {
    g.fillRect(minX * PIXELS_PER_UNIT - 30, 0, (maxX - minX) * PIXELS_PER_UNIT + 60, CANVAS_HEIGHT);
  }

  const riverScreenY = RIVER_Y * PIXELS_PER_UNIT;
  const riverThickness = 34;
  g.fillStyle(0x0b3a52, 1);
  g.fillRect(0, riverScreenY - riverThickness / 2, CANVAS_WIDTH, riverThickness);
  g.fillStyle(0x1a5c7a, 0.55);
  for (let x = 0; x < CANVAS_WIDTH; x += 24) {
    g.fillRect(x, riverScreenY - riverThickness / 2 + 6, 14, 3);
    g.fillRect(x + 10, riverScreenY + riverThickness / 2 - 10, 14, 3);
  }

  for (const [minX, maxX] of BRIDGE_X_RANGES) {
    const bx = minX * PIXELS_PER_UNIT;
    const bw = (maxX - minX) * PIXELS_PER_UNIT;
    g.fillStyle(0x5b4636, 1);
    g.fillRect(bx, riverScreenY - riverThickness / 2 - 6, bw, riverThickness + 12);
    g.fillStyle(0x7a6248, 1);
    g.fillRect(bx, riverScreenY - riverThickness / 2 - 6, bw, 6);
    g.fillRect(bx, riverScreenY + riverThickness / 2, bw, 6);
  }

  g.lineStyle(1, 0xffffff, 0.08);
  g.lineBetween(0, riverScreenY, CANVAS_WIDTH, riverScreenY);

  g.lineStyle(1, 0xffffff, 0.05);
  for (const [minX, maxX] of BRIDGE_X_RANGES) {
    const cx = ((minX + maxX) / 2) * PIXELS_PER_UNIT;
    for (let y = 0; y < CANVAS_HEIGHT; y += 16) {
      g.lineBetween(cx, y, cx, y + 8);
    }
  }

  g.lineStyle(2, 0x2a3557, 1);
  g.strokeRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}
