import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { BattleRoom } from "./rooms/BattleRoom";
import { PracticeRoom } from "./rooms/PracticeRoom";

const port = Number(process.env.GAME_SERVER_PORT ?? 2567);

const gameServer = new Server({
  transport: new WebSocketTransport(),
});

gameServer.define("battle", BattleRoom);
gameServer.define("practice", PracticeRoom);

gameServer
  .listen(port)
  .then(() =>
    console.log(`⚔️  Arcane Towers game server listening on ws://localhost:${port}`),
  )
  .catch((err) => {
    console.error("Failed to start game server:", err);
    process.exit(1);
  });
