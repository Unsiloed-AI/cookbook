import { distance, opposingSide, type CardDefinition, type Side } from "@arcane-towers/shared";
import type { BattleState } from "../schema/BattleState.js";
import { EffectState } from "../schema/EffectState.js";
import { applyDamageToTarget, pruneDeadUnits } from "./combat.js";
import { generateId } from "./util.js";

const SPELL_EFFECT_DURATION_MS = 600;

/**
 * Spells resolve instantly, synchronously, at cast time — only the visual
 * impact ring is cosmetically delayed client-side via the pushed EffectState.
 */
export function resolveSpell(
  state: BattleState,
  card: CardDefinition,
  x: number,
  y: number,
  ownerSide: Side,
  now: number,
): void {
  const spell = card.spell;
  if (!spell) return;

  const enemySide = opposingSide(ownerSide);
  const point = { x, y };

  for (const unit of [...state.units.values()]) {
    if (unit.ownerSide !== enemySide) continue;
    if (distance(unit, point) > spell.radius) continue;

    applyDamageToTarget(state, unit.id, spell.damage, ownerSide);
    if (spell.slowFactor && spell.slowDurationMs) {
      unit.slowedUntilMs = now + spell.slowDurationMs;
      unit.slowFactor = spell.slowFactor;
    }
  }

  for (const tower of state.towers.values()) {
    if (tower.ownerSide !== enemySide || tower.destroyed) continue;
    if (distance(tower, point) > spell.radius) continue;
    applyDamageToTarget(state, tower.id, spell.damage, ownerSide, spell.towerDamageMultiplier);
  }

  const effect = new EffectState();
  effect.id = generateId("fx");
  effect.cardId = card.id;
  effect.x = x;
  effect.y = y;
  effect.radius = spell.radius;
  effect.spawnedAtMs = now;
  effect.durationMs = SPELL_EFFECT_DURATION_MS;
  state.effects.set(effect.id, effect);

  pruneDeadUnits(state);
}

export function pruneExpiredEffects(state: BattleState, now: number): void {
  for (const [id, effect] of state.effects.entries()) {
    if (now - effect.spawnedAtMs >= effect.durationMs) {
      state.effects.delete(id);
    }
  }
}
