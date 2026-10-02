import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/composites/page-header";
import { SettingsForm } from "@/components/composites/settings-form";
import { PageContainer } from "@/components/shell/page-container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { isAiConfigured, MODELS } from "@/lib/ai/client";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const db = await getDb();
  const [row] = await db.select().from(s.users).where(eq(s.users.id, user.id));
  const live = isAiConfigured();
  return (
    <PageContainer>
      <PageHeader eyebrow="Account" title="Settings" />
      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <SettingsForm name={user.name} email={user.email} role={user.role} title={user.title} preferences={row?.preferences ?? null} />
        </div>
        <Card className="xl:col-span-4">
          <CardHeader eyebrow="Agents" title="Model configuration" actions={<StatusPill tone={live ? "complete" : "progress"}>{live ? "Live" : "Replay mode"}</StatusPill>} />
          <CardContent className="text-small text-ink-700">
            <dl className="grid grid-cols-2 gap-y-2">
              <dt className="text-ink-500">Pipeline agents</dt>
              <dd className="num text-right">{MODELS.primary}</dd>
              <dt className="text-ink-500">Fast agents</dt>
              <dd className="num text-right">{MODELS.fast}</dd>
            </dl>
            <p className="mt-4">{live ? "Agents call the Anthropic API. Costs are recorded per run in the audit log." : "No Anthropic key is configured. Agents produce deterministic replay output from the same inputs so every flow can be demonstrated. Add ANTHROPIC_API_KEY in Vercel to go live."}</p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
