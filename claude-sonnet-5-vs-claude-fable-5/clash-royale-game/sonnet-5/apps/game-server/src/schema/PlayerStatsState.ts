import { Schema, type } from "@colyseus/schema";

export class PlayerStatsState extends Schema {
  @type("number") cardsPlayed = 0;
  @type("number") damageDealt = 0;
  @type("number") energySpent = 0;
  @type("number") towersDestroyed = 0;
}
