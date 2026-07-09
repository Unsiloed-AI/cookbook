import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arcane Towers",
  description:
    "A real-time 1v1 lane tower battle. Build your deck, master your energy, and bring down the enemy citadel.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
