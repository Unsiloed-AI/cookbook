import { CARDS } from "@arcane/shared";
import { prisma } from "./index";

/** Bot opponent used by Practice mode — a real Player row so matches persist. */
export const BOT_PLAYER_ID = "bot-trainer";

async function main() {
  for (const card of CARDS) {
    const data = {
      name: card.name,
      type: card.type,
      cost: card.cost,
      rarity: card.rarity,
      description: card.description,
      stats: JSON.parse(JSON.stringify(card.unit ?? card.spell ?? {})),
    };
    await prisma.card.upsert({
      where: { id: card.id },
      update: data,
      create: { id: card.id, ...data },
    });
  }

  await prisma.player.upsert({
    where: { id: BOT_PLAYER_ID },
    update: {},
    create: { id: BOT_PLAYER_ID, name: "Training Golem", isBot: true },
  });

  console.log(`Seeded ${CARDS.length} cards and the practice bot.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
