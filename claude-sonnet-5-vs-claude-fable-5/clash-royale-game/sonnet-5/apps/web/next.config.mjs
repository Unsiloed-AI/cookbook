/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@arcane-towers/shared", "@arcane-towers/db"],
  webpack: (config) => {
    // packages/shared and packages/db use NodeNext-style relative imports
    // ("./types.js" pointing at "./types.ts") — webpack needs to be told to
    // fall back to .ts/.tsx when resolving a .js specifier.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
