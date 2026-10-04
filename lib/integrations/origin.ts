/** The site's public origin: NEXT_PUBLIC_APP_URL when set, otherwise the request's own origin. */
export function appOrigin(req: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}
