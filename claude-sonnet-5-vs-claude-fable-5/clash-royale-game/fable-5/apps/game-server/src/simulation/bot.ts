import { ARENA, getCard, isOnOwnSide } from "@arcane/shared";
import type { UnitState } from "../rooms/schema/BattleState";
import type { BattleSimulation } from "./BattleSimulation";

/**
 * Deliberately simple practice opponent:
 *  - if enemy units are on its half, drop a defender (or a spell) near them,
 *  - otherwise save energy and push a random lane.
 */
export class BotController {
  private cooldown = 2.5;

  constructor(
    private readonly sim: BattleSimulation,
    private readonly botId: string,
  ) {}

  update(dt: number): void {
    const { state } = this.sim;
    if (state.phase !== "active") return;

    this.cooldown -= dt;
    if (this.cooldown > 0) return;
    this.cooldown = 1.2 + Math.random() * 1.5;

    const bot = state.players.get(this.botId);
    if (!bot) return;

    const affordable = [...bot.hand].filter((id) => {
      const card = getCard(id);
      return card !== undefined && card.cost <= bot.energy;
    });
    if (affordable.length === 0) return;

    const threats: UnitState[] = [];
    for (const u of state.units.values()) {
      if (u.ownerId !== this.botId && u.hp > 0 && isOnOwnSide(bot.side, u.y)) {
        threats.push(u);
      }
    }

    if (threats.length > 0) {
      this.defend(threats, affordable, bot.side);
    } else if (bot.energy >= 7) {
      this.attack(affordable, bot.side);
    }
  }

  private defend(threats: UnitState[], affordable: string[], side: 0 | 1): void {
    // Most advanced threat = closest to the bot's main tower.
    const threat = threats.reduce((a, b) =>
      side === 1 ? (a.y < b.y ? a : b) : (a.y > b.y ? a : b),
    );

    const spells = affordable.filter((id) => getCard(id)?.type === "spell");
    if (spells.length > 0 && threats.length >= 2 && Math.random() < 0.5) {
      this.sim.deploy(this.botId, pick(spells), threat.x, threat.y);
      return;
    }

    const defenders = affordable.filter((id) => getCard(id)?.type !== "spell");
    if (defenders.length === 0) return;
    // Drop the defender between the threat and our main tower.
    const y = clampToSide(side, threat.y + (side === 1 ? -2 : 2));
    const x = clampX(threat.x + (Math.random() - 0.5));
    this.sim.deploy(this.botId, pick(defenders), x, y);
  }

  private attack(affordable: string[], side: 0 | 1): void {
    const units = affordable.filter((id) => getCard(id)?.type === "unit");
    if (units.length === 0) return;
    const lane = ARENA.bridges[Math.floor(Math.random() * ARENA.bridges.length)];
    const y = side === 1 ? ARENA.riverTop - 3 : ARENA.riverBottom + 3;
    this.sim.deploy(this.botId, pick(units), clampX(lane + (Math.random() * 2 - 1)), y);
  }
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clampX(x: number): number {
  return Math.min(ARENA.width - 1, Math.max(1, x));
}

function clampToSide(side: 0 | 1, y: number): number {
  return side === 1
    ? Math.min(ARENA.riverTop - 0.5, Math.max(1, y))
    : Math.max(ARENA.riverBottom + 0.5, Math.min(ARENA.height - 1, y));
}
