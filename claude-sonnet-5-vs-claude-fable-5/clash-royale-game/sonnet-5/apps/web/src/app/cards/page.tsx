import { CARD_DEFINITIONS } from "@arcane-towers/shared";
import { CardGrid } from "@/components/cards/CardGrid";
import { PageFade } from "@/components/PageFade";
import { SiteHeader } from "@/components/SiteHeader";

export default function CardsPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <SiteHeader />
      <PageFade>
        <div className="mb-6 mt-8">
          <h1 className="font-display text-3xl font-bold text-slate-100">Card Codex</h1>
          <p className="mt-1 text-slate-400">The full Arcane Towers roster — {CARD_DEFINITIONS.length} cards.</p>
        </div>
        <CardGrid cards={CARD_DEFINITIONS} />
      </PageFade>
    </main>
  );
}
