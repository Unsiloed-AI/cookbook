"use client";

import { getStateCallbacks } from "colyseus.js";
import { Bot, Swords } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CountdownOverlay } from "@/components/matchmaking/CountdownOverlay";
import { QueueStatus } from "@/components/matchmaking/QueueStatus";
import { PageFade } from "@/components/PageFade";
import { SiteHeader } from "@/components/SiteHeader";
import { Card } from "@/components/ui/Card";
import type { BattleRoom } from "@/game/battleTypes";
import { fetchPlayerProfile } from "@/lib/api";
import { getColyseusClient } from "@/lib/colyseus-client";
import { useBattleConnectionStore } from "@/store/useBattleConnectionStore";
import { useIdentityStore } from "@/store/useIdentityStore";

type Stage = "select" | "connecting" | "searching" | "countdown" | "error";

export default function PlayPage() {
  const router = useRouter();
  const identity = useIdentityStore((s) => s.identity);
  const setConnection = useBattleConnectionStore((s) => s.setConnection);

  const [stage, setStage] = useState<Stage>("select");
  const [countdownSeconds, setCountdownSeconds] = useState(3);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const roomRef = useRef<BattleRoom | null>(null);
  const matchStartedRef = useRef(false);
  const disposersRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    return () => {
      for (const dispose of disposersRef.current) dispose();
      disposersRef.current = [];
      if (roomRef.current && !matchStartedRef.current) {
        roomRef.current.leave();
      }
    };
  }, []);

  async function startQueue(mode: "pvp" | "practice") {
    if (!identity) return;
    setStage("connecting");
    setErrorMessage(null);

    try {
      const profile = await fetchPlayerProfile(identity.playerId).catch(() => null);
      const client = getColyseusClient();
      const roomName = mode === "pvp" ? "battle" : "battle_practice";

      const room = (await client.joinOrCreate(roomName, {
        playerId: identity.playerId,
        username: identity.username,
        deckCardIds: profile?.deckCardIds,
      })) as BattleRoom;

      roomRef.current = room;
      setStage("searching");

      const $ = getStateCallbacks(room);

      const unlistenCountdown = $(room.state).listen("countdownRemainingMs", (ms) => {
        setCountdownSeconds(Math.max(0, Math.ceil(ms / 1000)));
      });

      const unlistenPhase = $(room.state).listen("phase", (phase) => {
        if (phase === "countdown") {
          setStage("countdown");
          room.send("ready", {});
        }

        if (phase === "active" && !matchStartedRef.current) {
          const me = room.state.players.get(room.sessionId);
          if (!me) return;
          matchStartedRef.current = true;
          for (const dispose of disposersRef.current) dispose();
          disposersRef.current = [];
          setConnection(room, me.side, mode);
          router.push("/battle");
        }
      });

      disposersRef.current.push(unlistenCountdown, unlistenPhase);

      room.onLeave(() => {
        if (!matchStartedRef.current) {
          setStage("select");
        }
      });
    } catch (err) {
      console.error("[play] failed to join room", err);
      setErrorMessage("Couldn't reach the game server. Make sure it's running (pnpm dev:server).");
      setStage("error");
    }
  }

  function cancelQueue() {
    roomRef.current?.leave();
    roomRef.current = null;
    setStage("select");
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <SiteHeader />
      <PageFade>
        <div className="mt-16 flex flex-col items-center text-center">
          {stage === "select" && (
            <>
              <h1 className="font-display text-3xl font-bold text-slate-100">Ready to duel?</h1>
              <p className="mt-2 text-slate-400">Choose how you want to play.</p>
              <div className="mt-8 grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
                <Card
                  className="cursor-pointer p-6 transition-transform duration-150 hover:-translate-y-1 hover:shadow-glow"
                  onClick={() => startQueue("pvp")}
                >
                  <Swords className="mx-auto h-8 w-8 text-violet-300" />
                  <p className="mt-3 font-display text-lg font-semibold text-slate-100">Ranked 1v1</p>
                  <p className="mt-1 text-xs text-slate-400">Queue for a live opponent. Trophies on the line.</p>
                </Card>
                <Card
                  className="cursor-pointer p-6 transition-transform duration-150 hover:-translate-y-1 hover:shadow-glow-cyan"
                  onClick={() => startQueue("practice")}
                >
                  <Bot className="mx-auto h-8 w-8 text-cyan-300" />
                  <p className="mt-3 font-display text-lg font-semibold text-slate-100">Practice vs Bot</p>
                  <p className="mt-1 text-xs text-slate-400">No trophies at stake. Test your deck instantly.</p>
                </Card>
              </div>
            </>
          )}

          {(stage === "connecting" || stage === "searching") && (
            <QueueStatus
              label={stage === "connecting" ? "Connecting..." : "Searching for opponent..."}
              onCancel={cancelQueue}
            />
          )}

          {stage === "countdown" && <CountdownOverlay seconds={countdownSeconds} />}

          {stage === "error" && (
            <div className="mt-4 flex flex-col items-center gap-4">
              <p className="text-rose-400">{errorMessage}</p>
              <button
                className="text-sm text-slate-400 underline underline-offset-4"
                onClick={() => setStage("select")}
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </PageFade>
    </main>
  );
}
