import { desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { ApiKeysManager } from "@/components/admin/api-keys";
import { PageHeader } from "@/components/composites/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { getDb, dbKind } from "@/db";
import * as s from "@/db/schema";
import { isAiConfigured, MODELS } from "@/lib/ai/client";
import { clerkEnabled, requireRole } from "@/lib/auth";
import { TOOL_NAMES, MCP_TOOLS } from "@/lib/mcp/tools";
import { supabaseConfigured } from "@/lib/supabase/server";

export const metadata = { title: "Integrations" };
export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const user = await requireRole(["tenant_admin"]);
  const db = await getDb();
  const keys = await db.select().from(s.apiKeys).where(eq(s.apiKeys.tenantId, user.tenantId)).orderBy(desc(s.apiKeys.createdAt));
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_APP_URL || `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const kind = dbKind();
  const rows = [
    ["Anthropic", `Agents: ${MODELS.deep}, ${MODELS.primary} and ${MODELS.fast}`, "ANTHROPIC_API_KEY", isAiConfigured()],
    ["Clerk", "Sign-in, organisations and roles", "CLERK_SECRET_KEY", clerkEnabled],
    ["Supabase Postgres", "Database with pgvector and row-level security", "DATABASE_URL", kind !== "embedded"],
    ["Supabase Storage", "Private buckets: documents, memos, branding, avatars", "SUPABASE_SERVICE_ROLE_KEY", supabaseConfigured()],
    ["Supabase Realtime", "Live portfolios, insights, actions and market data", "NEXT_PUBLIC_SUPABASE_ANON_KEY", Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)],
    ["Upstash Redis", "Shared rate limiting", "KV_REST_API_URL", Boolean(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL)],
    ["Mapbox", "Property map tiles", "NEXT_PUBLIC_MAPBOX_TOKEN", Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN)],
  ] as const;
  return (
    <PageContainer className="pt-10 md:pt-12">
      <PageHeader title="Integrations" subtitle={`${rows.filter((r) => r[3]).length} of ${rows.length} services connected. Connections are set by the platform operator in Vercel.`} />
      <div className="mt-8 overflow-x-auto">
      <table className="w-full min-w-[600px] border-separate border-spacing-0">
        <thead>
          <tr>
            {["Service", "Used for", "Variable", "Status"].map((x) => (
              <th key={x} className="eyebrow h-10 border-b border-hairline px-4 text-left font-medium first:pl-0">
                {x}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, purpose, env, ok]) => (
            <tr key={name} className="h-14 transition-[background-color] duration-120 hover:bg-ink-100">
              <td className="border-b border-hairline text-ui text-ink-900">{name}</td>
              <td className="border-b border-hairline px-4 text-ui text-ink-700">{purpose}</td>
              <td className="num border-b border-hairline px-4 text-small text-ink-700">{env}</td>
              <td className="border-b border-hairline px-4">{ok ? <StatusPill tone="complete">Connected</StatusPill> : <StatusPill>Not set</StatusPill>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader eyebrow="Layer 7 · Model Context Protocol" title="API keys" />
          <CardContent>
            <p className="mb-5 max-w-[72ch] text-small text-ink-700">Keys let external systems (an AI assistant, a reporting tool, your CRM) use Nakhla&apos;s tools inside your workspace. Each call is rate limited and written to the audit log.</p>
            <ApiKeysManager keys={keys.map((k) => ({ id: k.id, name: k.name, prefix: k.prefix, createdBy: k.createdBy, lastUsedAt: k.lastUsedAt?.toISOString() ?? null, revokedAt: k.revokedAt?.toISOString() ?? null, createdAt: k.createdAt.toISOString() }))} />
          </CardContent>
        </Card>
        <Card className="xl:col-span-5">
          <CardHeader eyebrow="Connect" title="MCP server" />
          <CardContent className="space-y-4 text-small text-ink-700">
            <div>
              <div className="eyebrow mb-1">Endpoint (Streamable HTTP)</div>
              <code className="num block rounded-sm bg-ink-100 px-3 py-2 text-ink-900">{origin}/api/mcp</code>
            </div>
            <div>
              <div className="eyebrow mb-1">Header</div>
              <code className="num block rounded-sm bg-ink-100 px-3 py-2 text-ink-900">Authorization: Bearer nk_live_…</code>
            </div>
            <div>
              <div className="eyebrow mb-1">Tools</div>
              <ul className="divide-y divide-hairline border-y border-hairline">
                {TOOL_NAMES.map((t) => (
                  <li key={t} className="py-2">
                    <code className="num text-ink-900">{t}</code>
                    <div className="text-ink-500">{MCP_TOOLS[t].description}</div>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-ink-500">
              Each tool is also available as REST: <code className="num">POST {origin}/api/mcp/&lt;tool&gt;</code> with the arguments as JSON.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
