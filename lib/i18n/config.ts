export const LOCALES = ["en", "ar", "hi", "mr", "kok"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Each language named in its own script, as a picker should show it. */
export const LOCALE_NAME: Record<Locale, string> = { en: "English", ar: "العربية", hi: "हिन्दी", mr: "मराठी", kok: "कोंकणी" };
export const RTL: ReadonlySet<Locale> = new Set(["ar"]);

export const isLocale = (v: string | undefined | null): v is Locale => !!v && (LOCALES as readonly string[]).includes(v);

/** Message key for an English navigation label ("KYC and AML" → "kyc_and_aml"). */
export const navKey = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
