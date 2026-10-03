import { EmptyState } from "@/components/composites/empty-state";
import { MessageThread } from "@/components/composites/message-thread";
import { PageHeader } from "@/components/composites/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { listMessages } from "@/lib/queries";

export const metadata = { title: "Messages" };
export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const user = await requireRole(["tenant_admin", "analyst", "client"]);
  if (!user.clientId) return <PageContainer><EmptyState glyph="documents" headline="No client record is linked to this account" note="Messages are kept against your client record. Ask your relationship manager to link your login." primary={{ label: "View portfolio", href: "/client/portfolio" }} secondary={{ label: "Account settings", href: "/client/settings" }} /></PageContainer>;
  const msgs = await listMessages(await getDb(), user, user.clientId);
  return (
    <PageContainer className="max-w-[960px]">
      <PageHeader eyebrow="Your advisory team" title="Messages" subtitle="Replies usually arrive within one business day. For urgent matters call your relationship manager." />
      <div className="mt-8">
        <MessageThread clientId={user.clientId} viewerIsClient={user.role === "client"} viewerName={user.name} initial={msgs.map((m) => ({ id: m.id, authorName: m.authorName, authorRole: m.authorRole, body: m.body, createdAt: m.createdAt.toISOString() }))} />
      </div>
    </PageContainer>
  );
}
