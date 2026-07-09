import { MapSchema, Schema, type } from "@colyseus/schema";
import { EffectState } from "./EffectState.js";
import { PlayerState } from "./PlayerState.js";
import { ProjectileState } from "./ProjectileState.js";
import { ResultState } from "./ResultState.js";
import { TowerState } from "./TowerState.js";
import { UnitState } from "./UnitState.js";

export type MatchPhase = "waiting" | "countdown" | "active" | "finished";

export class BattleState extends Schema {
  @type("string") matchId = "";
  @type("string") mode: "pvp" | "practice" = "pvp";
  @type("string") phase: MatchPhase = "waiting";
  @type("number") countdownRemainingMs = 0;
  @type("number") matchTimeRemainingMs = 0;
  @type("number") elapsedMs = 0;

  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: UnitState }) units = new MapSchema<UnitState>();
  @type({ map: TowerState }) towers = new MapSchema<TowerState>();
  @type({ map: ProjectileState }) projectiles = new MapSchema<ProjectileState>();
  @type({ map: EffectState }) effects = new MapSchema<EffectState>();
  @type(ResultState) result = new ResultState();
}
