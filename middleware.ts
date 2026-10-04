import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

const isPublic = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/pricing",
  "/trial",
  "/api/trial",
  "/api/webhooks(.*)",
  "/api/branding(.*)",
  "/share(.*)",
  "/sign/(.*)",
  "/api/sign/(.*)",
  "/demo",
  "/api/demo/underwrite",
  "/api/access-request",
  "/api/presence",
  "/api/leads/inbound/(.*)",
  "/api/feeds/(.*)",
  "/api/mcp(.*)",
  "/api/setup",
  "/api/migrate/rename-demo-tenants",
  "/api/locale",
  "/api/cron(.*)",
  "/api/jobs/(.*)",
  "/api/portal-sandbox/(.*)",
  "/sites(.*)",
  "/api/sites/(.*)",
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
 * Brokerage websites: firm.nakhla.site, and verified custom domains, are
 * served from /sites/<slug>. Custom domains are resolved through
 * /api/sites/resolve and cached for five minutes per instance. The app's own
 * hosts and app paths are never rewritten.
 */
const SITE_CACHE = new Map<string, { slug: string | null; until: number }>();
const APP_PATHS = /^\/(api|_next|analyst|admin|client|platform|sign-in|sign-up|onboarding|trial|sites|notifications|share|sign|home|demo|pricing)(\/|$)/;

async function siteRewrite(req: NextRequest): Promise<NextResponse | null> {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").toLowerCase().split(":")[0]!;
  const appHost = process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL).hostname : null;
  if (!host || host === appHost || host === "localhost" || host === "127.0.0.1" || host.endsWith(".vercel.app")) return null;
  const path = req.nextUrl.pathname;
  if (APP_PATHS.test(path)) return null;
  const sitesDomain = process.env.NAKHLA_SITES_DOMAIN || "nakhla.site";
  let slug: string | null = null;
  if (host.endsWith(`.${sitesDomain}`)) slug = host.slice(0, -(sitesDomain.length + 1));
  else {
    const hit = SITE_CACHE.get(host);
    if (hit && hit.until > Date.now()) slug = hit.slug;
    else {
      try {
        const r = await fetch(`${req.nextUrl.origin}/api/sites/resolve?host=${encodeURIComponent(host)}`);
        slug = r.ok ? ((await r.json()) as { slug: string | null }).slug : null;
      } catch {
        slug = null;
      }
      SITE_CACHE.set(host, { slug, until: Date.now() + 5 * 60_000 });
    }
  }
  if (!slug || slug === "www" || slug === "sites") return null;
  const url = req.nextUrl.clone();
  url.pathname = `/sites/${slug}${path === "/" ? "" : path}`;
  return NextResponse.rewrite(url);
}

/**
 * With Clerk configured, every non-public route requires a session; the
 * tenant is then resolved from the Clerk organisation on each request
 * (lib/auth.ts). Without Clerk the app runs in open demonstration mode.
 */
export default async function middleware(req: NextRequest, ev: NextFetchEvent) {
  const site = await siteRewrite(req);
  if (site) return site;
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY) return withClerk(req, ev);
  return withPath(req);
}

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};
