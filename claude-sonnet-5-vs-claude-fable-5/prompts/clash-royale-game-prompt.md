Prompt asking AI models to build a tower defense game like Clash Royale

You are an expert full-stack engineer and game developer.

Your task is to build a polished web-based real-time lane tower battle game inspired by card battlers like Clash Royale, but do not copy any existing game's characters, card names, art style, UI, assets, sound effects, or branding.

This should not be a toy demo.

Build a serious MVP that feels like a real web game. The focus is the playable battle experience, but the app should also include a dashboard, deck management, matchmaking, and match history.

## Goal

Build a browser-based multiplayer 1v1 tower battle game where:

- A user can open the app
- View a dashboard
- View and edit their deck
- Click Play
- Wait for an opponent
- Get matched with another player
- Enter a real-time battle
- Deploy cards onto the arena
- Watch units move, attack, and destroy towers
- Win or lose based on tower destruction or match timer
- See a result screen
- Return to the dashboard and see updated match history and stats

The game should be visually appealing, playable, and fun enough that someone can judge it from screenshots or a short screen recording.

## Important Expectations

This is a coding benchmark task. I will judge the final result based on:

- Code quality
- Architecture
- Feature completion
- Bugs
- Multiplayer correctness
- Visual output
- Game feel
- Token usage
- Cost
- Time to complete
- Overall vibe

Please prioritize a working, polished MVP over over-engineered unfinished code.

## Required Tech Stack

Use the following stack unless there is a very strong reason not to:

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- Phaser 3 for the actual battle game canvas
- shadcn/ui or clean custom components for dashboard UI
- Framer Motion only if useful for lightweight UI animations

### Game Server

- Node.js
- TypeScript
- Colyseus for real-time multiplayer rooms, matchmaking, and WebSocket-based state sync

### Database

- PostgreSQL
- Prisma ORM

### Shared Code

Create a shared package or shared folder for:

- Card definitions
- Unit stats
- Tower stats
- Shared TypeScript types
- Match events
- Game constants

### Optional

Use Redis only if you actually need it. For this MVP, in-memory matchmaking is acceptable, but the architecture should make it clear where Redis would fit later.

## Architecture Requirements

Use a server-authoritative multiplayer architecture.

The client should never be the source of truth for match state.

The client may send player intents, such as:

- deployCard
- selectCard
- requestEmote
- surrender
- ready

The server should validate all important actions.

For example, when a player deploys a card, the server must check:

- Is the match active?
- Is the card currently in the player's hand?
- Does the player have enough energy?
- Is the placement location valid?
- Is the card off cooldown, if cooldown exists?
- Is the player deploying on their allowed side of the arena?
- Is the player still connected or eligible to act?

Only after validation should the server update the game state.

Both clients should receive synced match state from the server.

The Phaser client should render the current state and use lightweight interpolation where helpful, but the server remains the source of truth.

## Suggested Project Structure

Use a clean monorepo style structure.

Example:

```txt
apps/
  web/
    Next.js app
    dashboard pages
    deck builder
    matchmaking screen
    Phaser battle client

  game-server/
    Colyseus server
    matchmaking logic
    battle room
    server-side simulation
    room state schemas

packages/
  shared/
    cards
    units
    towers
    constants
    shared types

  db/
    Prisma schema
    Prisma client
```

If you choose a different structure, keep it equally clean and explain it.

## App Pages

Build the following pages or routes.

### 1. Landing Page

A simple landing page with:

- Game title
- Short description
- Play button
- Link to dashboard

Use an original game name. Do not use Clash Royale branding.

Possible names:

- Towerbound Arena
- Card Clash Arena
- Realm Rush
- Battle Lanes
- Arcane Towers

Pick one and use it consistently.

### 2. Dashboard

The dashboard should show:

- Player name
- Current trophies or rating
- Total wins
- Total losses
- Win rate
- Recent match history
- Current selected deck
- Button to play
- Button to edit deck
- Basic stats cards

For MVP, authentication can be simple.

Use either:

- guest player profiles stored locally
- simple username entry
- mock auth with a generated player ID

Do not spend too much time building full production auth unless everything else is already done.

### 3. Cards Page

Show all available cards.

Each card should display:

- Name
- Type
- Energy cost
- Health, damage, range, speed, or spell effect
- Short description
- Rarity or category
- Small visual card design

### 4. Deck Builder

Allow the player to build an 8-card deck.

Rules:

- Deck must contain exactly 8 cards
- Player can choose from available cards
- The active battle hand should show 4 cards at a time
- After using a card, it rotates to the back of the cycle and the next card enters hand

Keep this simple but functional.

### 5. Play / Matchmaking Page

When the user clicks Play:

- Show a matchmaking screen
- Show "Searching for opponent..."
- Put the player into a queue
- If another player joins, create a match room
- Show "Opponent found"
- Start a 3-second countdown
- Then transition into the battle arena

