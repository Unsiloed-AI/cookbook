"use client";

import { DEFAULT_DECK, isValidDeck } from "@arcane/shared";

const KEY = "arcane.deck";

export function loadDeck(): string[] {
  if (typeof window === "undefined") return [...DEFAULT_DECK];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isValidDeck(parsed)) return parsed;
    }
  } catch {
    // fall through to default
  }
  return [...DEFAULT_DECK];
}

export function saveDeck(deck: string[]): void {
  if (isValidDeck(deck)) {
    window.localStorage.setItem(KEY, JSON.stringify(deck));
  }
}
