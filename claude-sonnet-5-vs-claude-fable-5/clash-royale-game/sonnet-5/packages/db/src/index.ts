import { PrismaClient } from "../generated/client/index.js";

declare global {
  // eslint-disable-next-line no-var
  var __arcaneTowersPrisma: PrismaClient | undefined;
}

export const prisma = globalThis.__arcaneTowersPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__arcaneTowersPrisma = prisma;
}

export * from "../generated/client/index.js";
