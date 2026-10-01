import { PageHeader } from "@/components/composites/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { PageContainer } from "@/components/shell/page-container";
import { isAiConfigured, MODEL } from "@/lib/ai/client";
import { clerkEnabled } from "@/lib/auth";

export const metadata = { title: "Integrations" };
export const dynamic = "force-dynamic";

export default function IntegrationsPage() {
  const rows = [
    ["Anthropic", `Agents and assistant, ${MODEL}`, "ANTHROPIC_API_KEY", isAiConfigured()],
    ["Clerk", "Authentication and roles", "CLERK_SECRET_KEY", clerkEnabled],
    ["Mapbox", "Property map tiles", "NEXT_PUBLIC_MAPBOX_TOKEN", Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN)],
    ["Dubai Land Department", "Transaction feed", "DLD_API_KEY", false],
    ["Property Monitor", "Rents and yields", "PROPERTY_MONITOR_API_KEY", false],
  ] as const;
  return (
    <PageContainer className="pt-10 md:pt-12">
      <PageHeader title="Integrations" subtitle={`${rows.filter((r) => r[3]).length} of ${rows.length} connected.`} />
      <table className="mt-8 w-full border-separate border-spacing-0">
        <thead>
          <tr>
            {["Service", "Used for", "Variable", "Status"].map((h) => (
              <th key={h} className="eyebrow h-10 border-b border-ink-200 px-4 text-left font-medium first:pl-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, purpose, env, ok]) => (
            <tr key={name} className="h-14 transition-[background-color] duration-120 hover:bg-ink-100">
              <td className="border-b border-ink-200 text-ui text-ink-900">{name}</td>
              <td className="border-b border-ink-200 px-4 text-ui text-ink-700">{purpose}</td>
              <td className="num border-b border-ink-200 px-4 text-small text-ink-700">{env}</td>
              <td className="border-b border-ink-200 px-4">{ok ? <StatusPill tone="complete">Connected</StatusPill> : <StatusPill>Not set</StatusPill>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PageContainer>
  );
}
