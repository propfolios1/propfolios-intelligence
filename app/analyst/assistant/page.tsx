import { Assistant } from "@/components/composites/assistant";
import { requireRole } from "@/lib/auth";
import { requireFeature } from "@/lib/features";

export const metadata = { title: "Assistant" };
export const dynamic = "force-dynamic";

export default async function AnalystAssistantPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireRole(["tenant_admin", "analyst"]);
  await requireFeature(user, "assistant");
  const { q } = await searchParams;
  return <Assistant staff initialQuery={q} />;
}
