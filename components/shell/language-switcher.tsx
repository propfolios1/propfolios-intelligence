"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { LOCALE_NAME, LOCALES, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

/** Interface language. The choice is kept in a cookie and the page re-renders on the server in that language. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("shell");
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <label className={cn("flex items-center gap-2 text-small text-ink-500", className)}>
      <span className="shrink-0">{t("language")}</span>
      <select
        value={locale}
        disabled={pending}
        aria-label={t("language")}
        className="h-8 min-w-0 flex-1 rounded-sm border border-hairline bg-surface px-2 text-small text-ink-900 transition-[border-color] duration-150 hover:border-ink-400 focus-visible:outline-2 focus-visible:outline-navy-700 disabled:opacity-60"
        onChange={async (e) => {
          await fetch("/api/locale", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ locale: e.target.value }) });
          start(() => router.refresh());
        }}
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={l}>
            {LOCALE_NAME[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
