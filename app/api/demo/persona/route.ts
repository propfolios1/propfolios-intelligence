import { NextResponse } from "next/server";
import { clerkEnabled, IMPERSONATE_COOKIE, PERSONA_COOKIE, PERSONAS, PREVIEW_CLIENT_COOKIE, USER_COOKIE } from "@/lib/auth";

const COOKIE = { path: "/", sameSite: "lax" as const, maxAge: 60 * 60 * 24 * 30, httpOnly: true };

/**
 * Demonstration-mode identity switcher (disabled once Clerk is configured).
 * ?as=platform|admin|analyst|client picks a persona; ?user=<id> acts as a
 * specific user (used after onboarding a new tenant); ?client=<id> sets the
 * client previewed by staff in the client portal.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const as = url.searchParams.get("as");
  const user = url.searchParams.get("user");
  const client = url.searchParams.get("client");
  const fallback = as === "client" ? "/client/portfolio" : as === "platform" ? "/platform/dashboard" : "/analyst/dashboard";
  const to = url.searchParams.get("to") ?? (user ? "/home" : fallback);
  const res = NextResponse.redirect(new URL(to.startsWith("/") ? to : "/", url.origin));
  if (!clerkEnabled) {
    if (as && as in PERSONAS) {
      res.cookies.set(PERSONA_COOKIE, as, COOKIE);
      res.cookies.delete(USER_COOKIE);
      res.cookies.delete(IMPERSONATE_COOKIE);
    }
    if (user && /^[0-9a-f-]{36}$/i.test(user)) {
      res.cookies.set(USER_COOKIE, user, COOKIE);
      res.cookies.delete(IMPERSONATE_COOKIE);
    }
  }
  if (client) res.cookies.set(PREVIEW_CLIENT_COOKIE, client, COOKIE);
  return res;
}
