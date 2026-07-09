import type { Metadata } from "next";
import { Cinzel, Inter } from "next/font/google";
import { IdentityProvider } from "@/components/IdentityProvider";
import "./globals.css";

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700", "900"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Arcane Towers",
  description: "A real-time 1v1 lane tower battle. Deploy cards, break towers, win the arena.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${inter.variable}`}>
      <body className="bg-noise min-h-screen bg-arcane-bg font-body text-slate-100 antialiased">
        <IdentityProvider>{children}</IdentityProvider>
      </body>
    </html>
  );
}
