import { ArraySchema, Schema, type } from "@colyseus/schema";
import { PlayerStatsState } from "./PlayerStatsState.js";

export class PlayerState extends Schema {
  @type("string") sessionId = "";
  @type("string") playerId = "";
  @type("string") name = "";
  @type("string") side: "host" | "guest" = "host";
  @type("boolean") isBot = false;
  @type("boolean") connected = true;
  @type("boolean") ready = false;
  @type("number") energy = 0;
  @type(["string"]) hand = new ArraySchema<string>();
  @type("string") nextCard = "";
  @type(PlayerStatsState) stats = new PlayerStatsState();
  @type("number") trophyDelta = 0;
}
