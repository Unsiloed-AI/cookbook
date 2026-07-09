import { Schema, type } from "@colyseus/schema";

export class EffectState extends Schema {
  @type("string") id = "";
  @type("string") cardId = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") radius = 0;
  @type("number") spawnedAtMs = 0;
  @type("number") durationMs = 0;
}
