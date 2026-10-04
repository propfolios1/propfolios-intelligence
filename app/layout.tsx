import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Playfair_Display } from "next/font/google";
import { TenantProvider } from "@/components/tenant-provider";
import { brandStyle, resolveBrand } from "@/lib/brand";
import { palette } from "@/lib/design/tokens";
import { Providers } from "@/components/providers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { RTL, type Locale } from "@/lib/i18n/config";
import "./globals.css";

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["400", "500", "600"], style: ["normal", "italic"], variable: "--font-playfair", display: "swap" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-inter", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["400"], variable: "--font-jetbrains", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const brand = await resolveBrand();
  const name = brand.config.brand_name;
  const description = brand.config.platform
    ? "Nakhla is the AI-native operating system for real estate brokerages: leads, listings, research, underwriting, deals, commissions and client servicing across six markets."
    : `Research, underwriting and portfolio monitoring for private capital, by ${brand.name}.`;
  return {
    title: { default: name, template: `%s · ${name}` },
    description,
    openGraph: { title: name, description, siteName: name, type: "website" },
    twitter: { card: "summary_large_image", title: name, description },
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  };
}

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [brand, locale, messages] = await Promise.all([resolveBrand(), getLocale(), getMessages()]);
  const body = (
    <html lang={locale} dir={RTL.has(locale as Locale) ? "rtl" : "ltr"} className={`${playfair.variable} ${inter.variable} ${jetbrains.variable}`} style={brandStyle(brand)}>
      <body>
        <TenantProvider brand={brand}>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <Providers clerk={clerkEnabled}>{children}</Providers>
          </NextIntlClientProvider>
        </TenantProvider>
      </body>
    </html>
  );
  return clerkEnabled ? (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: palette.navy900,
          colorText: palette.ink900,
          colorTextSecondary: palette.ink500,
          colorBackground: palette.surface,
          colorInputBackground: palette.surface,
          colorInputText: palette.ink900,
          colorDanger: palette.danger,
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
