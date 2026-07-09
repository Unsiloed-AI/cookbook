import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type ButtonVariant = "primary" | "gold" | "ghost" | "danger";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-b from-arcane to-[#5a4bd4] text-white shadow-lg shadow-arcane/30 hover:brightness-110 border border-arcane-bright/40",
  gold:
    "bg-gradient-to-b from-gold to-[#c99a2e] text-[#2a1f05] shadow-lg shadow-gold/25 hover:brightness-110 border border-yellow-200/50",
  ghost:
    "bg-panel-2 text-slate-200 border border-edge hover:border-arcane/60 hover:text-white",
  danger:
    "bg-gradient-to-b from-blood to-[#c23a44] text-white border border-red-300/40 hover:brightness-110",
};

const BASE_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-xl font-bold tracking-wide transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer";

const SIZE_CLASSES = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-5 py-2.5 text-base",
  lg: "px-8 py-3.5 text-lg",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: keyof typeof SIZE_CLASSES;
}) {
  return (
    <button
      className={`${BASE_BUTTON} ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    />
  );
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: keyof typeof SIZE_CLASSES;
}) {
  return (
    <Link
      className={`${BASE_BUTTON} ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    />
  );
}

export function Panel({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border border-edge bg-panel/80 backdrop-blur-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon,
  accent = "text-white",
}: {
  label: string;
  value: ReactNode;
  icon: string;
  accent?: string;
}) {
  return (
    <Panel className="flex items-center gap-3 px-4 py-3">
      <span className="text-2xl">{icon}</span>
      <div>
        <div className={`text-xl font-black leading-tight ${accent}`}>{value}</div>
        <div className="text-xs uppercase tracking-wider text-slate-400">{label}</div>
      </div>
    </Panel>
  );
}
