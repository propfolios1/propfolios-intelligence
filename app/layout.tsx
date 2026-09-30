import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-playfair", display: "swap" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-inter", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["400"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: { default: "PropFolios Intelligence", template: "%s · PropFolios Intelligence" },
  description: "AI-powered research, underwriting, and portfolio monitoring for HNW investors deploying into UAE and India real estate.",
};

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const body = (
    <html lang="en" className={`${playfair.variable} ${inter.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
  return clerkEnabled ? (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#0a1f44",
          colorText: "#15171b",
          colorTextSecondary: "#7c776f",
          colorBackground: "#ffffff",
          colorInputBackground: "#ffffff",
          colorInputText: "#15171b",
          borderRadius: "6px",
          fontFamily: "var(--font-inter)",
        },
      }}
    >
      {body}
    </ClerkProvider>
  ) : (
    body
  );
}
