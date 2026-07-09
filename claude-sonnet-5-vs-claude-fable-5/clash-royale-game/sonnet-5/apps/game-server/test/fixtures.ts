import {
  buildInitialCycle,
  ENERGY_START,
  getHand,
  getNextCard,
  getTowerDefinition,
  MATCH_DURATION_MS,
  STARTER_DECK_CARD_IDS,
  TOWER_POSITIONS,
  type Side,
} from "@arcane-towers/shared";
import { BattleState } from "../src/schema/BattleState.js";
import { PlayerState } from "../src/schema/PlayerState.js";
import { TowerState } from "../src/schema/TowerState.js";
import type { PlayerRuntimeMap } from "../src/simulation/types.js";

function createPlayer(sessionId: string, side: Side, name: string): PlayerState {
  const player = new PlayerState();
  player.sessionId = sessionId;
  player.playerId = sessionId;
  player.name = name;
  player.side = side;
  player.energy = ENERGY_START;
  player.connected = true;
  return player;
}

export function createTestState(): { state: BattleState; runtime: PlayerRuntimeMap } {
  const state = new BattleState();
  state.matchId = "test-match";
  state.mode = "pvp";
  state.phase = "active";
  state.matchTimeRemainingMs = MATCH_DURATION_MS;

  for (const pos of TOWER_POSITIONS) {
    const tower = new TowerState();
    tower.id = pos.id;
    tower.ownerSide = pos.side;
    tower.kind = pos.kind;
    tower.x = pos.x;
    tower.y = pos.y;
    const def = getTowerDefinition(pos.kind);
    tower.health = def.health;
    tower.maxHealth = def.health;
    tower.activated = pos.kind === "side";
    state.towers.set(tower.id, tower);
  }

  const runtime: PlayerRuntimeMap = new Map();
  const host = createPlayer("host-session", "host", "Host");
  const guest = createPlayer("guest-session", "guest", "Guest");
  state.players.set(host.sessionId, host);
  state.players.set(guest.sessionId, guest);

  for (const player of [host, guest]) {
    const cycle = buildInitialCycle(STARTER_DECK_CARD_IDS);
    runtime.set(player.sessionId, { fullCycle: cycle, energyAccumMs: 0 });
    for (const id of getHand(cycle)) player.hand.push(id);
    player.nextCard = getNextCard(cycle);
  }

  return { state, runtime };
}
