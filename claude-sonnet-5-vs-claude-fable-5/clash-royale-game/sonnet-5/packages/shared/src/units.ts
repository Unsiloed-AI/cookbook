import { getCardById } from "./cards.js";
import type { Vec2 } from "./math.js";
import type { UnitDefinition } from "./types.js";

export function getUnitDefinition(cardId: string): UnitDefinition | undefined {
  return getCardById(cardId)?.unit;
}

const SWARM_SPACING = 0.65;

/** Deterministic small-cluster offsets so multi-spawn cards don't stack on one point. */
export function getSwarmSpawnOffsets(count: number): Vec2[] {
  if (count <= 1) return [{ x: 0, y: 0 }];

  const offsets: Vec2[] = [];
  const angleStep = (Math.PI * 2) / count;
  for (let i = 0; i < count; i++) {
    const angle = angleStep * i - Math.PI / 2;
    offsets.push({
      x: Math.cos(angle) * SWARM_SPACING,
      y: Math.sin(angle) * SWARM_SPACING * 0.6,
    });
  }
  return offsets;
}
