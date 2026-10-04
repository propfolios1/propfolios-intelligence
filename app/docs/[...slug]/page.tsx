import Link from "next/link";
import { notFound } from "next/navigation";
import { Blocks, DocsNav } from "@/components/docs/docs-ui";
import { docBySlug, DOCS } from "@/lib/docs/content";

export function generateStaticParams() {
  return DOCS.map((d) => ({ slug: d.slug.split("/") }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }) {
  const d = docBySlug((await params).slug.join("/"));
  return d ? { title: d.title, description: d.summary } : { title: "Documentation" };
}

export default async function DocPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const slug = (await params).slug.join("/");
  const d = docBySlug(slug);
  if (!d) notFound();
  const i = DOCS.indexOf(d);
  const prev = DOCS[i - 1];
  const next = DOCS[i + 1];
  return (
    <div className="grid gap-12 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <div className="sticky top-24">
          <DocsNav active={`/docs/${d.slug}`} />
        </div>
      </aside>
      <main className="min-w-0">
        <nav aria-label="Breadcrumb" className="text-small text-ink-500">
          <Link href="/docs" className="hover:text-ink-900">
            Documentation
          </Link>
          <span className="mx-2">/</span>
          {d.group}
        </nav>
        <h1 className="mt-4 font-display text-[40px] leading-[1.1] text-navy-900">{d.title}</h1>
        <p className="mt-3 max-w-[64ch] text-read text-ink-500">{d.summary}</p>
        <div className="mt-8 border-t border-hairline pt-4">
          <Blocks blocks={d.blocks} />
        </div>
        <div className="mt-16 grid gap-4 border-t border-hairline pt-6 sm:grid-cols-2">
          {prev ? (
            <Link href={`/docs/${prev.slug}`} className="rounded-md border border-hairline bg-surface p-4 transition-colors duration-150 hover:border-ink-400">
              <span className="eyebrow">Previous</span>
              <span className="mt-1 block text-ui text-ink-900">{prev.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={`/docs/${next.slug}`} className="rounded-md border border-hairline bg-surface p-4 text-right transition-colors duration-150 hover:border-ink-400">
              <span className="eyebrow">Next</span>
              <span className="mt-1 block text-ui text-ink-900">{next.title}</span>
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
