import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, LOCALES, type Locale } from "@/lib/i18n/config";

/** No locale in the URL: the choice lives in a cookie, falling back to the browser's Accept-Language, then English. */
async function resolveLocale(): Promise<Locale> {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;
  const accept = (await headers()).get("accept-language") ?? "";
  const preferred = accept
    .split(",")
    .map((p) => p.split(";")[0]!.trim().toLowerCase().split("-")[0]!)
    .find((l) => (LOCALES as readonly string[]).includes(l));
  return isLocale(preferred) ? preferred : DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return { locale, timeZone: "Asia/Dubai", messages: (await import(`../messages/${locale}.json`)).default };
});
