"use client";

import { AnimatePresence, motion } from "framer-motion";

export function CountdownOverlay({ seconds }: { seconds: number }) {
  return (
    <div className="mt-4 flex flex-col items-center gap-4">
      <motion.p
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-display text-xl font-semibold text-emerald-300"
      >
        Opponent found!
      </motion.p>
      <AnimatePresence mode="wait">
        <motion.div
          key={seconds}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.4, opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-violet-500 bg-arcane-panel font-display text-5xl font-black text-white shadow-glow"
        >
          {seconds > 0 ? seconds : "GO"}
        </motion.div>
      </AnimatePresence>
      <p className="text-sm text-slate-500">Battle begins shortly…</p>
    </div>
  );
}
