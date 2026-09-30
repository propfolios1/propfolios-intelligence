import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Instrument_Serif } from "next/font/google";
import { palette } from "@/lib/design/tokens";
import "./globals.css";

const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument", display: "swap" });

export const metadata: Metadata = {
  title: { default: "PropFolios Intelligence", template: "%s · PropFolios Intelligence" },
  description: "Research, underwriting and portfolio monitoring for private capital in UAE and India real estate.",
};

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const body = (
    <html lang="en" className={`${instrument.variable} ${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
  return clerkEnabled ? (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: palette.navy,
          colorText: palette.ink,
          colorTextSecondary: palette.ink2,
          colorBackground: palette.paper,
          colorInputBackground: palette.paper,
          colorInputText: palette.ink,
          colorDanger: palette.red,
          borderRadius: "4px",
          fontFamily: "var(--font-geist-sans)",
        },
      }}
    >
      {body}
    </ClerkProvider>
  ) : (
    body
  );
}
