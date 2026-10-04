import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { Section } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { ConnectWhatsapp, Inbox, WhatsappSettingsForm } from "@/components/whatsapp/whatsapp";
import { WhatsappTabs } from "@/components/whatsapp/tabs";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { convDto, tplDto, whatsappView } from "@/lib/whatsapp/view";

export const metadata = { title: "WhatsApp" };
export const dynamic = "force-dynamic";

export default async function WhatsappPage() {
  const user = await requireRole(["tenant_admin"]);
  const v = await whatsappView(await getDb(), user.tenantId);
  const a = v.account;
  return (
    <PageContainer>
      <PageHeader eyebrow="Administration" title="WhatsApp" subtitle="One business number for the firm. Every conversation is linked to its lead; the assistant greets and qualifies, and an agent takes over with one click. Meta's 24-hour window and opt-outs are enforced on every send." actions={<ConnectWhatsapp connected={Boolean(a)} />} />
      <WhatsappTabs active="/admin/whatsapp" />
      {a ? (
        <>
          <section className="my-8 stat-row">
            <StatCard label="Number" value={a.phoneNumber} note={`${a.provider === "sandbox" ? "Nakhla sandbox, nothing is sent" : a.provider === "twilio" ? "Twilio" : "360dialog"}${a.status === "error" ? ", needs attention" : ""}`} />
            <StatCard label="Conversations" value={String(v.conversations.length)} note={`${v.conversations.filter((c) => c.unread > 0).length} unread`} />
            <StatCard label="With an agent" value={String(v.conversations.filter((c) => c.mode === "human").length)} note="Taken over from the assistant" />
            <StatCard label="Opted out" value={String(v.conversations.filter((c) => c.optedOutAt).length)} note="Excluded from marketing" />
          </section>
          <Inbox conversations={v.conversations.map(convDto)} templates={v.templates.map(tplDto)} sandbox={a.provider === "sandbox"} />
          <Section title="Settings">
            <div className="max-w-[760px] rounded-md border border-hairline bg-surface p-6">
              <WhatsappSettingsForm settings={a.settings} webhook={v.webhook!} />
            </div>
          </Section>
        </>
      ) : (
        <p className="mt-10 max-w-[64ch] text-ui text-ink-700">Connect a WhatsApp Business number through Twilio or 360dialog, or start on the Nakhla sandbox to set up templates, replies and the assistant before Meta approves the number.</p>
      )}
    </PageContainer>
  );
}
