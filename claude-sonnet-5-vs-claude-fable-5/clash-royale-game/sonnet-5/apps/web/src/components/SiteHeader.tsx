"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useIdentityStore } from "@/store/useIdentityStore";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/cards", label: "Cards" },
  { href: "/deck-builder", label: "Deck" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const identity = useIdentityStore((s) => s.identity);

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-arcane-border pb-4">
      <Link href="/dashboard" className="flex items-center gap-2">
        <span className="bg-gradient-to-r from-violet-300 to-cyan-300 bg-clip-text font-display text-xl font-bold tracking-wide text-transparent">
          Arcane Towers
        </span>
      </Link>

      <nav className="flex items-center gap-1 rounded-full border border-arcane-border bg-arcane-panel/60 p-1">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              pathname === link.href ? "bg-violet-600 text-white" : "text-slate-300 hover:bg-white/5",
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-2 text-sm text-slate-300">
        {identity && <span className="font-semibold text-slate-100">{identity.username}</span>}
      </div>
    </header>
  );
}
