import { CARD_DEFINITIONS, type CardShape } from "@arcane-towers/shared";
import Phaser from "phaser";

const UNIT_TEXTURE_SIZE = 64;
const TOWER_TEXTURE_SIZE = 96;

export function unitTextureKey(cardId: string): string {
  return `unit-tex-${cardId}`;
}

export function towerTextureKey(kind: "side" | "king", side: "host" | "guest"): string {
  return `tower-tex-${kind}-${side}`;
}

export function projectileTextureKey(): string {
  return "projectile-tex";
}

function hexToNumber(hex: string): number {
  return parseInt(hex.replace("#", "0x"), 16);
}

function drawShape(
  g: Phaser.GameObjects.Graphics,
  shape: CardShape,
  size: number,
  primary: number,
  secondary: number,
): void {
  const c = size / 2;
  g.fillStyle(primary, 1);
  g.lineStyle(3, secondary, 1);

  switch (shape) {
    case "diamond": {
      const r = size * 0.42;
      g.beginPath();
      g.moveTo(c, c - r);
      g.lineTo(c + r, c);
      g.lineTo(c, c + r);
      g.lineTo(c - r, c);
      g.closePath();
      g.fillPath();
      g.strokePath();
      break;
    }
    case "triangle": {
      const r = size * 0.42;
      g.beginPath();
      g.moveTo(c, c - r);
      g.lineTo(c + r, c + r * 0.85);
      g.lineTo(c - r, c + r * 0.85);
      g.closePath();
      g.fillPath();
      g.strokePath();
      break;
    }
    case "hexagon": {
      const r = size * 0.42;
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        const px = c + r * Math.cos(angle);
        const py = c + r * Math.sin(angle);
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.fillPath();
      g.strokePath();
      break;
    }
    case "dotCluster": {
      const r = size * 0.15;
      g.fillCircle(c - r * 1.2, c - r * 0.5, r);
      g.fillCircle(c + r * 1.2, c - r * 0.5, r);
      g.fillCircle(c, c + r * 1.2, r);
      break;
    }
    case "spire": {
      const r = size * 0.4;
      g.beginPath();
      g.moveTo(c, c - r);
      g.lineTo(c + r * 0.6, c + r);
      g.lineTo(c - r * 0.6, c + r);
      g.closePath();
      g.fillPath();
      g.strokePath();
      break;
    }
    case "orb": {
      g.fillCircle(c, c, size * 0.36);
      g.strokeCircle(c, c, size * 0.36);
      break;
    }
    case "bolt": {
      g.beginPath();
      g.moveTo(c + 6, c - 24);
      g.lineTo(c - 12, c + 2);
      g.lineTo(c - 2, c + 2);
      g.lineTo(c - 8, c + 26);
      g.lineTo(c + 14, c - 4);
      g.lineTo(c + 2, c - 4);
      g.closePath();
      g.fillPath();
      g.strokePath();
      break;
    }
    case "shield": {
      const r = size * 0.4;
      g.beginPath();
      g.moveTo(c, c - r);
      g.lineTo(c + r, c - r * 0.5);
      g.lineTo(c + r, c + r * 0.1);
      g.lineTo(c, c + r);
      g.lineTo(c - r, c + r * 0.1);
      g.lineTo(c - r, c - r * 0.5);
      g.closePath();
      g.fillPath();
      g.strokePath();
      break;
    }
    case "blade": {
      g.beginPath();
      g.moveTo(c - 4, c - 26);
      g.lineTo(c + 4, c - 26);
      g.lineTo(c + 6, c + 16);
      g.lineTo(c, c + 28);
      g.lineTo(c - 6, c + 16);
      g.closePath();
      g.fillPath();
      g.strokePath();
      break;
    }
    case "colossus": {
      g.fillRoundedRect(c - 16, c - 20, 32, 24, 6);
      g.strokeRoundedRect(c - 16, c - 20, 32, 24, 6);
      g.fillRoundedRect(c - 22, c + 6, 44, 18, 4);
      g.strokeRoundedRect(c - 22, c + 6, 44, 18, 4);
      break;
    }
    default: {
      g.fillCircle(c, c, size * 0.35);
    }
  }
}

export function generateUnitTextures(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  for (const card of CARD_DEFINITIONS) {
    const key = unitTextureKey(card.id);
    if (scene.textures.exists(key)) continue;
    g.clear();
    drawShape(
      g,
      card.visual.shape,
      UNIT_TEXTURE_SIZE,
      hexToNumber(card.visual.primaryColor),
      hexToNumber(card.visual.secondaryColor),
    );
    g.generateTexture(key, UNIT_TEXTURE_SIZE, UNIT_TEXTURE_SIZE);
  }
  g.destroy();
}

const SIDE_PALETTE = {
  host: { primary: 0x8b5cf6, secondary: 0x4c1d95 },
  guest: { primary: 0x22d3ee, secondary: 0x0e7490 },
} as const;

export function generateTowerTextures(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const size = TOWER_TEXTURE_SIZE;
  const c = size / 2;

  for (const side of ["host", "guest"] as const) {
    for (const kind of ["side", "king"] as const) {
      const key = towerTextureKey(kind, side);
      if (scene.textures.exists(key)) continue;
      g.clear();

      const { primary, secondary } = SIDE_PALETTE[side];
      const isKing = kind === "king";
      const baseW = isKing ? size * 0.62 : size * 0.5;
      const baseH = isKing ? size * 0.62 : size * 0.5;

      g.fillStyle(secondary, 1);
      g.fillRoundedRect(c - baseW / 2, size - baseH, baseW, baseH, 8);
      g.fillStyle(primary, 1);
      g.fillRoundedRect(c - baseW / 2 + 6, size - baseH + 8, baseW - 12, baseH - 16, 6);

      g.fillStyle(secondary, 1);
      const crenelCount = isKing ? 5 : 4;
      const crenelW = baseW / (crenelCount * 2);
      for (let i = 0; i < crenelCount; i++) {
        const x = c - baseW / 2 + crenelW * (2 * i + 0.5);
        g.fillRect(x, size - baseH - 8, crenelW, 10);
      }

      if (isKing) {
        g.fillStyle(0xfbbf24, 1);
        g.fillTriangle(c, size - baseH - 26, c - 10, size - baseH - 8, c + 10, size - baseH - 8);
      }

      g.generateTexture(key, size, size);
    }
  }
  g.destroy();
}

export function generateProjectileTexture(scene: Phaser.Scene): void {
  const key = projectileTextureKey();
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  g.fillStyle(0xfbbf24, 0.5);
  g.fillCircle(8, 8, 8);
  g.fillStyle(0xfef3c7, 1);
  g.fillCircle(8, 8, 4);
  g.generateTexture(key, 16, 16);
  g.destroy();
}
