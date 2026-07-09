"use client";

import { ENERGY_MAX } from "@arcane-towers/shared";
import { motion } from "framer-motion";

export function EnergyBar({ energy }: { energy: number }) {
  return (
    <div className="relative h-4 w-full overflow-hidden rounded-full border border-cyan-400/30 bg-black/40">
      <motion.div
        className="h-full bg-gradient-to-r from-cyan-400 to-violet-500"
        animate={{ width: `${(energy / ENERGY_MAX) * 100}%` }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      />
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow">
        {energy}/{ENERGY_MAX} energy
      </div>
    </div>
  );
}
