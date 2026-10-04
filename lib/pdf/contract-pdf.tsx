import "server-only";
import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import { blocks } from "@/lib/contracts/html-blocks";

/**
 * Contract PDF. Renders the contract's HTML (headings, paragraphs, ordered
 * lists, bold) into an A4 document with the firm's name, the reference, the
 * content hash and page numbers on every page, followed by the signature
 * record once signed.
 */

const NAVY = "#0A1F44";
const INK = "#0A0A0A";
const INK500 = "#6B7280";
const RULE = "#E5E7EB";

const st = StyleSheet.create({
  page: { paddingTop: 56, paddingBottom: 72, paddingHorizontal: 60, fontFamily: "Times-Roman", fontSize: 11, color: INK, lineHeight: 1.5 },
  header: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: NAVY, paddingBottom: 8, marginBottom: 24, fontFamily: "Helvetica", fontSize: 8, color: INK500 },
  h2: { fontFamily: "Times-Bold", fontSize: 18, color: NAVY, marginBottom: 10 },
  h3: { fontFamily: "Helvetica-Bold", fontSize: 10, color: INK, marginTop: 12, marginBottom: 4, letterSpacing: 0.3 },
  p: { marginBottom: 6 },
  li: { flexDirection: "row", marginBottom: 4 },
  num: { width: 18 },
  missing: { backgroundColor: "#F5EDDA" },
  sigs: { marginTop: 24, borderTopWidth: 1, borderTopColor: RULE, paddingTop: 10, fontFamily: "Helvetica", fontSize: 8.5 },
  footer: { position: "absolute", bottom: 32, left: 60, right: 60, flexDirection: "row", justifyContent: "space-between", fontFamily: "Helvetica", fontSize: 7.5, color: INK500, borderTopWidth: 1, borderTopColor: RULE, paddingTop: 6 },
});

const decode = (s: string) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/** Inline runs: bold for <strong>, highlighted for unfilled placeholders, plain text otherwise. */
function Inline({ html }: { html: string }) {
  const parts = html.split(/(<strong>[\s\S]*?<\/strong>|<mark class="missing">[\s\S]*?<\/mark>)/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => {
        const bold = /^<strong>([\s\S]*)<\/strong>$/.exec(p);
        const miss = /^<mark class="missing">([\s\S]*)<\/mark>$/.exec(p);
        const text = decode((bold?.[1] ?? miss?.[1] ?? p).replace(/<[^>]+>/g, ""));
        return (
          <Text key={i} style={bold ? { fontFamily: "Times-Bold" } : miss ? st.missing : undefined}>
            {text}
          </Text>
        );
      })}
    </>
  );
}

export function ContractDocument(c: { title: string; firm: string; reference: string; hash: string; html: string; signedBy: { name: string; email: string; signedAt: string }[]; status: string }) {
  return (
    <Document title={c.title} author={c.firm} subject={c.reference}>
      <Page size="A4" style={st.page}>
        <View style={st.header} fixed>
          <Text>{c.firm.toUpperCase()}</Text>
          <Text>{c.reference}</Text>
        </View>
        {blocks(c.html).map((b, i) =>
          b.tag === "ol" ? (
            <View key={i} style={{ marginBottom: 6 }}>
              {b.items.map((it, j) => (
                <View key={j} style={st.li} wrap={false}>
                  <Text style={st.num}>{j + 1}.</Text>
                  <Text style={{ flex: 1 }}>
                    <Inline html={it} />
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text key={i} style={st[b.tag]} minPresenceAhead={b.tag === "h3" ? 40 : 0}>
              <Inline html={b.html} />
            </Text>
          ),
        )}
        {c.signedBy.length > 0 && (
          <View style={st.sigs} wrap={false}>
            <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 4 }}>Signature record</Text>
            {c.signedBy.map((x, i) => (
              <Text key={i}>
                {x.name} ({x.email}), signed {x.signedAt.replace("T", " ").slice(0, 19)} UTC
              </Text>
            ))}
          </View>
        )}
        <View style={st.footer} fixed>
          <Text>
            {c.status === "signed" ? "Executed" : "Draft for review"} · SHA-256 {c.hash.slice(0, 16)}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function contractPdf(c: Parameters<typeof ContractDocument>[0]) {
  return renderToBuffer(<ContractDocument {...c} />);
}
