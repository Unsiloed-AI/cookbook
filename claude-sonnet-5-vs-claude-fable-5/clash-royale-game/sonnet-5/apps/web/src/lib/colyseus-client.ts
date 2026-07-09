import { Client } from "colyseus.js";

let client: Client | null = null;

export function getColyseusClient(): Client {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? "ws://localhost:2567";
    client = new Client(url);
  }
  return client;
}
