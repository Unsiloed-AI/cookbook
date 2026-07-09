export interface Vec2 {
  x: number;
  y: number;
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * clamp(t, 0, 1);
}

export function moveToward(current: Vec2, target: Vec2, maxDistance: number): Vec2 {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= maxDistance || dist === 0) {
    return { x: target.x, y: target.y };
  }
  const t = maxDistance / dist;
  return { x: current.x + dx * t, y: current.y + dy * t };
}
