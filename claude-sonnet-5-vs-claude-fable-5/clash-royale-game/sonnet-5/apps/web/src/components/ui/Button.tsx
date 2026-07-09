import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-accent2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.97]",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-to-b from-violet-500 to-violet-700 text-white shadow-glow hover:from-violet-400 hover:to-violet-600",
        secondary: "border border-arcane-border bg-arcane-panel2 text-slate-100 hover:bg-arcane-panel2/80",
        ghost: "bg-transparent text-slate-300 hover:bg-white/5",
        danger:
          "bg-gradient-to-b from-rose-500 to-rose-700 text-white hover:from-rose-400 hover:to-rose-600",
        gold: "bg-gradient-to-b from-amber-400 to-amber-600 text-arcane-bg shadow-[0_0_24px_rgba(251,191,36,0.4)] hover:from-amber-300 hover:to-amber-500",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-5 text-sm",
        lg: "h-12 px-7 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";
