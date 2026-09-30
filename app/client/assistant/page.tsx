import { Assistant } from "@/components/composites/assistant";

export const metadata = { title: "Ask" };

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return <Assistant initialQuery={q} />;
}
