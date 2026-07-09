"use client";

import { Flag } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

export function SurrenderButton({ onConfirm }: { onConfirm: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} className="text-rose-300">
        <Flag className="h-4 w-4" />
        Surrender
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Surrender the match?">
        <p className="text-sm text-slate-400">This immediately ends the battle as a loss. This can&apos;t be undone.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            Surrender
          </Button>
        </div>
      </Dialog>
    </>
  );
}
