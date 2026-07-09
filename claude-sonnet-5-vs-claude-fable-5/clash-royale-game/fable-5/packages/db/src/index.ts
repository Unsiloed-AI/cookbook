import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Shared Prisma client (singleton across hot reloads in dev). */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl:
      process.env.DATABASE_URL ??
      "postgresql://arcane:arcane@localhost:5432/arcane_towers",
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export * from "@prisma/client";
