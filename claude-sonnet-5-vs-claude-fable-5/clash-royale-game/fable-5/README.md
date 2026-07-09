# 🏰 Arcane Towers

A real-time 1v1 lane tower battle for the browser. Deploy troops, sling
spells, manage your energy — and bring the enemy citadel down before the
clock runs out.

Built with **Next.js + Phaser 3** on the client and a **server-authoritative
Colyseus simulation** on the backend, with **PostgreSQL + Prisma** for
players, trophies and match history.

| Battle | Victory | Dashboard |
| --- | --- | --- |
| ![Battle](docs/screenshots/battle.png) | ![Victory](docs/screenshots/victory.png) | ![Dashboard](docs/screenshots/dashboard.png) |

## Quick start

Prerequisites: **Node 20+**, **pnpm 9+**, **Docker** (for Postgres).

```bash
pnpm install
cp .env.example .env   # defaults work out of the box

pnpm db:up             # start Postgres in Docker
pnpm db:push           # create the schema
pnpm db:seed           # seed cards + the practice bot

pnpm dev               # web (:3000) + game server (:2567) together
```

Open <http://localhost:3000>, click **Play**.

### Test multiplayer locally

1. Open <http://localhost:3000> in **two browser tabs** (or two windows).
2. Click **Play → Find Opponent** in both.
3. The first tab waits in the queue; the second fills the match. After a
   3-second countdown you're fighting yourself in real time.

No account needed — each browser gets a guest profile (two tabs share one
profile, which is fine: the room keys players by session).

Prefer a solo check? **Play → Practice vs Bot** battles the Training Golem.

## All commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run web + game server concurrently |
| `pnpm dev:web` / `pnpm dev:server` | Run one side only |
| `pnpm db:up` / `pnpm db:down` | Start / stop the Postgres container |
| `pnpm db:push` / `pnpm db:seed` / `pnpm db:generate` | Prisma schema push / seed / client generate |
| `pnpm test` | Simulation unit tests (vitest, 31 tests) |
| `pnpm --filter @arcane/game-server smoke` | Full multiplayer protocol smoke test against a running server |
| `pnpm build` / `pnpm typecheck` | Build / typecheck every workspace |

## Project structure

```
apps/
  web/                 Next.js 15 (App Router) + Tailwind v4 + framer-motion
    src/app/           / (landing) /dashboard /cards /deck /play /battle + REST API routes
    src/components/    dashboard & card UI
    src/game/          Phaser battle client
      BattleConnection.ts   Colyseus client wrapper → React store + event bus
      BattleScene.ts        renders synced state, interpolation, effects
      visuals.ts            procedural arena/tower/hp-bar art (no image assets)
      hud.tsx               energy bar, hand, overlays, emotes
  game-server/         Colyseus 0.16 server (tsx, no build step)
    src/rooms/         BaseBattleRoom → BattleRoom (pvp) / PracticeRoom (bot)
    src/rooms/schema/  @colyseus/schema state (only what clients need is synced)
    src/simulation/    pure game logic, one module per system:
                       energy · targeting · movement · combat · spells ·
                       deploy (validation + deck cycle) · winConditions · bot
    src/persistence.ts writes match results & trophies via Prisma
    scripts/mp-smoke.mjs  end-to-end protocol test with two real clients
packages/
  shared/              single source of truth: cards, towers, constants,
                       placement rules, message types (imported by both apps)
  db/                  Prisma schema + client + seed
```

## Architecture

**The server is the only source of truth.** Clients send *intents*
(`deploy`, `surrender`, `emote`, `ready`); the simulation validates
everything — match phase, card in hand, energy cost, placement zone,
side ownership — before mutating state. The sim runs at **20 ticks/s**
inside the room and Colyseus streams binary state patches to both clients;
the Phaser scene interpolates positions between patches.

**Matchmaking** uses Colyseus `joinOrCreate` with `maxClients: 2`: the first
player creates a room and waits, the second fills and locks it. For
multi-node scale you'd swap the in-memory driver/presence for
`@colyseus/redis-driver` + Redis presence — the room code doesn't change.

**Game rules** (all constants in `packages/shared/src/constants.ts`):

- 3:00 matches, 2 lanes, river with two bridges, 3 towers per player.
- Energy: start 5, max 10, +1 per 2s — **doubled in the final 60s**.
- Deck of exactly 8 unique cards; rotating hand of 4 (played card goes to
  the back of the queue).
- Destroying the **citadel (main tower)** wins instantly. At timeout:
  more towers destroyed → more remaining tower HP → draw.
- Disconnects: 15s reconnection grace (a page refresh mid-battle rejoins
  the same match), then the match is forfeited. Deliberate exits forfeit
  immediately.
- Trophies: ±30 per ranked win/loss, floored at 0. Practice matches are
  recorded but never affect trophies.

**12 original cards**: Iron Guard, Forest Archer, Stone Titan (building-only
targeting), Spark Mage (splash), Goblin Pack (swarm), Flame Burst (spell),
Cannon Post (defensive building with lifetime), Frost Bolt (damage + slow),
Storm Rider, Shield Bearer, Thunder Spike, Twin Blades.

## Testing

- `pnpm test` — 31 vitest unit tests over the pure simulation: energy regen
  and overtime, the full deploy-validation matrix, deck cycling, targeting
  priorities, tower/spell combat, slows, building lifetimes, and every win
  condition including tiebreakers.
- `pnpm --filter @arcane/game-server smoke` — spins up two real Colyseus
  clients against a running server and walks an entire match: matchmaking,
  countdown, deploy sync to the opponent, wrong-side / over-spend
  rejections, emotes, surrender, plus the practice-bot flow.

## Environment

`.env` (see `.env.example`):

```
DATABASE_URL=postgresql://arcane:arcane@localhost:5432/arcane_towers
GAME_SERVER_PORT=2567
NEXT_PUBLIC_GAME_SERVER_URL=ws://localhost:2567
```

## Known limitations & tradeoffs

- **Guest auth only** (by design for this MVP): profiles live in
  `localStorage` and are upserted into Postgres. No passwords or sessions.
- **Full state sync**: both hands are present in the synced state (the UI
  simply doesn't render the opponent's). A cheating client could read the
  opponent's hand; fixing it means `@colyseus/schema` StateViews.
- **DB is optional at runtime**: if Postgres is down, battles still work and
  the dashboard shows an "offline" banner; match results are just not saved.
- No collision/pushing between units — they can overlap slightly.
- Cards are also mirrored into a `Card` table by the seed for querying, but
  the gameplay source of truth is `packages/shared` (the sim needs it
  synchronously).
- Single-node matchmaking (in-memory). Redis integration points are noted
  above.

## Future improvements

- Hidden information via schema StateViews; spectator mode.
- Trophy-based matchmaking buckets and leaderboard page.
- Overtime sudden-death instead of tiebreak, tower-crown progression,
  card levels/upgrades.
- Audio (SFX/music), richer sprite art, mobile touch layout.
- Elo-style rating instead of flat ±30.
