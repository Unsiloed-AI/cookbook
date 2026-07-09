import { WebSocketTransport } from "@colyseus/ws-transport";
import { Server } from "colyseus";
import cors from "cors";
import express from "express";
import http from "http";
import { BattleRoom } from "./rooms/BattleRoom.js";

const PORT = Number(process.env.PORT ?? 2567);

const app = express();
app.use(cors());
app.use(express.json());
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "arcane-towers-game-server" });
});

const httpServer = http.createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("battle", BattleRoom, { mode: "pvp" });
gameServer.define("battle_practice", BattleRoom, { mode: "practice" });

gameServer
  .listen(PORT)
  .then(() => {
    console.log(`Arcane Towers game server listening on ws://localhost:${PORT}`);
  })
  .catch((err) => {
    console.error("Failed to start game server", err);
    process.exit(1);
  });
