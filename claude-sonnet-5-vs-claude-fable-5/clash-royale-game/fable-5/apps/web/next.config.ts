import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@arcane/shared", "@arcane/db"],
  serverExternalPackages: ["@prisma/client"],
  // Double-invoked effects would open two Colyseus connections per battle.
  reactStrictMode: false,
};

export default nextConfig;
