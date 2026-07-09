"use client";

import { create } from "zustand";
import type { BattleRoom, Side } from "@/game/battleTypes";

interface BattleConnectionState {
  room: BattleRoom | null;
  mySide: Side | null;
  mode: "pvp" | "practice" | null;
  setConnection: (room: BattleRoom, mySide: Side, mode: "pvp" | "practice") => void;
  clear: () => void;
}

export const useBattleConnectionStore = create<BattleConnectionState>((set) => ({
  room: null,
  mySide: null,
  mode: null,
  setConnection: (room, mySide, mode) => set({ room, mySide, mode }),
  clear: () => set({ room: null, mySide: null, mode: null }),
}));
