import {
  ARENA,
  getCard,
  isValidSpellPlacement,
  isValidUnitPlacement,
  type EffectMessage,
  type Side,
} from "@arcane/shared";
import { getStateCallbacks } from "colyseus.js";
import Phaser from "phaser";
import type { BattleConnection } from "./BattleConnection";
import type { NetPlayer, NetProjectile, NetState, NetTower, NetUnit } from "./netTypes";
import {
  ARENA_H,
  ARENA_W,
  createTowerArt,
  drawArena,
  drawHpBar,
  ensureFxTextures,
  TEAM_ENEMY,
  TEAM_FRIENDLY,
  TILE,
} from "./visuals";

interface UnitView {
  root: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Arc;
  icon: Phaser.GameObjects.Text;
  hpBar: Phaser.GameObjects.Graphics;
  frost: Phaser.GameObjects.Text;
  targetX: number;
  targetY: number;
  lastHp: number;
  radiusPx: number;
  friendly: boolean;
  attacking: boolean;
}

interface TowerView {
  root: Phaser.GameObjects.Container;
  art: Phaser.GameObjects.Container;
  hpBar: Phaser.GameObjects.Graphics;
  ruined: boolean;
}

interface ProjectileView {
  dot: Phaser.GameObjects.Arc;
  targetX: number;
  targetY: number;
}

/**
 * Renders the synced battle state. The server is authoritative; this scene
 * only interpolates positions and plays juice (particles, tweens, numbers).
 */
export class BattleScene extends Phaser.Scene {
  private conn!: BattleConnection;
  private mySide: Side = 0;
  private flip = false;
  private $!: ReturnType<typeof getStateCallbacks>;

  private unitViews = new Map<string, UnitView>();
  private towerViews = new Map<string, TowerView>();
  private projViews = new Map<string, ProjectileView>();
  private unsubscribers: Array<() => void> = [];

  private unitZone!: Phaser.GameObjects.Rectangle;
  private spellZone!: Phaser.GameObjects.Rectangle;
  private ghost!: Phaser.GameObjects.Container;
  private ghostCircle!: Phaser.GameObjects.Arc;
  private ghostIcon!: Phaser.GameObjects.Text;
  private ghostCardId: string | null = null;

  constructor() {
    super("battle");
  }

  init(data: { connection: BattleConnection }) {
    this.conn = data.connection;
  }

