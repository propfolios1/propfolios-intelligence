import { PageHeader } from "@/components/composites/page-header";
import { Section, SimpleTable } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { StatusPill } from "@/components/ui/status-pill";
import { WhatsappTabs } from "@/components/whatsapp/tabs";
import { BroadcastForm } from "@/components/whatsapp/whatsapp";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { BROADCAST_SEGMENTS } from "@/lib/whatsapp/service";
import { tplDto, whatsappView } from "@/lib/whatsapp/view";

export const metadata = { title: "WhatsApp broadcasts" };
export const dynamic = "force-dynamic";

export default async function BroadcastsPage() {
  const user = await requireRole(["tenant_admin"]);
  const v = await whatsappView(await getDb(), user.tenantId);
  return (
    <PageContainer>
      <PageHeader eyebrow="WhatsApp" title="Broadcasts" subtitle="Approved templates to consented contacts, sent within the number's per-minute throttle by Supabase Cron. Anyone who replies STOP is removed at once, including from broadcasts still sending." />
      <WhatsappTabs active="/admin/whatsapp/broadcasts" />
      <div className="mt-8 max-w-[760px]">{v.account ? <BroadcastForm templates={v.templates.map(tplDto)} segments={BROADCAST_SEGMENTS} /> : <p className="text-ui text-ink-500">Connect WhatsApp first.</p>}</div>
      <Section title="Sent and sending">
        <SimpleTable
          rows={v.broadcasts}
          minWidth={900}
          empty="No broadcasts yet."
          columns={[
            { key: "n", header: "Broadcast", cell: (b) => b.name },
            { key: "s", header: "Status", cell: (b) => <StatusPill tone={b.status === "completed" ? "complete" : "progress"}>{b.status}</StatusPill> },
            { key: "a", header: "Audience", numeric: true, cell: (b) => b.totals.audience },
            { key: "x", header: "Excluded", numeric: true, cell: (b) => b.totals.excluded },
            { key: "q", header: "Queued", numeric: true, cell: (b) => b.totals.queued },
            { key: "d", header: "Delivered", numeric: true, cell: (b) => b.totals.delivered },
            { key: "r", header: "Read", numeric: true, cell: (b) => b.totals.read },
            { key: "f", header: "Failed", numeric: true, cell: (b) => b.totals.failed },
          ]}
        />
      </Section>
    </PageContainer>
  );
}
