"use client";

import { useTranslations } from "next-intl";
import { navKey } from "@/lib/i18n/config";

/** Translates an English navigation label; labels without a translation are shown as written. */
export function useNavLabel() {
  const t = useTranslations("nav");
  return (label: string) => {
    const k = navKey(label);
    return t.has(k) ? t(k) : label;
  };
}
