import { Assistant } from "@/components/composites/assistant";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "Assistant" };
export const dynamic = "force-dynamic";

export default async function AnalystAssistantPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireRole(["admin", "analyst"]);
  const { q } = await searchParams;
  return <Assistant staff initialQuery={q} />;
}
