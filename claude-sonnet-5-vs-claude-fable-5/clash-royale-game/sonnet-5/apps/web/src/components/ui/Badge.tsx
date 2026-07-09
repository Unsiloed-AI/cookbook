import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide whitespace-nowrap",
  {
    variants: {
      variant: {
        common: "border border-slate-500/40 bg-slate-700/60 text-slate-200",
        rare: "border border-sky-400/40 bg-sky-700/40 text-sky-200",
        epic: "border border-violet-400/40 bg-violet-700/40 text-violet-200",
        legendary: "border border-amber-400/50 bg-amber-600/30 text-amber-200",
        neutral: "border border-white/10 bg-white/5 text-slate-300",
        success: "border border-emerald-400/40 bg-emerald-700/30 text-emerald-300",
        danger: "border border-rose-400/40 bg-rose-700/30 text-rose-300",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
