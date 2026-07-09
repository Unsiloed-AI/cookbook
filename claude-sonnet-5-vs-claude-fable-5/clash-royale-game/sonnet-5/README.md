# Arcane Towers

A real-time, server-authoritative 1v1 lane tower battler. Queue up, get matched, deploy original spellcraft and battle-forged units across twin lanes, and break your rival's towers before the clock runs out.

Built with Next.js + Phaser 3 on the client, Colyseus on the game server, and Postgres/Prisma for persistence.

![status](https://img.shields.io/badge/status-MVP-8b5cf6)

---

## Table of Contents

- [What's here](#whats-here)
- [Project structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Running it](#running-it)
- [Testing 1v1 multiplayer locally (two tabs)](#testing-1v1-multiplayer-locally-two-tabs)
- [Practice vs Bot](#practice-vs-bot)
- [Running the test suite](#running-the-test-suite)
- [Gameplay overview](#gameplay-overview)
- [Architecture notes](#architecture-notes)
- [Known limitations & tradeoffs](#known-limitations--tradeoffs)
- [Where things live](#where-things-live)

---

## What's here

- **Landing page** with the pitch and a Play button.
- **Dashboard** — trophies, wins/losses/win-rate, recent match history, current deck preview.
- **Cards page** — the full 10-card roster with stats, rarity, and original SVG/Canvas card art (no external assets).
- **Deck builder** — pick exactly 8 of 10 cards; selection order sets your 8-card battle cycle.
- **Matchmaking (Play)** — queue for a live opponent or practice vs. a bot; server-driven "opponent found" + 3s countdown.
- **Battle** — a Phaser 3 canvas (arena, towers, units, projectiles, spell VFX) driven entirely by server state, plus a React HUD (energy bar, 4-card hand, match timer, tower health, result overlay, surrender, emotes).
- **Server-authoritative simulation** — every deploy, hit, tower attack, and win condition is validated and computed on the Colyseus game server at 25 ticks/second. The client never invents state; it only renders and interpolates what the server sends.

---

## Project structure

Monorepo managed with pnpm workspaces:

```
arcane-towers/
├── docker-compose.yml            # isolated Postgres instance for this project
├── apps/
│   ├── web/                      # Next.js app (dashboard, deck builder, matchmaking, Phaser battle client)
│   │   └── src/
│   │       ├── app/              # routes: /, /dashboard, /cards, /deck-builder, /play, /battle, /api/*
│   │       ├── components/       # ui/, dashboard/, cards/, deck-builder/, matchmaking/, battle/
│   │       ├── lib/               # identity, API client, Colyseus client, utils
│   │       ├── store/             # zustand: identity, live battle connection
│   │       └── game/              # Phaser layer: PhaserGameController, BattleScene, EventBus, entities/, vfx/, arena/
│   └── game-server/               # Colyseus server
│       └── src/
│           ├── index.ts           # server bootstrap, room registration
│           ├── rooms/             # BattleRoom.ts, BotController.ts
│           ├── schema/            # @colyseus/schema network state (BattleState, PlayerState, UnitState, ...)
│           ├── simulation/        # pure gameplay logic — energy, movement, targeting, combat, projectiles, spells, deployment, winConditions
│           ├── persistence/       # writes finished matches to Postgres
│           └── test/              # vitest unit tests for simulation/
├── packages/
│   ├── shared/                    # @arcane-towers/shared — framework-free TS: card/tower data, constants, deck cycling, validation, event contracts
│   └── db/                        # @arcane-towers/db — Prisma schema, generated client, seed script
```

`packages/shared` is the single source of truth for every card, unit, and tower stat — both the web app and the game server import from it, so nothing is duplicated or can drift out of sync.

---

## Prerequisites

- **Node.js 20+**
- **pnpm** (`corepack enable` or `npm i -g pnpm`)
- **Docker** (for the isolated Postgres instance) — or a local Postgres 16 if you'd rather not use Docker

---

## Setup

```bash
# 1. Install all workspace dependencies
pnpm install

# 2. Start Postgres (isolated container on port 5433, project-scoped — safe to
#    run alongside other Postgres instances on your machine)
docker compose up -d

# 3. Push the Prisma schema and seed a couple of demo players + a sample match
pnpm db:push
pnpm db:seed
```

Environment variables are already checked in as `.env` / `.env.local` files scoped to each package (this is an MVP/demo project, not a production secret) — no manual `.env` copying needed. For reference, here's what each package expects:

| Package            | File         | Variables                                                                             |
| ------------------ | ------------ | ------------------------------------------------------------------------------------- |
| `packages/db`      | `.env`       | `DATABASE_URL=postgresql://arcane:arcane@localhost:5433/arcane_towers_sonnet`         |
| `apps/game-server` | `.env`       | `PORT=2567`, `DATABASE_URL=...` (same as above)                                       |
| `apps/web`         | `.env.local` | `DATABASE_URL=...` (same as above), `NEXT_PUBLIC_GAME_SERVER_URL=ws://localhost:2567` |

`.env.example` files exist alongside each for reference if you need to point at a different database.

---

## Running it

You need **two processes** running at once: the Colyseus game server and the Next.js web app.

```bash
# Terminal 1 — game server (WebSocket, port 2567)
pnpm dev:server

# Terminal 2 — web app (port 3000)
pnpm dev
```

Then open **http://localhost:3000**.

(`pnpm dev:all` also exists at the root and runs both concurrently in one terminal via `concurrently`, if you prefer a single window.)

---

## Testing 1v1 multiplayer locally (two tabs)

This is the important gotcha: **identity is stored in `localStorage`**, which is shared across regular tabs in the same browser. If you open two normal tabs to test matchmaking, both will claim to be the _same_ player, and you won't actually get two distinct sides in a match.

To test real 1v1 multiplayer locally, use **either** of these:

1. **One normal tab + one Incognito/Private window** (simplest, recommended), or
2. **One normal tab + a second tab at `http://localhost:3000/play?fresh=1`** — the `?fresh=1` query param forces a brand-new guest identity, ignoring whatever is in `localStorage`.

Steps:

1. Tab A: go to `/play`, click **Ranked 1v1**. You'll see "Searching for opponent...".
2. Tab B (incognito, or `?fresh=1`): go to `/play`, click **Ranked 1v1**.
3. Both tabs should immediately show "Opponent found!" and a synced 3-second countdown, then drop into `/battle`.
4. Deploy cards from both sides — you'll see the opponent's deploys appear live in your own canvas within a tick or two.
5. End the match via a king tower kill, the 3-minute timer, or the Surrender button, and confirm both tabs show a matching result (one Victory, one Defeat) and that the Dashboard's match history updates afterward.

---

## Practice vs Bot

From `/play`, choose **Practice vs Bot** instead of Ranked 1v1 to skip matchmaking entirely and play immediately against a simple heuristic opponent (biases toward defense when your units are near its towers, otherwise deploys offensively on a timer). Practice matches are recorded in match history but don't affect trophies.

---

## Running the test suite

```bash
pnpm test
```

This runs vitest across:

- **`packages/shared`** — deck cycling (including a full 8-play round-trip invariant), placement/energy validation boundaries, and card roster data integrity.
- **`apps/game-server`** — the simulation modules (`energy`, `deployment`, `combat`, `targeting`, `movement`, `winConditions`), exercised directly against plain `BattleState` fixtures with **no live Colyseus room** — proof that simulation logic is fully decoupled from networking.

You can also run a package's tests individually, e.g. `pnpm --filter @arcane-towers/game-server test`.

---

## Gameplay overview

- **Energy**: start at 5, cap at 10, regenerate 1 every 2 seconds (doubles in the final 60 seconds of the match).
- **Deck & hand**: an 8-card deck cycles through a 4-card hand. Playing a card sends it to the back of the queue; the next card in line slides into your hand.
- **Arena**: a vertical arena, river down the middle, two bridge crossings, two lanes. Each side has a king tower and two side towers.
- **Towers**: side towers are always active; a king tower only starts attacking once it's taken damage or an enemy unit enters its range. Destroying a king tower ends the match immediately.
- **Cards** (10 total, pick 8 for your deck): Glimmer Sprite, Kestrel Swarm, Blade Acolyte, Sparkfletcher, Bulwark Spire, Emberlobbers, Frostveil Mist, Stone Golem, Cataclysm Bolt, Ironclad Vanguard — spanning cheap cycle units, swarms, ranged/splash attackers, a defensive building, a tank that only targets buildings, and area-damage/slow spells.
- **Match length**: 3 minutes. If time runs out: most enemy towers destroyed wins; tied → higher total remaining health across your own towers wins; still tied → draw.
- **Result screen**: victory/defeat/draw, reason, trophies gained/lost (ranked only), duration, towers destroyed, cards played, damage dealt, energy spent.

---

## Architecture notes

- **Server-authoritative, always.** The client sends intents (`deployCard`, `selectCard`, `requestEmote`, `surrender`, `ready`) — never state. The server (`apps/game-server/src/simulation/deployment.ts`) re-validates match phase, hand index, card ownership, energy, and placement side before mutating anything.
- **Simulation is pure and Colyseus-free.** Everything under `apps/game-server/src/simulation/` operates on plain `BattleState`/`PlayerRuntimeMap` data — no imports from `rooms/` or the Colyseus `Room` base class — which is what makes it directly unit-testable (see `apps/game-server/test/`).
- **Practice-mode bot reuses the real pipeline.** `BotController` doesn't run a separate simulation — it calls the exact same `validateAndDeploy(...)` function a human player's `deployCard` message would call, just with server-generated intents on a timer.
- **Wire schema is minimal.** Only mutable/runtime fields (`x`, `y`, `health`, `energy`, `hand`, ...) are networked via `@colyseus/schema`. Static card/tower stats are looked up client-side from `@arcane-towers/shared` by id, so the wire format stays small and there's a single source of truth for numbers.
- **Projectiles are server-authoritative with a locked trajectory** (computed once at spawn: `willImpactAtMs`, fixed impact point) — the client only tweens a sprite between two already-decided points, so both players see identical hit outcomes with no possibility of desync.
- **React ↔ Phaser boundary**: the Colyseus `Room` is the single source of truth; React and Phaser both read it independently. A tiny `EventBus` (`apps/web/src/game/EventBus.ts`) carries only the handful of signals with no network-state equivalent (`cardSelected`, `cardDeselected`, `deployRequested`). Phaser never calls `room.send()` directly — only React does, keeping the network surface centralized and auditable.
- **No Redis** — in-memory Colyseus presence/matchmaking is sufficient for a single process. The documented upgrade path for horizontal scale is `@colyseus/redis-presence` + `@colyseus/redis-driver`.

---

## Known limitations & tradeoffs

- **No production auth.** Identity is a client-generated UUID in `localStorage`, upserted into Postgres. Fine for a local demo, not for production.
- **Matchmaking is FIFO, not trophy-aware.** `joinOrCreate` pairs whoever's queued, regardless of rating.
- **No unit-unit collision.** Units can visually overlap when stacked — simplification, not a bug.
- **Simple 2-waypoint bridge movement**, not full pathfinding — appropriate given one static river and two fixed crossings.
- **Spells resolve instantly at cast time**; only the visual impact ring is cosmetically delayed client-side.
- **Reconnection is a best-effort layer** (`allowReconnection`, 15s window) on top of an always-working baseline: if a player disconnects mid-match and doesn't return in time, the match resolves immediately as a win for the remaining player. A hard refresh on `/battle` with no active connection in the local store redirects back to `/play`.
- **No deck drag-reorder** — click order in the deck builder _is_ the cycle order.
- **No sudden-death overtime** on a tied timer-expiry result — it's recorded as a draw.
- **Dev-only note:** the web app runs with React Strict Mode on, which double-invokes effects in development (not production) — the Phaser mount/teardown and all Colyseus schema-callback subscriptions are written to tolerate this cleanly.

---

## Where things live

If you're extending this, start here:

- **Add a card**: `packages/shared/src/cards.ts` — that's the only place card stats live; the cards page, deck builder, HUD, and server simulation all read from it.
- **Change simulation rules**: `apps/game-server/src/simulation/` — one file per concern (`energy.ts`, `movement.ts`, `targeting.ts`, `combat.ts`, `projectiles.ts`, `spells.ts`, `deployment.ts`, `winConditions.ts`), orchestrated by `BattleSimulation.ts`.
- **Change what's networked**: `apps/game-server/src/schema/` (server) — remember to mirror field names in `apps/web/src/game/battleTypes.ts` (client-side duck-typed view).
- **Change battle visuals**: `apps/web/src/game/BattleScene.ts` plus `entities/`, `vfx/`, and `arena/` — all procedural (Phaser Graphics + generated textures), no external art assets.
- **Change the room lifecycle / matchmaking**: `apps/game-server/src/rooms/BattleRoom.ts`.
