import Link from "next/link";
import { LinkButton } from "./ui";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/cards", label: "Cards" },
  { href: "/deck", label: "Deck" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-edge bg-abyss/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-black tracking-wide">
          <span className="text-2xl">🏰</span>
          <span>
            Arcane <span className="text-arcane-bright">Towers</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-panel-2 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
          <LinkButton href="/play" variant="gold" size="sm" className="ml-2">
            ⚔️ Play
          </LinkButton>
        </nav>
      </div>
    </header>
  );
}
