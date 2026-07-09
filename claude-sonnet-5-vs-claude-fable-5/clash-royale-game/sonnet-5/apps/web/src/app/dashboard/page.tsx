"use client";

import { Swords, Target, TrendingUp, Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { MatchSummaryDTO, PlayerProfileDTO } from "@arcane-towers/shared";
import { DeckPreview } from "@/components/dashboard/DeckPreview";
import { MatchHistoryList } from "@/components/dashboard/MatchHistoryList";
import { StatCard } from "@/components/dashboard/StatCard";
import { PageFade } from "@/components/PageFade";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { fetchMatchHistory, fetchPlayerProfile } from "@/lib/api";
import { useIdentityStore } from "@/store/useIdentityStore";

export default function DashboardPage() {
  const identity = useIdentityStore((s) => s.identity);
  const [profile, setProfile] = useState<PlayerProfileDTO | null>(null);
  const [matches, setMatches] = useState<MatchSummaryDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!identity) return;
    let cancelled = false;
    setLoading(true);

    Promise.all([fetchPlayerProfile(identity.playerId), fetchMatchHistory(identity.playerId)])
      .then(([p, m]) => {
        if (cancelled) return;
        setProfile(p);
        setMatches(m);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [identity]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <SiteHeader />
      <PageFade>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-400">Welcome back,</p>
            <h1 className="font-display text-3xl font-bold text-slate-100">
              {profile?.username ?? identity?.username ?? "Player"}
            </h1>
          </div>
          <div className="flex gap-3">
            <Link href="/deck-builder">
              <Button variant="secondary">Edit Deck</Button>
            </Link>
            <Link href="/play">
              <Button variant="gold" size="lg">
                Play
              </Button>
            </Link>
          </div>
        </div>

        {loading || !profile ? (
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Trophies" value={profile.trophies} icon={Trophy} accent="text-amber-300" />
            <StatCard label="Wins" value={profile.wins} icon={Swords} accent="text-emerald-300" />
            <StatCard label="Losses" value={profile.losses} icon={Target} accent="text-rose-300" />
            <StatCard
              label="Win Rate"
              value={`${Math.round(profile.winRate * 100)}%`}
              icon={TrendingUp}
              accent="text-cyan-300"
            />
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Recent Matches</CardTitle>
            </CardHeader>
            <CardContent>{loading ? <Skeleton className="h-40" /> : <MatchHistoryList matches={matches} />}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Current Deck</CardTitle>
            </CardHeader>
            <CardContent>
              {loading || !profile ? <Skeleton className="h-40" /> : <DeckPreview deckCardIds={profile.deckCardIds} />}
            </CardContent>
          </Card>
        </div>
      </PageFade>
    </main>
  );
}
