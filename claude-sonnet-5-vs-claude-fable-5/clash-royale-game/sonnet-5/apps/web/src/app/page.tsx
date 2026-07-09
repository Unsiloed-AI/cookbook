import Link from "next/link";
import { CARD_DEFINITIONS } from "@arcane-towers/shared";
import { CardArt } from "@/components/cards/CardArt";
import { Button } from "@/components/ui/Button";

const SHOWCASE_CARDS = CARD_DEFINITIONS.filter((c) =>
  ["stone-golem", "sparkfletcher", "cataclysm-bolt", "kestrel-swarm", "ironclad-vanguard"].includes(c.id),
);

export default function LandingPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-20 text-center">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_25%,rgba(139,92,246,0.28),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_80%_70%,rgba(34,211,238,0.14),transparent_55%)]" />

      <div className="pointer-events-none absolute inset-x-0 top-24 -z-10 hidden justify-center gap-6 md:flex">
        {SHOWCASE_CARDS.map((card, i) => (
          <div
            key={card.id}
            className="h-28 w-28 rounded-2xl border border-white/10 opacity-70 shadow-2xl"
            style={{
              transform: `rotate(${(i - 2) * 6}deg) translateY(${Math.abs(i - 2) * 14}px)`,
            }}
          >
            <CardArt
              shape={card.visual.shape}
              primaryColor={card.visual.primaryColor}
              secondaryColor={card.visual.secondaryColor}
              className="h-full w-full rounded-2xl"
            />
          </div>
        ))}
      </div>

      <p className="mb-4 text-xs uppercase tracking-[0.35em] text-cyan-300">Real-time 1v1 tower battler</p>
      <h1 className="text-shadow-glow bg-gradient-to-b from-white to-slate-400 bg-clip-text font-display text-5xl font-black tracking-wide text-transparent sm:text-7xl">
        Arcane Towers
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-400">
        Deploy original spellcraft and battle-forged units across twin lanes, break your rival&apos;s towers, and
        climb the ranks in fast, real-time 1v1 duels.
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Link href="/play">
          <Button variant="gold" size="lg">
            Play Now
          </Button>
        </Link>
        <Link href="/dashboard">
          <Button variant="secondary" size="lg">
            Dashboard
          </Button>
        </Link>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-4 text-left sm:grid-cols-3">
        {[
          { title: "Server-authoritative battles", body: "Every deploy, hit, and win is validated on the server — no client-side cheating." },
          { title: "10 original cards", body: "Swarms, tanks, spellcraft, and defensive spires across four rarities." },
          { title: "Live matchmaking", body: "Queue up, get paired instantly, and duel in real time over WebSockets." },
        ].map((f) => (
          <div key={f.title} className="rounded-xl border border-arcane-border bg-arcane-panel/60 p-4">
            <p className="font-display text-sm font-semibold text-slate-100">{f.title}</p>
            <p className="mt-1 text-xs text-slate-400">{f.body}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
