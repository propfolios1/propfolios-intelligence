import { Assistant } from "@/components/composites/assistant";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "Assistant" };
export const dynamic = "force-dynamic";

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireRole(["tenant_admin", "analyst", "client"]);
  const { q } = await searchParams;
  return <Assistant initialQuery={q} />;
}
