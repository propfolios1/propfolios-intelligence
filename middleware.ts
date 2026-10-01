import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

const isPublic = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/api/setup",
  "/api/cron(.*)",
  "/opengraph-image(.*)",
  "/icon(.*)",
]);

const withClerk = clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) await auth.protect();
});

/** Clerk protects every non-public route when configured; otherwise the app runs in open demo mode. */
export default function middleware(req: NextRequest, ev: NextFetchEvent) {
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY) return withClerk(req, ev);
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};
