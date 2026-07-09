import { ARENA_HEIGHT, ARENA_WIDTH } from "@arcane-towers/shared";
import type { Side } from "./battleTypes";

export const PIXELS_PER_UNIT = 40;
export const CANVAS_WIDTH = ARENA_WIDTH * PIXELS_PER_UNIT;
export const CANVAS_HEIGHT = ARENA_HEIGHT * PIXELS_PER_UNIT;

/**
 * The server keeps one absolute world frame (host is always "low"/bottom,
 * guest always "high"/top). Each client y-flips purely for rendering so a
 * player always sees themselves at the bottom of their own screen — this has
 * zero effect on server logic, which never sees screen coordinates.
 */
export function worldToScreen(worldX: number, worldY: number, mySide: Side): { x: number; y: number } {
  return {
    x: worldX * PIXELS_PER_UNIT,
    y: (mySide === "guest" ? ARENA_HEIGHT - worldY : worldY) * PIXELS_PER_UNIT,
  };
}

export function screenToWorld(screenX: number, screenY: number, mySide: Side): { x: number; y: number } {
  const rawY = screenY / PIXELS_PER_UNIT;
  return {
    x: screenX / PIXELS_PER_UNIT,
    y: mySide === "guest" ? ARENA_HEIGHT - rawY : rawY,
  };
}
