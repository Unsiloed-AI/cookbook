/**
 * Per-player bookkeeping that must NOT be networked to clients — either
 * because it's pure server timing state (energy accumulator) or because it
 * would leak hidden information (the full 8-card deck cycle order, of which
 * only the 4-card hand + next card are ever revealed to clients).
 */
export interface PlayerRuntime {
  fullCycle: string[];
  energyAccumMs: number;
}

export type PlayerRuntimeMap = Map<string, PlayerRuntime>;
