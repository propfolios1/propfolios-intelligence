/** The block structure of a rendered contract (headings, paragraphs, ordered lists), for the PDF renderer. */
export type Block = { tag: "h2" | "h3" | "p"; html: string } | { tag: "ol"; items: string[] };

export function blocks(html: string): Block[] {
  const out: Block[] = [];
  for (const m of html.matchAll(/<(h2|h3|p|ol)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g)) {
    const tag = m[1] as Block["tag"];
    if (tag === "ol") out.push({ tag: "ol", items: [...m[2]!.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((x) => x[1]!) });
    else out.push({ tag, html: m[2]! });
  }
  return out;
}
