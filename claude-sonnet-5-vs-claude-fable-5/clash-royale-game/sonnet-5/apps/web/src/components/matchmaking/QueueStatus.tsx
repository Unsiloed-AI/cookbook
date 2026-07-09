import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface QueueStatusProps {
  label: string;
  onCancel: () => void;
}

export function QueueStatus({ label, onCancel }: QueueStatusProps) {
  return (
    <div className="mt-4 flex flex-col items-center gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-violet-400" />
      <p className="font-display text-xl text-slate-200">{label}</p>
      <p className="max-w-sm text-sm text-slate-500">
        Open a second browser tab (or an incognito window) to test 1v1 matchmaking locally.
      </p>
      <Button variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