For local testing, it should be possible to open the app in two browser windows or two tabs and match the two players together.

### 6. Battle Page

This is the main part.

The battle page should contain:

- Phaser game canvas
- Player energy bar
- 4-card hand
- Match timer
- Player tower health
- Opponent tower health
- Win/loss result overlay
- Optional surrender button
- Optional basic emotes

The game should feel visual and interactive.

## Battle Gameplay Requirements

The battle should be a 1v1 real-time lane-based tower battle.

### Arena

Create a vertical arena with:

- Player side at bottom
- Enemy side at top
- River or center divider
- Two lanes
- Bridges or crossing points
- Three towers per player:
  - Left side tower
  - Right side tower
  - Main tower

Use simple but polished visuals.

It does not need real art assets. You can use:

- Colored shapes
- Simple generated sprites
- CSS-like UI
- Phaser graphics
- Icons
- Basic particle effects

But it should still look good.

### Towers

Each player should have:

- 1 main tower
- 2 side towers

Tower behavior:

- Towers have health
- Towers attack enemy units in range
- Side towers attack nearby enemies
- Main tower attacks enemies too
- If the main tower is destroyed, the match ends immediately
- If time expires, the player with more tower health or more destroyed towers wins

Display health bars above towers.

### Energy System

Implement an energy system similar to elixir.

Rules:

- Each player starts with 5 energy
- Maximum energy is 10
- Energy regenerates over time
- Cards cost energy
- A card cannot be played if the player does not have enough energy
- Show the current energy bar clearly in the UI

Use a regeneration rate that makes the game playable.

Example:

- 1 energy every 2 seconds
- Faster energy after the final 60 seconds, if you implement overtime or double energy

### Cards

Implement at least 8 cards.

Use original card names. Do not use copyrighted names.

Example card set:

1. **Iron Guard**
   - Type: melee unit
   - Cost: 3
   - Medium health
   - Medium damage
   - Targets ground units and towers

2. **Forest Archer**
   - Type: ranged unit
   - Cost: 3
   - Low health
   - Medium ranged damage
   - Shoots projectiles

3. **Stone Titan**
   - Type: tank unit
   - Cost: 5
   - High health
   - Slow movement
   - Targets buildings only

4. **Spark Mage**
   - Type: ranged splash unit
   - Cost: 4
   - Low health
   - Splash damage
   - Targets ground and air if air exists

5. **Goblin Pack**
   - Type: swarm unit
   - Cost: 2
   - Spawns 3 small melee units
   - Fast but fragile

6. **Flame Burst**
   - Type: spell
   - Cost: 4
   - Deals area damage at target location
   - Can damage units and towers with reduced tower damage

7. **Cannon Post**
   - Type: building
   - Cost: 3
   - Stationary defensive building
   - Attacks enemy ground units

8. **Frost Bolt**
   - Type: spell
   - Cost: 2
   - Deals small damage
   - Slows affected units briefly

You can adjust names and balance, but keep at least 8 playable cards.

### Card Placement

The player should be able to:

- Click a card
- See valid placement area highlighted
- Click or tap a location in the arena
- Deploy the card if placement is valid and energy is enough

Placement rules:

- Player can only deploy on their own side of the arena
- Some spells may be playable anywhere
- Buildings can only be placed on the player's side
- Units spawn at the selected valid location

For multiplayer:

- The opponent should see the deployed card result almost immediately
- The server should validate the placement
- Invalid placement should be rejected gracefully

### Unit Behavior

Units should:

- Spawn from card deployment
- Move toward enemy side
- Follow a lane or path toward enemy towers
- Pick targets based on range and priority
- Attack enemy units or towers
- Take damage
- Die when health reaches zero
- Show health bars
- Have simple movement and attack animations

Targeting rules:

- Normal troops target nearest enemy unit or tower
- Building-targeting units prioritize towers and buildings
- Ranged units stop at range and shoot projectiles
- Melee units move close before attacking
- Spells apply effects instantly or with a short animation

### Enemy / Opponent

In real multiplayer mode, the opponent is another player.

For fallback testing, also include a simple AI opponent mode if possible.

The priority is real multiplayer, but having a local "Practice vs Bot" button would be a nice bonus.

AI opponent behavior can be simple:

- Deploy random affordable cards
- Prefer defense if units are near its towers
- Otherwise deploy offensive units every few seconds
- Do not make it too smart

### Match Rules

A match should have:

- 3 minute timer
- Main tower destruction ends match immediately
- If timer ends:
  - player with more destroyed towers wins
  - if tied, player with more total remaining tower health wins
  - if still tied, declare draw or enter short overtime

- Result screen shows:
  - Victory / Defeat / Draw
  - Towers destroyed
  - Match duration
  - Cards played
  - Damage dealt
  - Energy spent

### Match History

After a match ends, save the result.

The dashboard should show recent matches with:

- opponent name
- result
- duration
- towers destroyed
- date/time
- trophies gained or lost, if implemented

