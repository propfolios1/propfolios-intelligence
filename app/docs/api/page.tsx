import Link from "next/link";
import { CodeBlock, DocsNav } from "@/components/docs/docs-ui";
import { openApiDocument } from "@/lib/docs/openapi";
import { cn } from "@/lib/utils";

export const metadata = { title: "API reference", description: "Every Nakhla API endpoint, generated from the OpenAPI 3.1 description." };

type Op = { operationId: string; tags: string[]; summary: string; description?: string; security?: Record<string, unknown>[]; parameters?: { name: string; in: string; required?: boolean; description?: string; schema?: { enum?: string[]; type?: string } }[]; requestBody?: { content: Record<string, { schema: unknown }> }; responses: Record<string, { description: string }> };
const METHOD_TONE: Record<string, string> = { get: "text-info", post: "text-success", put: "text-warning", patch: "text-warning", delete: "text-danger" };

export default function ApiReference() {
  const doc = openApiDocument();
  const ops: (Op & { method: string; path: string })[] = [];
  for (const [path, item] of Object.entries(doc.paths as Record<string, Record<string, unknown>>)) for (const [method, op] of Object.entries(item)) if (method !== "parameters") ops.push({ ...(op as Op), method, path });
  const tags = (doc.tags as { name: string; description: string }[]).map((t) => t.name);
  const schemas = doc.components.schemas as Record<string, unknown>;
  const resolve = (s: unknown): unknown => {
    const r = (s as { $ref?: string })?.$ref;
    return r ? schemas[r.split("/").pop()!] : s;
  };
  return (
    <div className="grid gap-12 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <div className="sticky top-24">
          <DocsNav active="/docs/api" />
        </div>
      </aside>
      <main className="min-w-0">
        <div className="eyebrow">Developers</div>
        <h1 className="mt-4 font-display text-[40px] leading-[1.1] text-navy-900">API reference</h1>
        <p className="mt-3 max-w-[64ch] text-read text-ink-700">
          {doc.info.description} Download the <a href="/api/openapi.json" className="text-navy-900 underline decoration-ink-200 underline-offset-4">OpenAPI 3.1 description</a> to generate a client. Authentication, scopes and limits are covered in <Link href="/docs/api/authentication" className="text-navy-900 underline decoration-ink-200 underline-offset-4">a separate guide</Link>.
        </p>
        <p className="num mt-2 text-small text-ink-500">Version {doc.info.version} · {ops.length} operations · {Object.keys(doc.webhooks).length} webhook events</p>
        {tags.map((tag) => (
          <section key={tag} className="mt-14">
            <h2 className="font-display text-[28px] text-navy-900">{tag}</h2>
            <div className="mt-4 divide-y divide-hairline rounded-md border border-hairline bg-surface">
              {ops
                .filter((o) => o.tags.includes(tag))
                .map((o) => {
                  const body = o.requestBody ? resolve(Object.values(o.requestBody.content)[0]!.schema) : null;
                  return (
                    <details key={o.operationId} id={o.operationId} className="group scroll-mt-8">
                      <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
                        <span className={cn("num w-14 text-[12px] font-medium uppercase", METHOD_TONE[o.method])}>{o.method}</span>
                        <code className="num min-w-0 flex-1 break-all text-ui text-ink-900">{o.path}</code>
                        <span className="text-small text-ink-500">{o.summary}</span>
                      </summary>
                      <div className="border-t border-hairline px-5 py-4">
                        {o.description && <p className="max-w-[70ch] text-small text-ink-700">{o.description}</p>}
                        <p className="mt-2 text-[12px] text-ink-500">Authentication: {o.security?.length ? Object.keys(o.security[0]!).map((k) => (k === "apiKey" ? "API key (Bearer nk_live_…)" : "SCIM token (Bearer nk_scim_…)")).join(", ") : "none"}</p>
                        {o.parameters?.length ? (
                          <dl className="mt-4 grid gap-2 text-small">
                            {o.parameters.map((p) => (
                              <div key={p.name} className="grid grid-cols-[160px_1fr] gap-3">
                                <dt>
                                  <code className="num text-ink-900">{p.name}</code> <span className="text-[11px] text-ink-400">{p.in}</span>
                                </dt>
                                <dd className="text-ink-700">{p.description ?? (p.schema?.enum ? `One of ${p.schema.enum.slice(0, 6).join(", ")}${p.schema.enum.length > 6 ? ` and ${p.schema.enum.length - 6} more` : ""}` : p.schema?.type)}</dd>
                              </div>
                            ))}
                          </dl>
                        ) : null}
                        {body ? <CodeBlock code={JSON.stringify(body, null, 2)} lang="json" title="Request body schema" /> : null}
                        <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-small">
                          {Object.entries(o.responses).map(([code, r]) => (
                            <div key={code} className="flex gap-2">
                              <dt className="num text-ink-900">{code}</dt>
                              <dd className="text-ink-500">{r.description}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    </details>
                  );
                })}
            </div>
          </section>
        ))}
        <section className="mt-14">
          <h2 className="font-display text-[28px] text-navy-900">Webhook events</h2>
          <div className="mt-4 divide-y divide-hairline rounded-md border border-hairline bg-surface">
            {Object.entries(doc.webhooks as Record<string, { post: { summary: string } }>).map(([e, w]) => (
              <div key={e} className="flex flex-wrap items-baseline gap-3 px-5 py-3">
                <code className="num w-56 text-ui text-ink-900">{e}</code>
                <span className="text-small text-ink-500">{w.post.summary}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-small text-ink-500">
            Payloads, signatures and retries: <Link href="/docs/webhooks" className="text-navy-900 underline decoration-ink-200 underline-offset-4">Webhooks</Link>.
          </p>
        </section>
      </main>
    </div>
  );
}
