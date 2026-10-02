import { Assistant } from "@/components/composites/assistant";
import { requireRole } from "@/lib/auth";
import { requireFeature } from "@/lib/features";

export const metadata = { title: "Assistant" };
export const dynamic = "force-dynamic";

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireRole(["tenant_admin", "analyst", "client"]);
  await requireFeature(user, "assistant");
  const { q } = await searchParams;
  return <Assistant initialQuery={q} />;
}
