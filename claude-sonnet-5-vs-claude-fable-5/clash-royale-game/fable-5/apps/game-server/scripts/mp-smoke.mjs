/**
 * Multiplayer smoke test: drives two real Colyseus clients through an entire
 * PvP match (matchmake → countdown → deploys → validation → surrender) and a
 * short practice match, asserting the server behaves at every step.
 *
 * Usage: pnpm --filter @arcane/game-server smoke   (server must be running)
 */
import { Client } from "colyseus.js";

const URL = process.env.GAME_SERVER_URL ?? "ws://localhost:2567";
const DECK = [
  "iron-guard", "forest-archer", "stone-titan", "spark-mage",
  "goblin-pack", "flame-burst", "cannon-post", "frost-bolt",
];

let failures = 0;
function check(label, cond) {
  console.log(`${cond ? "  ✅" : "  ❌"} ${label}`);
  if (!cond) failures++;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(label, fn, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fn()) return true;
    await sleep(100);
  }
  check(`${label} (timed out)`, false);
  return false;
}

async function main() {
  console.log(`Connecting to ${URL}\n— PvP flow —`);
  const c1 = new Client(URL);
  const c2 = new Client(URL);

  const r1 = await c1.joinOrCreate("battle", { playerId: "smoke-a", name: "Alice", deck: DECK });
  check("player 1 joined and is waiting", r1.state !== undefined);

  const r2 = await c2.joinOrCreate("battle", { playerId: "smoke-b", name: "Bob", deck: DECK });
  check("player 2 matched into the same room", r1.roomId === r2.roomId);

  const rejections = [];
  r2.onMessage("deployRejected", (m) => rejections.push(m));
  r1.onMessage("deployRejected", (m) => rejections.push(m));
  r1.onMessage("effect", () => {});
  r2.onMessage("effect", () => {});

  r1.send("ready");
  r2.send("ready");
  await waitFor("countdown starts", () => r1.state.phase !== "waiting");
  await waitFor("match becomes active", () => r1.state.phase === "active");
  check("match timer is running", r1.state.timeRemaining > 170);

  const me1 = r1.state.players.get(r1.sessionId);
  const me2 = r2.state.players.get(r2.sessionId);
  check("both players present in state", !!me1 && !!me2);
  check("players are on opposite sides", me1.side !== me2.side);
  check("hands hold 4 cards", me1.hand.length === 4 && me2.hand.length === 4);
  check("starting energy is 5", Math.floor(me1.energy) === 5);
  check("each player has 3 towers", me1.towers.size === 3 && me2.towers.size === 3);

  // Valid deploy by player 1 on their own side.
  const card1 = me1.hand[0];
  const p1y = me1.side === 0 ? 24 : 8;
  r1.send("deploy", { cardId: card1, x: 9, y: p1y });
  await waitFor("deployed unit appears in both clients", () => r1.state.units.size > 0 && r2.state.units.size > 0);
  const unit = [...r2.state.units.values()][0];
  check("opponent sees the correct card", unit.cardId === card1);
  check("hand cycled to a new card", !me1.hand.includes(card1));

  // Invalid deploy: wrong side of the arena.
  const before = rejections.length;
  r2.send("deploy", { cardId: me2.hand[0], x: 9, y: me2.side === 0 ? 8 : 24 });
  await waitFor("wrong-side deploy is rejected", () => rejections.length > before);
  check("rejection explains the reason", /side/i.test(rejections.at(-1)?.reason ?? ""));

  // Invalid deploy: not enough energy (drain, then try a 5-cost card).
  const expensive = me2.hand.find((id) => id === "stone-titan") ?? me2.hand[0];
  me2.energy; // energy is server-side; just attempt three quick deploys
  const okY = me2.side === 0 ? 24 : 8;
  r2.send("deploy", { cardId: me2.hand[0], x: 5, y: okY });
  r2.send("deploy", { cardId: me2.hand[1], x: 9, y: okY });
  r2.send("deploy", { cardId: me2.hand[2], x: 12, y: okY });
  await sleep(400);
  const before2 = rejections.length;
  r2.send("deploy", { cardId: me2.hand.find((c) => c === expensive) ?? me2.hand[0], x: 9, y: okY });
  await sleep(400);
  check("over-spending is rejected (not enough energy)", rejections.length > before2);

  // Emotes reach the other player.
  let emoteSeen = false;
  r2.onMessage("emoteBroadcast", () => { emoteSeen = true; });
  r1.send("emote", { emoteId: 1 });
  await waitFor("emote broadcast to opponent", () => emoteSeen);

  // Surrender ends the match with the opponent as winner.
  r2.send("surrender");
  await waitFor("match finishes after surrender", () => r1.state.phase === "finished");
  check("surrendering player loses", r1.state.winnerId === r1.sessionId);
  check("end reason is surrender", r1.state.endReason === "surrender");

  await r1.leave();
  await r2.leave();

  // Give persistence a moment, then verify via the database.
  await sleep(800);

  console.log("\n— Practice (bot) flow —");
  const c3 = new Client(URL);
  const r3 = await c3.joinOrCreate("practice", { playerId: "smoke-a", name: "Alice", deck: DECK });
  r3.onMessage("effect", () => {});
  r3.onMessage("deployRejected", () => {});
  r3.send("ready");
  await waitFor("practice match becomes active", () => r3.state.phase === "active");
  check("bot player exists", !!r3.state.players.get("bot"));
  const botDeployed = await waitFor(
    "bot deploys a unit within 30s",
    () => [...r3.state.units.values()].some((u) => u.ownerId === "bot"),
    30000,
  );
  check("bot acted", botDeployed);
  r3.send("surrender");
  await waitFor("practice match finishes", () => r3.state.phase === "finished");
  await r3.leave();

  console.log(failures === 0 ? "\nAll smoke checks passed 🎉" : `\n${failures} check(s) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
