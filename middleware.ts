import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

const isPublic = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/pricing",
  "/api/webhooks(.*)",
  "/api/branding(.*)",
  "/share(.*)",
  "/sign/(.*)",
  "/api/sign/(.*)",
  "/demo",
  "/api/demo/underwrite",
  "/api/mcp(.*)",
  "/api/setup",
  "/api/locale",
  "/api/cron(.*)",
  "/opengraph-image(.*)",
  "/icon(.*)",
]);

/** Forwards the pathname so server components can choose platform or tenant branding. */
function withPath(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-nakhla-path", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

const withClerk = clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) await auth.protect();
  return withPath(req);
});

/**
 * With Clerk configured, every non-public route requires a session; the
 * tenant is then resolved from the Clerk organisation on each request
 * (lib/auth.ts). Without Clerk the app runs in open demonstration mode.
 */
export default function middleware(req: NextRequest, ev: NextFetchEvent) {
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY) return withClerk(req, ev);
  return withPath(req);
}

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};
