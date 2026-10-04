/** RFC 9116 security contact. */
export function GET() {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.nakhla.ai").replace(/\/$/, "");
  const expires = new Date(Date.UTC(new Date().getUTCFullYear() + 1, 0, 1)).toISOString();
  const body = [`Contact: mailto:security@nakhla.ai`, `Expires: ${expires}`, `Preferred-Languages: en, ar`, `Policy: ${base}/security#disclosure`, `Canonical: ${base}/.well-known/security.txt`, ""].join("\n");
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" } });
}
