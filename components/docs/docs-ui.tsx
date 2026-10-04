import Link from "next/link";
import { CopyButton } from "@/components/ui/copy-button";
import { type Block, DOC_GROUPS, DOCS } from "@/lib/docs/content";
import { cn } from "@/lib/utils";

const EXTRA: Record<string, { href: string; title: string }[]> = { Developers: [{ href: "/docs/api", title: "API reference" }] };

export function DocsNav({ active }: { active: string }) {
  return (
    <nav aria-label="Documentation" className="text-small">
      {DOC_GROUPS.map((g) => (
        <div key={g} className="mb-6">
          <div className="eyebrow mb-2">{g}</div>
          <ul className="space-y-1 border-l border-hairline">
            {[...DOCS.filter((d) => d.group === g).map((d) => ({ href: `/docs/${d.slug}`, title: d.title })), ...(EXTRA[g] ?? [])].map((l) => (
              <li key={l.href}>
                <Link href={l.href} aria-current={active === l.href ? "page" : undefined} className={cn("-ml-px block border-l py-1 pl-3 transition-colors duration-150", active === l.href ? "border-navy-900 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-900")}>
                  {l.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function CodeBlock({ code, lang, title }: { code: string; lang: string; title?: string }) {
  return (
    <figure className="my-6 overflow-hidden rounded-md border border-hairline bg-surface">
      <figcaption className="flex items-center justify-between border-b border-hairline px-4 py-2">
        <span className="num text-[12px] text-ink-500">{title ?? lang}</span>
        <CopyButton value={code} label="Copy code" className="text-[12px]" />
      </figcaption>
      <pre className="num overflow-x-auto bg-navy-50 p-4 text-[13px] leading-relaxed text-ink-900">
        <code>{code}</code>
      </pre>
    </figure>
  );
}

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        if ("p" in b) return <p key={i} className="my-4 max-w-[70ch] text-body leading-relaxed text-ink-700">{b.p}</p>;
        if ("h" in b) return <h2 key={i} className="mt-10 mb-2 font-display text-[24px] text-navy-900">{b.h}</h2>;
        if ("list" in b)
          return (
            <ul key={i} className="my-4 max-w-[70ch] space-y-2">
              {b.list.map((x) => (
                <li key={x} className="flex gap-3 text-body text-ink-700">
                  <span className="mt-2.5 size-1 shrink-0 rounded-full bg-navy-700" aria-hidden />
                  {x}
                </li>
              ))}
            </ul>
          );
        if ("steps" in b)
          return (
            <ol key={i} className="my-6 max-w-[70ch] space-y-5">
              {b.steps.map((s, n) => (
                <li key={s.title} className="grid grid-cols-[32px_1fr] gap-3">
                  <span className="num flex size-7 items-center justify-center rounded-full border border-hairline text-[12px] text-ink-700">{n + 1}</span>
                  <div>
                    <div className="text-ui font-medium text-ink-900">{s.title}</div>
                    <p className="mt-1 text-small leading-relaxed text-ink-700">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          );
        if ("code" in b) return <CodeBlock key={i} code={b.code} lang={b.lang} title={b.title} />;
        if ("table" in b)
          return (
            <div key={i} className="my-6 overflow-x-auto rounded-md border border-hairline bg-surface">
              <table className="w-full min-w-[520px] text-small">
                <thead className="border-b border-hairline text-left">
                  <tr className="eyebrow">
                    {b.table.head.map((h) => (
                      <th key={h} className="px-4 py-3 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {b.table.rows.map((r) => (
                    <tr key={r.join("|")}>
                      {r.map((c, j) => (
                        <td key={j} className={cn("px-4 py-3 align-top", j === 0 ? "text-ink-900" : "text-ink-700")}>
                          {c}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        return (
          <div key={i} className={cn("my-6 max-w-[70ch] border-l-2 bg-surface px-4 py-3 text-small text-ink-900", b.tone === "warning" ? "border-l-warning" : "border-l-navy-700")}>
            {b.note}
          </div>
        );
      })}
    </>
  );
}
