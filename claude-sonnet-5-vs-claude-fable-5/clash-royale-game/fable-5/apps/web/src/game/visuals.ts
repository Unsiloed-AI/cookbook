import { ARENA, TOWER_DEFS, type TowerKind } from "@arcane/shared";
import Phaser from "phaser";

export const TILE = ARENA.tile;
export const ARENA_W = ARENA.width * TILE;
export const ARENA_H = ARENA.height * TILE;

export const TEAM_FRIENDLY = 0x58a6ff;
export const TEAM_ENEMY = 0xf0564f;

/** One-time generated textures used by particle effects. */
export function ensureFxTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists("spark")) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(4, 4, 4);
  g.generateTexture("spark", 8, 8);
  g.destroy();
}

/** Paint the full arena backdrop: grass, lanes, river, and bridges. */
export function drawArena(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  g.setDepth(0);

  // Grass base, subtly different per half so sides read at a glance.
  g.fillStyle(0x2b5240, 1);
  g.fillRect(0, 0, ARENA_W, ARENA_H / 2);
  g.fillStyle(0x2e5744, 1);
  g.fillRect(0, ARENA_H / 2, ARENA_W, ARENA_H / 2);

  // Checkerboard sheen.
  g.fillStyle(0xffffff, 0.03);
  for (let ty = 0; ty < ARENA.height; ty++) {
    for (let tx = 0; tx < ARENA.width; tx++) {
      if ((tx + ty) % 2 === 0) g.fillRect(tx * TILE, ty * TILE, TILE, TILE);
    }
  }

  // Lane guides under the bridges.
  g.fillStyle(0xf5e9c9, 0.05);
  for (const bx of ARENA.bridges) {
    g.fillRect((bx - 1.2) * TILE, 0, 2.4 * TILE, ARENA_H);
  }

  // Scattered decorative tufts (deterministic pseudo-random).
  g.fillStyle(0x1f4231, 0.55);
  for (let i = 0; i < 40; i++) {
    const x = ((i * 97 + 31) % ARENA.width) + 0.5;
    const y = ((i * 53 + 11) % ARENA.height) + 0.3;
    if (y > ARENA.riverTop - 1 && y < ARENA.riverBottom + 1) continue;
    g.fillCircle(x * TILE, y * TILE, 3 + (i % 3));
  }

  // River.
  const riverY = ARENA.riverTop * TILE;
  const riverH = (ARENA.riverBottom - ARENA.riverTop) * TILE;
  g.fillStyle(0x1c4a68, 1);
  g.fillRect(0, riverY, ARENA_W, riverH);
  g.fillStyle(0x2a6b93, 0.7);
  for (let i = 0; i < 14; i++) {
    const x = ((i * 143 + 40) % (ARENA_W - 60)) + 10;
    const y = riverY + 8 + ((i * 37) % (riverH - 16));
    g.fillRoundedRect(x, y, 26, 4, 2);
  }

  // Bridges.
  for (const bx of ARENA.bridges) {
    const left = (bx - ARENA.bridgeHalfWidth) * TILE;
    const width = ARENA.bridgeHalfWidth * 2 * TILE;
    g.fillStyle(0x7a5634, 1);
    g.fillRoundedRect(left, riverY - 6, width, riverH + 12, 6);
    g.lineStyle(2, 0x5e4126, 1);
    for (let i = 1; i < 5; i++) {
      const py = riverY - 6 + ((riverH + 12) / 5) * i;
      g.lineBetween(left + 4, py, left + width - 4, py);
    }
    g.lineStyle(3, 0x8f6a42, 1);
    g.strokeRoundedRect(left, riverY - 6, width, riverH + 12, 6);
  }

  // Arena frame.
  g.lineStyle(4, 0x101728, 0.9);
  g.strokeRect(1, 1, ARENA_W - 2, ARENA_H - 2);
}

/** Stylized castle art for a tower, centered at (0, 0). */
export function createTowerArt(
  scene: Phaser.Scene,
  kind: TowerKind,
  friendly: boolean,
): Phaser.GameObjects.Container {
  const def = TOWER_DEFS[kind];
  const r = def.radius * TILE * 1.2;
  const accent = friendly ? TEAM_FRIENDLY : TEAM_ENEMY;
  const container = scene.add.container(0, 0);
  const g = scene.add.graphics();

  // Shadow.
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(0, r * 0.75, r * 2.3, r * 0.8);

  // Stone body.
  g.fillStyle(0x424c61, 1);
  g.fillRoundedRect(-r * 0.9, -r * 0.85, r * 1.8, r * 1.7, 8);
  g.fillStyle(0x59657f, 1);
  g.fillRoundedRect(-r * 0.72, -r * 0.68, r * 1.44, r * 1.25, 6);

  // Crenellations.
  g.fillStyle(0x424c61, 1);
  for (const dx of [-0.85, -0.3, 0.25, 0.62]) {
    g.fillRect(dx * r, -r * 1.08, r * 0.28, r * 0.3);
  }

  // Team gem with glow.
  g.fillStyle(accent, 0.22);
  g.fillCircle(0, -r * 0.05, r * 0.62);
  g.fillStyle(accent, 1);
  g.fillCircle(0, -r * 0.05, r * 0.4);
  g.fillStyle(0xffffff, 0.5);
  g.fillCircle(-r * 0.12, -r * 0.17, r * 0.13);

  container.add(g);

  if (kind === "main") {
    // Banner on the citadel.
    const flag = scene.add.graphics();
    flag.lineStyle(3, 0x2d3446, 1);
    flag.lineBetween(r * 0.55, -r * 1.05, r * 0.55, -r * 1.6);
    flag.fillStyle(accent, 1);
    flag.fillTriangle(r * 0.55, -r * 1.6, r * 0.55, -r * 1.3, r * 1.1, -r * 1.45);
    container.add(flag);
  }
  return container;
}

/** Redraw a health bar into `g` (origin at the bar's top-left). */
export function drawHpBar(
  g: Phaser.GameObjects.Graphics,
  fraction: number,
  width: number,
  friendly: boolean,
): void {
  const h = 5;
  const f = Phaser.Math.Clamp(fraction, 0, 1);
  g.clear();
  g.fillStyle(0x0b0e18, 0.85);
  g.fillRoundedRect(-1, -1, width + 2, h + 2, 2);
  const color = friendly ? 0x53d769 : 0xf0564f;
  g.fillStyle(color, 1);
  g.fillRoundedRect(0, 0, Math.max(2, width * f), h, 2);
}
