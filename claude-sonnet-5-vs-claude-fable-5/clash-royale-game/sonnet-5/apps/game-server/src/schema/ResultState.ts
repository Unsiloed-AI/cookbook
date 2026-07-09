import { Schema, type } from "@colyseus/schema";

export class ResultState extends Schema {
  @type("string") winnerSide: "host" | "guest" | "draw" | "" = "";
  @type("string") reason = "";
  @type("number") endedAtMs = 0;
}
