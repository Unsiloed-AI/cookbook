import { Schema, type } from "@colyseus/schema";

export class ProjectileState extends Schema {
  @type("string") id = "";
  @type("string") ownerSide: "host" | "guest" = "host";
  @type("string") cardId = "";
  @type("number") fromX = 0;
  @type("number") fromY = 0;
  @type("number") toX = 0;
  @type("number") toY = 0;
  @type("number") spawnedAtMs = 0;
  @type("number") willImpactAtMs = 0;
  @type("number") damage = 0;
  @type("number") splashRadius = 0;
  @type("string") targetId = "";
}
