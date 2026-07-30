import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle2, AlertCircle, FileText, Sparkles, LayoutDashboard } from "lucide-react";

export type Stage = "uploading" | "extracting" | "building" | "ready" | "error";

const STAGES: { key: Stage; label: string; icon: React.ReactNode }[] = [
  { key: "uploading", label: "Uploading", icon: <FileText className="size-3.5" /> },
  { key: "extracting", label: "Extracting", icon: <Sparkles className="size-3.5" /> },
  { key: "building", label: "Building dashboard", icon: <LayoutDashboard className="size-3.5" /> },
  { key: "ready", label: "Ready", icon: <CheckCircle2 className="size-3.5" /> },
];

export function StatusChip({ stage, error }: { stage: Stage; error?: string }) {
  if (stage === "error") {
    return (
      <div className="ts-chip text-destructive border-destructive/30 bg-destructive/5">
        <AlertCircle className="size-3.5" />
        <span className="truncate max-w-[24rem]">{error ?? "Something went wrong"}</span>
      </div>
    );
  }
  const idx = STAGES.findIndex((s) => s.key === stage);
  return (
    <div className="flex items-center gap-2">
      {STAGES.map((s, i) => {
        const active = i === idx;
        const done = i < idx;
        return (
          <div key={s.key} className="flex items-center gap-2">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={s.key + (active ? "a" : done ? "d" : "p")}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className={[
                  "ts-chip transition-colors",
                  active && "border-primary/40 bg-accent text-foreground",
                  done && "border-success/30 text-foreground",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {active ? (
                  <Loader2 className="size-3.5 animate-spin text-primary" />
                ) : done ? (
                  <CheckCircle2 className="size-3.5 text-success" />
                ) : (
                  s.icon
                )}
                {s.label}
              </motion.div>
            </AnimatePresence>
            {i < STAGES.length - 1 && (
              <div className="w-4 h-px bg-border" />
            )}
          </div>
        );
      })}
    </div>
  );
}
