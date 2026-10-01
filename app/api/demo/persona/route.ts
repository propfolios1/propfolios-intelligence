import { NextResponse } from "next/server";
import { clerkEnabled, PERSONA_COOKIE, PREVIEW_CLIENT_COOKIE } from "@/lib/auth";

/** Demo-mode workspace switcher. Disabled once Clerk is configured. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const as = url.searchParams.get("as") ?? "admin";
  const client = url.searchParams.get("client");
  const to = url.searchParams.get("to") ?? (as === "client" ? "/client/portfolio" : as === "admin" ? "/admin/users" : "/analyst/dashboard");
  const res = NextResponse.redirect(new URL(to.startsWith("/") ? to : "/", url.origin));
  if (!clerkEnabled && ["admin", "analyst", "client"].includes(as)) res.cookies.set(PERSONA_COOKIE, as, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  if (client) res.cookies.set(PREVIEW_CLIENT_COOKIE, client, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  return res;
}
