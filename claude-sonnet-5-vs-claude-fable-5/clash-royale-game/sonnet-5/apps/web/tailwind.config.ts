import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        arcane: {
          bg: "#0b0f1f",
          panel: "#131a2e",
          panel2: "#1b2440",
          border: "#2a3557",
          accent: "#8b5cf6",
          accent2: "#22d3ee",
          gold: "#fbbf24",
          danger: "#f43f5e",
          success: "#34d399",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 24px rgba(139, 92, 246, 0.45)",
        "glow-cyan": "0 0 24px rgba(34, 211, 238, 0.4)",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        shimmer: "shimmer 2.5s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
