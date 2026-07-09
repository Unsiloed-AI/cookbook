import { STARTER_DECK_CARD_IDS } from "@arcane-towers/shared";
import { PrismaClient } from "../generated/client/index.js";

const prisma = new PrismaClient();

async function main() {
  const ember = await prisma.player.upsert({
    where: { id: "demo-ember" },
    update: {},
    create: {
      id: "demo-ember",
      username: "EmberKnight",
      trophies: 1120,
      wins: 4,
      losses: 2,
      draws: 0,
      deckCardIds: STARTER_DECK_CARD_IDS,
    },
  });

  const frost = await prisma.player.upsert({
    where: { id: "demo-frost" },
    update: {},
    create: {
      id: "demo-frost",
      username: "FrostWarden",
      trophies: 980,
      wins: 2,
      losses: 3,
      draws: 1,
      deckCardIds: STARTER_DECK_CARD_IDS,
    },
  });

  const existingMatch = await prisma.match.findFirst({
    where: { id: "demo-match-1" },
  });

  if (!existingMatch) {
    await prisma.match.create({
      data: {
        id: "demo-match-1",
        mode: "pvp",
        endReason: "towerDestroyed",
        durationSeconds: 143,
        participants: {
          create: [
            {
              playerId: ember.id,
              result: "win",
              trophyDelta: 28,
              towersDestroyed: 2,
              towersLost: 1,
              damageDealt: 4820,
              cardsPlayed: 11,
              energySpent: 47,
            },
            {
              playerId: frost.id,
              result: "loss",
              trophyDelta: -28,
              towersDestroyed: 1,
              towersLost: 2,
              damageDealt: 3910,
              cardsPlayed: 10,
              energySpent: 44,
            },
          ],
        },
      },
    });
  }

  console.log("Seed complete:", { ember: ember.username, frost: frost.username });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
