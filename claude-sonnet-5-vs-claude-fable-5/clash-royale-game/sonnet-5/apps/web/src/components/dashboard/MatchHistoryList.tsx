import type { MatchResult, MatchSummaryDTO } from "@arcane-towers/shared";
import { Badge } from "@/components/ui/Badge";
import { cn, formatDuration, formatRelativeTime } from "@/lib/utils";

const RESULT_STYLES: Record<MatchResult, { label: string; variant: "success" | "danger" | "neutral" }> = {
  win: { label: "Victory", variant: "success" },
  loss: { label: "Defeat", variant: "danger" },
  draw: { label: "Draw", variant: "neutral" },
};

export function MatchHistoryList({ matches }: { matches: MatchSummaryDTO[] }) {
  if (matches.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-slate-400">
        No matches played yet. Click Play to start your first battle.
      </p>
    );
  }

  return (
    <div className="divide-y divide-arcane-border">
      {matches.map((match) => {
        const style = RESULT_STYLES[match.result];
        return (
          <div key={match.matchId} className="flex items-center justify-between gap-4 py-3">
            <div className="flex items-center gap-3">
              <Badge variant={style.variant}>{style.label}</Badge>
              <div>
                <p className="text-sm font-medium text-slate-200">
                  vs {match.opponentName}
                  {match.isBotOpponent && <span className="text-slate-500"> (Practice)</span>}
                </p>
                <p className="text-xs text-slate-500">
                  {formatRelativeTime(match.createdAt)} · {formatDuration(match.durationSeconds)} ·{" "}
                  {match.towersDestroyed} towers destroyed
                </p>
              </div>
            </div>
            <div
              className={cn(
                "shrink-0 text-sm font-semibold",
                match.trophyDelta > 0
                  ? "text-emerald-400"
                  : match.trophyDelta < 0
                    ? "text-rose-400"
                    : "text-slate-500",
              )}
            >
              {match.trophyDelta > 0 ? `+${match.trophyDelta}` : match.trophyDelta}
            </div>
          </div>
        );
      })}
    </div>
  );
}
