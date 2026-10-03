import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, parseBody } from "@/lib/api";
import { LOCALE_COOKIE, LOCALES } from "@/lib/i18n/config";

/** Sets the interface language for this browser (a year-long cookie). Public: the language applies before sign-in too. */
export const POST = handle(async (req: Request) => {
  const { locale } = await parseBody(req, z.object({ locale: z.enum(LOCALES) }));
  const res = NextResponse.json({ locale });
  res.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return res;
});
