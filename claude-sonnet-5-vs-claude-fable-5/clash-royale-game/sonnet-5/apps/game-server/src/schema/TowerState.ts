import { Schema, type } from "@colyseus/schema";

export class TowerState extends Schema {
  @type("string") id = "";
  @type("string") ownerSide: "host" | "guest" = "host";
  @type("string") kind: "side" | "king" = "side";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") health = 0;
  @type("number") maxHealth = 0;
  @type("boolean") activated = true;
  @type("boolean") destroyed = false;
  @type("string") targetId = "";
  @type("number") attackCooldownRemainingMs = 0;
}
