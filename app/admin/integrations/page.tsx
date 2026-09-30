import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/page-header";
import { Pill } from "@/components/ui/pill";
import { isAiConfigured, MODEL } from "@/lib/ai/client";
import { clerkEnabled } from "@/lib/auth";

export const metadata = { title: "Integrations" };
export const dynamic = "force-dynamic";

export default function IntegrationsPage() {
  const rows = [
    { name: "Anthropic", purpose: `12 agents + client assistant · ${MODEL}`, ok: isAiConfigured(), env: "ANTHROPIC_API_KEY" },
    { name: "Clerk", purpose: "Authentication and roles", ok: clerkEnabled, env: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY" },
    { name: "Mapbox", purpose: "Property map tiles", ok: Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN), env: "NEXT_PUBLIC_MAPBOX_TOKEN" },
    { name: "Dubai Land Department", purpose: "Transaction feed (market-intel agent)", ok: false, env: "DLD_API_KEY" },
    { name: "Property Monitor", purpose: "Rental and yield data", ok: false, env: "PROPERTY_MONITOR_API_KEY" },
  ];
  return (
    <PageContainer dense>
      <PageHeader eyebrow="Admin" title="Integrations" />
      <div className="mt-8 overflow-hidden rounded-card border border-ink-200 bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-200">
              {["Service", "Purpose", "Environment", "Status"].map((h) => (
                <th key={h} className="eyebrow h-10 px-4 text-left font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-200">
            {rows.map((r) => (
              <tr key={r.name} className="h-11 hover:bg-ink-50">
                <td className="px-4 font-medium text-ink-900">{r.name}</td>
                <td className="px-4 text-ink-600">{r.purpose}</td>
                <td className="num px-4 text-xs text-ink-500">{r.env}</td>
                <td className="px-4">{r.ok ? <Pill tone="positive" dot>Connected</Pill> : <Pill tone="neutral" dot>Not configured</Pill>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}
