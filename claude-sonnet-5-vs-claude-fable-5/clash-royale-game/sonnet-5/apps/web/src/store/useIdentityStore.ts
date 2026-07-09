"use client";

import { create } from "zustand";
import { upsertPlayer } from "@/lib/api";
import { loadOrCreateIdentity, saveIdentity, type Identity } from "@/lib/identity";

interface IdentityStoreState {
  identity: Identity | null;
  hydrated: boolean;
  hydrate: () => void;
  rename: (username: string) => void;
}

export const useIdentityStore = create<IdentityStoreState>((set, get) => ({
  identity: null,
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    const forceFresh = new URLSearchParams(window.location.search).get("fresh") === "1";
    const identity = loadOrCreateIdentity(forceFresh);
    set({ identity, hydrated: true });
    void upsertPlayer(identity.playerId, identity.username);
  },

  rename: (username: string) => {
    const current = get().identity;
    if (!current) return;
    const next = { ...current, username };
    saveIdentity(next);
    set({ identity: next });
    void upsertPlayer(next.playerId, next.username);
  },
}));
