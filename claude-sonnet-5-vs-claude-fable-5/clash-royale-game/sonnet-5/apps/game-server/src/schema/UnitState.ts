import { Schema, type } from "@colyseus/schema";

export class UnitState extends Schema {
  @type("string") id = "";
  @type("string") ownerSide: "host" | "guest" = "host";
  @type("string") cardId = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") health = 0;
  @type("number") maxHealth = 0;
  @type("string") state: "moving" | "attacking" = "moving";
  @type("string") targetId = "";
  @type("number") attackCooldownRemainingMs = 0;
  @type("number") slowedUntilMs = 0;
  @type("number") slowFactor = 1;
}
