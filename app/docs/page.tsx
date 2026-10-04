import Link from "next/link";
import { DocsNav } from "@/components/docs/docs-ui";
import { DOC_GROUPS, DOCS } from "@/lib/docs/content";

export const metadata = { title: "Documentation", description: "Guides for running a brokerage on Nakhla: getting started, CRM migration, portals, the API, MCP, webhooks and compliance." };

export default function DocsIndex() {
  return (
    <div className="grid gap-12 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <div className="sticky top-24">
          <DocsNav active="/docs" />
        </div>
      </aside>
      <main>
        <div className="eyebrow">Documentation</div>
        <h1 className="mt-4 font-display text-[40px] leading-[1.1] text-navy-900">Run your brokerage on Nakhla</h1>
        <p className="mt-4 max-w-[64ch] text-read text-ink-700">Set up the workspace, bring your data across, connect the portals, and build on the API, MCP server and webhooks. Compliance guides cover each jurisdiction Nakhla supports.</p>
        <div className="mt-12 grid gap-px overflow-hidden rounded-md border border-hairline bg-hairline md:grid-cols-2 xl:grid-cols-3">
          {DOC_GROUPS.map((g) => (
            <section key={g} className="bg-surface p-6">
              <h2 className="eyebrow">{g}</h2>
              <ul className="mt-4 space-y-4">
                {DOCS.filter((d) => d.group === g).map((d) => (
                  <li key={d.slug}>
                    <Link href={`/docs/${d.slug}`} className="group block">
                      <span className="text-ui font-medium text-ink-900 group-hover:text-navy-700">{d.title}</span>
                      <span className="mt-1 block text-small text-ink-500">{d.summary}</span>
                    </Link>
                  </li>
                ))}
                {g === "Developers" && (
                  <li>
                    <Link href="/docs/api" className="group block">
                      <span className="text-ui font-medium text-ink-900 group-hover:text-navy-700">API reference</span>
                      <span className="mt-1 block text-small text-ink-500">Every endpoint, generated from the OpenAPI 3.1 description.</span>
                    </Link>
                  </li>
                )}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
