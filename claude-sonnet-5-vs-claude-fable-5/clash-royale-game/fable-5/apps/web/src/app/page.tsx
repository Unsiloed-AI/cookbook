import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { LinkButton, Panel } from "@/components/ui";

const FEATURES = [
  {
    icon: "⚡",
    title: "Real-time 1v1 battles",
    body: "Server-authoritative multiplayer. Every deploy is validated, every tick is simulated on the server.",
  },
  {
    icon: "🃏",
    title: "Build your deck",
    body: "12 original cards — tanks, swarms, spells and buildings. Pick 8 and master your rotation.",
  },
  {
    icon: "🏆",
    title: "Climb the ladder",
    body: "Win trophies, track your stats, and review your match history on the dashboard.",
  },
];

const HERO_CARDS = ["🗿", "🔥", "🏹", "⚡"];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-4">
        <section className="flex flex-col items-center pb-10 pt-20 text-center">
          <div className="mb-6 flex gap-4">
            {HERO_CARDS.map((icon, i) => (
              <span
                key={icon}
                className="animate-float-slow rounded-2xl border border-edge bg-panel-2 p-4 text-4xl shadow-xl"
                style={{ animationDelay: `${i * 0.6}s` }}
              >
                {icon}
              </span>
            ))}
          </div>
          <h1 className="text-5xl font-black tracking-tight sm:text-7xl">
            Arcane <span className="text-arcane-bright">Towers</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-slate-300">
            A real-time lane tower battle. Deploy troops, sling spells, manage
            your energy — and bring the enemy citadel down before the clock
            runs out.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <LinkButton href="/play" variant="gold" size="lg" className="animate-pulse-glow">
              ⚔️ Play Now
            </LinkButton>
            <LinkButton href="/dashboard" variant="ghost" size="lg">
              View Dashboard
            </LinkButton>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            No account needed — jump straight into battle.
          </p>
        </section>

        <section className="grid w-full gap-4 pb-20 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <Panel key={f.title} className="p-6">
              <div className="text-3xl">{f.icon}</div>
              <h2 className="mt-3 text-lg font-bold">{f.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">{f.body}</p>
            </Panel>
          ))}
        </section>
      </main>
      <footer className="border-t border-edge py-6 text-center text-sm text-slate-500">
        Arcane Towers — an original web battle game.{" "}
        <Link href="/cards" className="text-arcane-bright hover:underline">
          Browse the cards
        </Link>
      </footer>
    </div>
  );
}
