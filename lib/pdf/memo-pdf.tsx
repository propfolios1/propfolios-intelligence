import "server-only";
import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";

/**
 * Allocation Memo PDF. Built-in Times (display) and Helvetica (text) keep the
 * renderer self-contained on serverless. Layout follows the print sheet:
 * A4, navy rule, gold mark, key metrics band, numbered pages.
 */

const NAVY = "#0A1F44";
const GOLD = "#A8894A";
const INK = "#0A0A0A";
const INK700 = "#374151";
const INK500 = "#6B7280";
const RULE = "#E5E7EB";

const st = StyleSheet.create({
  page: { paddingTop: 56, paddingBottom: 64, paddingHorizontal: 56, fontFamily: "Helvetica", fontSize: 10.5, color: INK, lineHeight: 1.55 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderBottomWidth: 1, borderBottomColor: NAVY, paddingBottom: 10, marginBottom: 24 },
  brand: { fontFamily: "Helvetica-Bold", fontSize: 9, letterSpacing: 2.4, color: NAVY },
  brandSub: { fontSize: 7, letterSpacing: 3, color: INK500, marginTop: 2 },
  confidential: { fontSize: 7.5, letterSpacing: 1.2, color: INK500 },
  eyebrow: { fontSize: 8, letterSpacing: 1.2, color: INK500, textTransform: "uppercase", marginBottom: 6 },
  title: { fontFamily: "Times-Roman", fontSize: 24, color: NAVY, lineHeight: 1.2, marginBottom: 8 },
  mark: { width: 32, height: 2, backgroundColor: GOLD, marginBottom: 14 },
  meta: { fontSize: 9, color: INK700, marginBottom: 20 },
  metrics: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, borderBottomWidth: 1, borderColor: RULE, paddingVertical: 10, marginBottom: 22 },
  metric: { width: "33.33%", paddingVertical: 6, paddingRight: 8 },
  metricLabel: { fontSize: 7.5, letterSpacing: 1, color: INK500, textTransform: "uppercase" },
  metricValue: { fontFamily: "Courier-Bold", fontSize: 13, color: INK, marginTop: 3 },
  h2: { fontFamily: "Times-Bold", fontSize: 14, color: NAVY, marginTop: 16, marginBottom: 6 },
  h3: { fontFamily: "Helvetica-Bold", fontSize: 10.5, color: INK, marginTop: 10, marginBottom: 4 },
  p: { marginBottom: 8, color: INK },
  li: { flexDirection: "row", marginBottom: 4, paddingLeft: 4 },
  bullet: { width: 14, color: GOLD },
  quote: { borderLeftWidth: 2, borderLeftColor: GOLD, paddingLeft: 10, marginVertical: 8, color: INK700, fontFamily: "Times-Italic", fontSize: 11 },
  footerRule: { position: "absolute", bottom: 48, left: 56, right: 56, height: 1, backgroundColor: RULE },
  footerLeft: { position: "absolute", bottom: 28, left: 56, fontSize: 7.5, color: INK500 },
  footerRight: { position: "absolute", bottom: 28, left: 56, right: 56, fontSize: 7.5, color: INK500, textAlign: "right" },
  approval: { marginTop: 24, borderTopWidth: 1, borderTopColor: RULE, paddingTop: 10, fontSize: 8.5, color: INK700 },
});

type Inline = { text: string; bold?: boolean; italic?: boolean };
type Block = { kind: "h2" | "h3" | "p" | "quote"; parts: Inline[] } | { kind: "list"; ordered: boolean; items: Inline[][] };

const decode = (t: string) =>
  t.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

function inline(html: string): Inline[] {
  const out: Inline[] = [];
  let bold = false;
  let italic = false;
  for (const token of html.split(/(<\/?(?:strong|b|em|i)>)/i)) {
    const t = token.toLowerCase();
    if (t === "<strong>" || t === "<b>") bold = true;
    else if (t === "</strong>" || t === "</b>") bold = false;
    else if (t === "<em>" || t === "<i>") italic = true;
    else if (t === "</em>" || t === "</i>") italic = false;
    else {
      const text = decode(token.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""));
      if (text) out.push({ text, bold, italic });
    }
  }
  return out;
}

