import { getCardById, isValidPlacement } from "@arcane-towers/shared";
import { getStateCallbacks } from "colyseus.js";
import Phaser from "phaser";
import { drawArenaBackground } from "./arena/ArenaBackground";
import type { BattleRoom, ClientEffect, ClientProjectile, ClientTower, ClientUnit, Side } from "./battleTypes";
import { CANVAS_HEIGHT, CANVAS_WIDTH, PIXELS_PER_UNIT, screenToWorld, worldToScreen } from "./coords";
import { launchProjectile } from "./entities/ProjectileSprite";
import { TowerSprite } from "./entities/TowerSprite";
import { UnitSprite } from "./entities/UnitSprite";
import {
  CARD_DESELECTED,
  CARD_SELECTED,
  DEPLOY_REQUESTED,
  EventBus,
  type CardSelectedPayload,
  type DeployRequestedPayload,
} from "./EventBus";
import { showDamageNumber } from "./vfx/DamageNumber";
import { spawnDeathPoof, spawnDeployBurst, spawnImpactSpark, spawnSpellRing } from "./vfx/ParticleManager";
import { generateProjectileTexture, generateTowerTextures, generateUnitTextures } from "./vfx/SpriteFactory";

const SIDE_COLOR: Record<Side, number> = { host: 0x8b5cf6, guest: 0x22d3ee };

export class BattleScene extends Phaser.Scene {
  private room!: BattleRoom;
  private mySide!: Side;

  private unitSprites = new Map<string, UnitSprite>();
  private towerSprites = new Map<string, TowerSprite>();

  private ghost: Phaser.GameObjects.Graphics | null = null;
  private selected: CardSelectedPayload | null = null;
  private stateDisposers: Array<() => void> = [];

  private handleCardSelected = (payload: CardSelectedPayload): void => {
    this.selected = payload;
  };

  private handleCardDeselected = (): void => {
    this.clearSelection();
  };

  constructor() {
    super("BattleScene");
  }

