import { formatDuration } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function MatchTimer({ remainingMs }: { remainingMs: number }) {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const isUrgent = seconds <= 60;

  return (
    <div
      className={cn(
        "rounded-full border px-4 py-1 font-display text-lg font-bold tabular-nums",
        isUrgent ? "animate-pulse-glow border-rose-400/60 text-rose-300" : "border-arcane-border text-slate-200",
      )}
    >
      {formatDuration(seconds)}
    </div>
  );
}