export function parseMemoHtml(html: string): Block[] {
  const blocks: Block[] = [];
  const re = /<(h2|h3|p|blockquote|ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  for (const m of html.matchAll(re)) {
    const tag = m[1]!.toLowerCase();
    const inner = m[2]!;
    if (tag === "ul" || tag === "ol") {
      const items = [...inner.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((li) => inline(li[1]!.replace(/<\/?p[^>]*>/gi, "")));
      blocks.push({ kind: "list", ordered: tag === "ol", items });
    } else {
      blocks.push({ kind: tag === "blockquote" ? "quote" : (tag as "h2" | "h3" | "p"), parts: inline(inner.replace(/<\/?p[^>]*>/gi, "")) });
    }
  }
  return blocks;
}

function Runs({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((r, i) => (
        <Text key={i} style={{ fontFamily: r.bold ? (r.italic ? "Helvetica-BoldOblique" : "Helvetica-Bold") : r.italic ? "Helvetica-Oblique" : undefined }}>
          {r.text}
        </Text>
      ))}
    </>
  );
}

export interface MemoPdfInput {
  title: string;
  reference: string;
  clientName: string;
  preparedBy: string;
  date: string;
  status: string;
  approvedBy: string | null;
  approvedAt: string | null;
  version: number;
  keyMetrics: { label: string; value: string }[];
  html: string;
}

function MemoDocument(m: MemoPdfInput) {
  const blocks = parseMemoHtml(m.html);
  return (
    <Document title={m.title} author="PropFolios Intelligence" subject={`${m.reference} ${m.clientName}`} creator="PropFolios Intelligence">
      <Page size="A4" style={st.page}>
        <View style={st.footerRule} fixed />
        <Text style={st.footerLeft} fixed>
          PropFolios · Dubai, United Arab Emirates
        </Text>
        <Text style={st.footerRight} fixed>
          {m.reference} · Version {m.version}
        </Text>
        <View style={st.header} fixed>
          <View>
            <Text style={st.brand}>PROPFOLIOS</Text>
            <Text style={st.brandSub}>INTELLIGENCE</Text>
          </View>
          <Text style={st.confidential}>STRICTLY PRIVATE AND CONFIDENTIAL</Text>
        </View>
        <Text style={st.eyebrow}>
          {m.reference} · Prepared for {m.clientName}
        </Text>
        <Text style={st.title}>{m.title}</Text>
        <View style={st.mark} />
        <Text style={st.meta}>
          {m.date} · Prepared by {m.preparedBy} · Version {m.version}
        </Text>
        {m.keyMetrics.length > 0 && (
          <View style={st.metrics}>
            {m.keyMetrics.map((k) => (
              <View key={k.label} style={st.metric}>
                <Text style={st.metricLabel}>{k.label}</Text>
                <Text style={st.metricValue}>{k.value}</Text>
              </View>
            ))}
          </View>
        )}
        {blocks.map((b, i) =>
          b.kind === "list" ? (
            <View key={i} style={{ marginBottom: 8 }}>
              {b.items.map((item, j) => (
                <View key={j} style={st.li} wrap={false}>
                  <Text style={st.bullet}>{b.ordered ? `${j + 1}.` : "–"}</Text>
                  <Text style={{ flex: 1 }}>
                    <Runs parts={item} />
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text key={i} style={b.kind === "h2" ? st.h2 : b.kind === "h3" ? st.h3 : b.kind === "quote" ? st.quote : st.p} minPresenceAhead={b.kind === "h2" ? 60 : undefined}>
              <Runs parts={b.parts} />
            </Text>
          ),
        )}
        <View style={st.approval} wrap={false}>
          <Text>{m.approvedBy ? `Approved by ${m.approvedBy}${m.approvedAt ? ` on ${m.approvedAt}` : ""} for the PropFolios investment committee.` : `Status: ${m.status.replace("_", " ")}. Not yet approved by the investment committee.`}</Text>
          <Text style={{ marginTop: 6, color: INK500, fontSize: 7.5 }}>
            This memo is advisory and is prepared for the named client only. Projected returns are simulations, not forecasts or guarantees. Tax and legal matters should be confirmed with qualified advisers in the relevant jurisdiction.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export function renderMemoPdf(input: MemoPdfInput) {
  return renderToBuffer(<MemoDocument {...input} />);
}