For MVP, if database persistence is too time-consuming, use a graceful fallback with local storage, but Prisma and PostgreSQL are preferred.

## Visual Requirements

Make the game look polished.

It does not need professional art, but it should not look like a raw debug canvas.

Include:

- Nice arena background
- Tower visuals
- Card UI
- Health bars
- Energy bar
- Unit sprites or simple shapes with personality
- Projectile effects
- Spell effects
- Deployment feedback
- Damage numbers or hit flashes
- Victory and defeat overlay
- Smooth transitions between dashboard, matchmaking, and battle

The final game should be good enough to screenshot and share.

## Multiplayer Requirements

Use Colyseus rooms.

Required behavior:

1. Player clicks Play
2. Client connects to game server
3. Player joins matchmaking
4. If no opponent exists, player waits
5. When second player joins, server creates or assigns both players to a battle room
6. Both clients receive room state
7. Countdown starts
8. Match begins
9. Players deploy cards through WebSocket messages
10. Server validates actions and updates state
11. Clients render synced game state
12. Server determines match result
13. Result is sent to both players
14. Match result is persisted
15. Players can return to dashboard

Handle these edge cases:

- Opponent disconnects
- Player refreshes during battle
- Invalid card deployment
- Not enough energy
- Match already ended
- Server room cleanup after match ends

Reconnect support is a bonus, but at minimum show a clean disconnect result.

## Game State Requirements

The server-side match state should include:

- matchId
- phase: waiting, countdown, active, finished
- timer
- players
- towers
- units
- projectiles, if synced
- active effects
- energy per player
- card hands
- deck cycle
- winner
- match stats

Each player state should include:

- playerId
- name
- side
- energy
- deck
- hand
- nextCards
- towers
- stats

Each unit state should include:

- id
- ownerId
- cardId
- type
- x
- y
- health
- maxHealth
- damage
- range
- speed
- targetId
- attackCooldown
- state: moving, attacking, dead

## Simulation Requirements

Implement a server tick loop.

Example:

- 20 ticks per second or 30 ticks per second
- Update energy regeneration
- Update unit movement
- Update targeting
- Update attacks
- Update projectiles or spell effects
- Update tower attacks
- Check deaths
- Check win/loss conditions
- Broadcast state changes

Keep simulation logic modular.

Suggested files:

```txt
simulation/
  BattleSimulation.ts
  movement.ts
  targeting.ts
  combat.ts
  energy.ts
  spells.ts
  winConditions.ts
```

## Client Rendering Requirements

The Phaser client should:

- Render the arena
- Render towers
- Render units
- Render health bars
- Render projectiles and spell effects
- Render placement preview
- Render selected card state
- Render match timer
- Render victory/defeat overlay
- React to server state updates

The React UI should:

- Render cards
- Render energy bar
- Render dashboard
- Render matchmaking state
- Render match result UI

Do not make Phaser manage the entire app. Use React for app UI and Phaser for the battle scene.

## Developer Experience Requirements

Please include:

- Clear setup instructions
- Environment variable examples
- Database setup instructions
- Seed script for cards
- How to run the web app
- How to run the game server
- How to test multiplayer locally using two browser tabs
- Any known limitations

Add a `README.md` with all commands.

Example commands should be something like:

```bash
pnpm install
pnpm db:push
pnpm db:seed
pnpm dev
pnpm dev:server
```

Use whichever commands match your implementation.

## Quality Requirements

Please keep the code clean.

Important:

- Use TypeScript properly
- Avoid giant single-file implementations
- Keep card data separate from rendering
- Keep server simulation separate from Colyseus room code
- Keep shared constants in shared files
- Avoid hardcoding too much inside UI components
- Add comments only where useful
- Make the game easy to extend with more cards later
- Make the UI responsive enough for desktop browser play

## Testing Requirements

Add basic tests if possible.

Good test targets:

- energy regeneration
- card deployment validation
- invalid placement rejection
- tower damage
- match win condition
- deck cycling
- unit targeting

If full testing is too much, at least structure the logic so it is testable and include a few focused tests for the most important rules.

## Implementation Priority

If time is limited, prioritize in this order:

1. Working local development setup
2. Dashboard and Play flow
3. Colyseus matchmaking
4. Real 1v1 battle room
5. Server-authoritative card deployment
6. Energy system
7. Towers and unit spawning
8. Unit movement and combat
9. Win/loss conditions
10. Phaser visuals
11. Deck builder
12. Match history
13. Polish and animations
14. Tests

Do not spend too much time on full auth, payments, accounts, or complex progression.

The core goal is a playable real-time multiplayer tower battle MVP.

## Final Deliverable

When finished, provide:

1. A summary of what you built
2. The final project structure
3. Setup instructions
4. How to run locally
5. How to test multiplayer with two tabs
6. Main gameplay features implemented
7. Any missing features or known bugs
8. Any tradeoffs you made
9. Suggestions for future improvements

Build the app now.