  create(): void {
    this.room = this.registry.get("room");
    this.mySide = this.registry.get("mySide");

    generateUnitTextures(this);
    generateTowerTextures(this);
    generateProjectileTexture(this);

    drawArenaBackground(this);

    const $ = getStateCallbacks(this.room);

    for (const tower of this.room.state.towers.values()) {
      this.addTowerSprite(tower);
    }

    // Every schema callback subscription lives on the Room's state, not on
    // this Phaser scene — it MUST be explicitly disposed on teardown, or a
    // torn-down scene instance keeps receiving callbacks (fatal, since its
    // `add` factory is null after destroy). This also protects against
    // React StrictMode's dev-only double-mount of BattleCanvasMount.
    this.stateDisposers.push(
      $(this.room.state).units.onAdd((unit) => this.addUnitSprite(unit), true),
      $(this.room.state).units.onRemove((unit) => this.removeUnitSprite(unit)),
      $(this.room.state).projectiles.onAdd((projectile) => this.playProjectile(projectile), true),
      $(this.room.state).effects.onAdd((effect) => this.playEffect(effect), true),
    );

    EventBus.on(CARD_SELECTED, this.handleCardSelected);
    EventBus.on(CARD_DESELECTED, this.handleCardDeselected);

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => this.updateGhost(pointer.x, pointer.y));
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.handlePointerDown(pointer.x, pointer.y));

    this.cameras.main.setBounds(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup());
  }

  update(_time: number, delta: number): void {
    if (!this.room) return;
    const lerpFactor = Phaser.Math.Clamp(delta / 120, 0.15, 1);

    for (const unit of this.room.state.units.values()) {
      const sprite = this.unitSprites.get(unit.id);
      if (!sprite) continue;

      const screen = worldToScreen(unit.x, unit.y, this.mySide);
      sprite.moveToward(screen.x, screen.y, lerpFactor);
      sprite.setAttacking(unit.state === "attacking");

      const damage = sprite.updateHealth(unit.health, unit.maxHealth);
      if (damage > 0) showDamageNumber(this, sprite.screenX, sprite.screenY - 24, damage);
    }

    for (const tower of this.room.state.towers.values()) {
      const sprite = this.towerSprites.get(tower.id);
      if (!sprite) continue;
      sprite.setHealth(tower.health, tower.maxHealth);
      sprite.setDestroyed(tower.destroyed);
      sprite.setActivated(tower.activated);
    }
  }

  private addTowerSprite(tower: ClientTower): void {
    const screen = worldToScreen(tower.x, tower.y, this.mySide);
    const sprite = new TowerSprite(this, tower.kind, tower.ownerSide, screen.x, screen.y, tower.health, tower.maxHealth);
    this.towerSprites.set(tower.id, sprite);
  }

  private addUnitSprite(unit: ClientUnit): void {
    if (this.unitSprites.has(unit.id)) return;
    const screen = worldToScreen(unit.x, unit.y, this.mySide);
    const sprite = new UnitSprite(this, unit.cardId, screen.x, screen.y, unit.health, unit.maxHealth);
    this.unitSprites.set(unit.id, sprite);
    spawnDeployBurst(this, screen.x, screen.y, SIDE_COLOR[unit.ownerSide]);
  }

  private removeUnitSprite(unit: ClientUnit): void {
    const sprite = this.unitSprites.get(unit.id);
    if (!sprite) return;
    spawnDeathPoof(this, sprite.screenX, sprite.screenY, SIDE_COLOR[unit.ownerSide]);
    sprite.destroy();
    this.unitSprites.delete(unit.id);
  }

  private playProjectile(projectile: ClientProjectile): void {
    const from = worldToScreen(projectile.fromX, projectile.fromY, this.mySide);
    const to = worldToScreen(projectile.toX, projectile.toY, this.mySide);
    const remaining = projectile.willImpactAtMs - Date.now();

    launchProjectile(this, from.x, from.y, to.x, to.y, remaining, () => {
      spawnImpactSpark(this, to.x, to.y, SIDE_COLOR[projectile.ownerSide]);
    });
  }

  private playEffect(effect: ClientEffect): void {
    const screen = worldToScreen(effect.x, effect.y, this.mySide);
    const card = getCardById(effect.cardId);
    const color = card ? Phaser.Display.Color.HexStringToColor(card.visual.primaryColor).color : 0x8b5cf6;
    spawnSpellRing(this, screen.x, screen.y, effect.radius * PIXELS_PER_UNIT, color, effect.durationMs);
  }

  private updateGhost(screenX: number, screenY: number): void {
    if (!this.selected) {
      this.ghost?.setVisible(false);
      return;
    }
    if (!this.ghost) {
      this.ghost = this.add.graphics();
      this.ghost.setDepth(99999);
    }

    const card = getCardById(this.selected.cardId);
    if (!card) return;

    const world = screenToWorld(screenX, screenY, this.mySide);
    const check = isValidPlacement(card.category, world.x, world.y, this.mySide);

    this.ghost.clear();
    this.ghost.setVisible(true);
    const color = check.valid ? 0x34d399 : 0xf87171;
    this.ghost.fillStyle(color, 0.22);
    this.ghost.lineStyle(2, color, 0.85);
    this.ghost.fillCircle(screenX, screenY, 28);
    this.ghost.strokeCircle(screenX, screenY, 28);
  }

  private handlePointerDown(screenX: number, screenY: number): void {
    if (!this.selected) return;
    const card = getCardById(this.selected.cardId);
    if (!card) return;

    const world = screenToWorld(screenX, screenY, this.mySide);
    const check = isValidPlacement(card.category, world.x, world.y, this.mySide);
    if (!check.valid) return;

    const payload: DeployRequestedPayload = {
      handIndex: this.selected.handIndex,
      worldX: world.x,
      worldY: world.y,
    };
    EventBus.emit(DEPLOY_REQUESTED, payload);
    this.clearSelection();
  }

  private clearSelection(): void {
    this.selected = null;
    this.ghost?.setVisible(false);
  }

  private cleanup(): void {
    EventBus.off(CARD_SELECTED, this.handleCardSelected);
    EventBus.off(CARD_DESELECTED, this.handleCardDeselected);
    for (const dispose of this.stateDisposers) dispose();
    this.stateDisposers = [];
    for (const sprite of this.unitSprites.values()) sprite.destroy();
    for (const sprite of this.towerSprites.values()) sprite.destroy();
    this.unitSprites.clear();
    this.towerSprites.clear();
  }
}