  create(): void {
    ensureFxTextures(this);
    drawArena(this);

    const room = this.conn.getRoom();
    if (!room) return;
    const state = room.state as unknown as NetState;
    this.mySide = (state.players.get(room.sessionId)?.side ?? 0) as Side;
    this.flip = this.mySide === 1;
    this.$ = getStateCallbacks(room);

    this.createPlacementUi();
    this.wireState(state);
    this.unsubscribers.push(this.conn.on("effect", (e) => this.playEffect(e)));

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      const selected = this.conn.getSnapshot().selectedCardId;
      if (!selected) return;
      const { x, y } = this.toSim(pointer.worldX, pointer.worldY);
      this.conn.deploy(selected, x, y);
      this.conn.setSelectedCard(null);
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribers.forEach((fn) => fn());
    });
  }

  // ----- coordinate mapping (side-1 players see the arena flipped) ---------

  private vx(x: number): number {
    return x * TILE;
  }

  private vy(y: number): number {
    return (this.flip ? ARENA.height - y : y) * TILE;
  }

  private toSim(px: number, py: number): { x: number; y: number } {
    const x = px / TILE;
    const rawY = py / TILE;
    return { x, y: this.flip ? ARENA.height - rawY : rawY };
  }

  // ----- state wiring -------------------------------------------------------

  private wireState(state: NetState): void {
    const $ = this.$ as unknown as (obj: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key: string]: any;
    };

    $(state).players.onAdd((player: NetPlayer) => {
      $(player).towers.onAdd((tower: NetTower) => this.addTower(tower));
    });
    $(state).units.onAdd((unit: NetUnit) => this.addUnit(unit));
    $(state).units.onRemove((unit: NetUnit) => this.removeUnit(unit));
    $(state).projectiles.onAdd((proj: NetProjectile) => this.addProjectile(proj));
    $(state).projectiles.onRemove((proj: NetProjectile) => this.removeProjectile(proj));
  }

  private addTower(tower: NetTower): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const $ = this.$ as unknown as (obj: unknown) => any;
    const friendly = tower.ownerId === this.conn.mySessionId;
    const root = this.add.container(this.vx(tower.x), this.vy(tower.y));
    root.setDepth(this.vy(tower.y));

    const art = createTowerArt(this, tower.kind, friendly);
    const barWidth = tower.kind === "main" ? 60 : 46;
    const hpBar = this.add.graphics();
    hpBar.setPosition(-barWidth / 2, -(tower.kind === "main" ? 62 : 48));
    drawHpBar(hpBar, 1, barWidth, friendly);
    root.add([art, hpBar]);

    const view: TowerView = { root, art, hpBar, ruined: false };
    this.towerViews.set(tower.id, view);

    $(tower).listen("hp", (hp: number, prev: number) => {
      drawHpBar(hpBar, hp / tower.maxHp, barWidth, friendly);
      if (prev !== undefined && hp < prev) {
        this.showDamage(root.x, root.y - 30, Math.round(prev - hp));
        this.tweens.add({ targets: art, alpha: 0.55, duration: 60, yoyo: true });
      }
      if (hp <= 0 && !view.ruined) {
        view.ruined = true;
        art.setAlpha(0.25);
        hpBar.setVisible(false);
      }
    });
  }

  private addUnit(unit: NetUnit): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const $ = this.$ as unknown as (obj: unknown) => any;
    const card = getCard(unit.cardId);
    const radiusPx = (card?.unit?.radius ?? 0.4) * TILE * 1.35;
    const friendly = unit.ownerId === this.conn.mySessionId;
    const color = card?.color ?? 0xffffff;

    const root = this.add.container(this.vx(unit.x), this.vy(unit.y));
    const shadow = this.add.ellipse(0, radiusPx * 0.7, radiusPx * 1.7, radiusPx * 0.6, 0x000000, 0.28);
    const body = this.add.circle(0, 0, radiusPx, color, 1);
    body.setStrokeStyle(3, friendly ? TEAM_FRIENDLY : TEAM_ENEMY, 1);
    const icon = this.add
      .text(0, 0, card?.icon ?? "❔", { fontSize: `${Math.round(radiusPx * 1.15)}px` })
      .setOrigin(0.5);
    const hpBar = this.add.graphics();
    const barWidth = Math.max(24, radiusPx * 2);
    hpBar.setPosition(-barWidth / 2, -radiusPx - 12);
    drawHpBar(hpBar, unit.hp / unit.maxHp, barWidth, friendly);
    const frost = this.add
      .text(radiusPx * 0.7, -radiusPx * 0.9, "❄️", { fontSize: "12px" })
      .setOrigin(0.5)
      .setVisible(unit.slowed);

    root.add([shadow, body, icon, hpBar, frost]);
    root.setScale(0);
    this.tweens.add({ targets: root, scale: 1, duration: 180, ease: "Back.Out" });

    const view: UnitView = {
      root,
      body,
      icon,
      hpBar,
      frost,
      targetX: root.x,
      targetY: root.y,
      lastHp: unit.hp,
      radiusPx,
      friendly,
      attacking: false,
    };
    this.unitViews.set(unit.id, view);

    $(unit).onChange(() => {
      view.targetX = this.vx(unit.x);
      view.targetY = this.vy(unit.y);
      view.attacking = unit.state === "attacking";
      if (unit.hp < view.lastHp) {
        this.showDamage(view.root.x, view.root.y - radiusPx - 14, Math.round(view.lastHp - unit.hp));
        this.tweens.add({ targets: body, alpha: 0.4, duration: 50, yoyo: true });
      }
      view.lastHp = unit.hp;
      drawHpBar(hpBar, unit.hp / unit.maxHp, barWidth, friendly);
      frost.setVisible(unit.slowed);
    });
  }

  private removeUnit(unit: NetUnit): void {
    const view = this.unitViews.get(unit.id);
    if (!view) return;
    this.unitViews.delete(unit.id);
    this.burst(view.root.x, view.root.y, 8, 0xcccccc, 60);
    this.tweens.add({
      targets: view.root,
      scale: 0,
      alpha: 0,
      duration: 150,
      onComplete: () => view.root.destroy(),
    });
  }

  private addProjectile(proj: NetProjectile): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const $ = this.$ as unknown as (obj: unknown) => any;
    const color = proj.cardId === "tower" ? 0xf5c95c : (getCard(proj.cardId)?.color ?? 0xffffff);
    const dot = this.add.circle(this.vx(proj.x), this.vy(proj.y), 5, color, 1);
    dot.setStrokeStyle(2, 0xffffff, 0.8);
    dot.setDepth(ARENA_H + 10);
    const view: ProjectileView = { dot, targetX: dot.x, targetY: dot.y };
    this.projViews.set(proj.id, view);
    $(proj).onChange(() => {
      view.targetX = this.vx(proj.x);
      view.targetY = this.vy(proj.y);
    });
  }

  private removeProjectile(proj: NetProjectile): void {
    const view = this.projViews.get(proj.id);
    if (!view) return;
    this.projViews.delete(proj.id);
    this.burst(view.dot.x, view.dot.y, 4, 0xffe9a8, 40);
    view.dot.destroy();
  }

  // ----- placement preview --------------------------------------------------

  private createPlacementUi(): void {
    // Own half (always the bottom half in view coordinates).
    const zoneTop = ARENA.riverBottom * TILE;
    this.unitZone = this.add
      .rectangle(ARENA_W / 2, (zoneTop + ARENA_H) / 2, ARENA_W, ARENA_H - zoneTop, 0x7c6cf5, 0.12)
      .setDepth(ARENA_H + 20)
      .setVisible(false);
    this.spellZone = this.add
      .rectangle(ARENA_W / 2, ARENA_H / 2, ARENA_W, ARENA_H, 0x7c6cf5, 0.07)
      .setDepth(ARENA_H + 20)
      .setVisible(false);

    this.ghostCircle = this.add.circle(0, 0, TILE, 0xffffff, 0.25);
    this.ghostIcon = this.add.text(0, 0, "", { fontSize: "28px" }).setOrigin(0.5);
    this.ghost = this.add.container(0, 0, [this.ghostCircle, this.ghostIcon]);
    this.ghost.setDepth(ARENA_H + 30).setVisible(false);
  }

  private updatePlacementUi(): void {
    const selected = this.conn.getSnapshot().selectedCardId;
    if (selected !== this.ghostCardId) {
      this.ghostCardId = selected;
      const card = selected ? getCard(selected) : undefined;
      this.unitZone.setVisible(!!card && card.type !== "spell");
      this.spellZone.setVisible(!!card && card.type === "spell");
      this.ghost.setVisible(!!card);
      if (card) {
        this.ghostIcon.setText(card.icon);
        const r = card.spell ? card.spell.radius * TILE : (card.unit?.radius ?? 0.5) * TILE * 2;
        this.ghostCircle.setRadius(Math.max(r, 14));
      }
    }
    if (!selected) return;

    const pointer = this.input.activePointer;
    this.ghost.setPosition(pointer.worldX, pointer.worldY);
    const sim = this.toSim(pointer.worldX, pointer.worldY);
    const card = getCard(selected);
    const valid = card?.type === "spell"
      ? isValidSpellPlacement(sim.x, sim.y)
      : isValidUnitPlacement(this.mySide, sim.x, sim.y);
    this.ghostCircle.setFillStyle(valid ? 0x8affa1 : 0xff6b6b, 0.3);
  }

  // ----- effects & juice ------------------------------------------------------

  private playEffect(e: EffectMessage): void {
    const x = this.vx(e.x);
    const y = this.vy(e.y);
    const radiusPx = (e.radius ?? 1) * TILE;

    switch (e.kind) {
      case "deploy":
        this.ring(x, y, TILE, 0xffffff);
        this.burst(x, y, 10, 0xffffff, 80);
        break;
      case "spell-fire":
        this.ring(x, y, radiusPx, 0xff7038);
        this.burst(x, y, 34, 0xff7038, 220, 0xffd166);
        this.cameras.main.shake(120, 0.006);
        break;
      case "spell-frost":
        this.ring(x, y, radiusPx, 0x6ec9f5);
        this.burst(x, y, 26, 0x6ec9f5, 160, 0xffffff);
        break;
      case "spell-bolt":
        this.lightning(x, y);
        this.ring(x, y, radiusPx, 0xffe14d);
        this.burst(x, y, 30, 0xffe14d, 200, 0xffffff);
        this.cameras.main.shake(150, 0.008);
        break;
      case "tower-explode":
        this.burst(x, y, 60, 0xffb347, 320, 0x8d99ae);
        this.ring(x, y, radiusPx * 2.2, 0xffb347);
        this.cameras.main.shake(280, 0.014);
        break;
    }
  }

  private ring(x: number, y: number, toRadius: number, color: number): void {
    const circle = this.add.circle(x, y, 8, color, 0);
    circle.setStrokeStyle(4, color, 0.9);
    circle.setDepth(ARENA_H + 5);
    this.tweens.add({
      targets: circle,
      radius: toRadius,
      alpha: 0,
      duration: 380,
      ease: "Cubic.Out",
      onComplete: () => circle.destroy(),
    });
  }

  private burst(
    x: number,
    y: number,
    quantity: number,
    tint: number,
    speed: number,
    tint2?: number,
  ): void {
    const emitter = this.add.particles(x, y, "spark", {
      speed: { min: speed * 0.4, max: speed },
      scale: { start: 1.1, end: 0 },
      lifespan: { min: 250, max: 550 },
      tint: tint2 !== undefined ? [tint, tint2] : tint,
      emitting: false,
    });
    emitter.setDepth(ARENA_H + 6);
    emitter.explode(quantity);
    this.time.delayedCall(700, () => emitter.destroy());
  }

  private lightning(x: number, y: number): void {
    const g = this.add.graphics();
    g.setDepth(ARENA_H + 7);
    g.lineStyle(4, 0xffe14d, 1);
    let px = x + Phaser.Math.Between(-30, 30);
    let py = Math.max(0, y - 260);
    g.beginPath();
    g.moveTo(px, py);
    while (py < y - 12) {
      px = x + Phaser.Math.Between(-24, 24);
      py += Phaser.Math.Between(28, 52);
      g.lineTo(px, py);
    }
    g.lineTo(x, y);
    g.strokePath();
    this.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
  }

  private showDamage(x: number, y: number, amount: number): void {
    if (amount < 1) return;
    const text = this.add
      .text(x + Phaser.Math.Between(-8, 8), y, `${amount}`, {
        fontSize: "16px",
        fontStyle: "bold",
        color: "#ffd166",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(ARENA_H + 40);
    this.tweens.add({
      targets: text,
      y: y - 28,
      alpha: 0,
      duration: 650,
      ease: "Cubic.Out",
      onComplete: () => text.destroy(),
    });
  }

  // ----- frame update -----------------------------------------------------------

  update(time: number, delta: number): void {
    const dt = delta / 1000;
    const unitLerp = Math.min(1, dt * 12);
    const projLerp = Math.min(1, dt * 20);

    for (const view of this.unitViews.values()) {
      view.root.x += (view.targetX - view.root.x) * unitLerp;
      view.root.y += (view.targetY - view.root.y) * unitLerp;
      view.root.setDepth(view.root.y);
      // Little combat wiggle so attacking units feel alive.
      view.icon.setScale(view.attacking ? 1 + 0.1 * Math.sin(time / 55) : 1);
    }
    for (const view of this.projViews.values()) {
      view.dot.x += (view.targetX - view.dot.x) * projLerp;
      view.dot.y += (view.targetY - view.dot.y) * projLerp;
    }
    this.updatePlacementUi();
  }
}
