/**
 * RFC 4180 CSV parsing: quoted fields, escaped quotes, embedded commas and
 * line breaks, CRLF or LF, a UTF-8 byte-order mark, and semicolon or tab
 * delimiters (detected from the header line, as Excel exports vary by locale).
 */
export function detectDelimiter(text: string): "," | ";" | "\t" {
  const line = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
  const counts = { ",": 0, ";": 0, "\t": 0 } as Record<"," | ";" | "\t", number>;
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch in counts) counts[ch as "," | ";" | "\t"]++;
  }
  const [best, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]!;
  return (n > 0 ? best : ",") as "," | ";" | "\t";
}

export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field === "") quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

/** Header row plus records keyed by header. Blank or duplicate headers get a positional name. */
export function csvRecords(text: string): { headers: string[]; records: Record<string, string>[] } {
  const [head, ...body] = parseCsv(text);
  if (!head) return { headers: [], records: [] };
  const seen = new Map<string, number>();
  const headers = head.map((h, i) => {
    const base = h.trim() || `Column ${i + 1}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n > 1 ? `${base} (${n})` : base;
  });
  const records = body.map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()])));
  return { headers, records };
}
