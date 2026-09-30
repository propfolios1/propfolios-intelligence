import { Assistant } from "@/components/assistant";

export const metadata = { title: "Assistant" };

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return <Assistant initialQuery={q} />;
}
