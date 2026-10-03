/**
 * Shared text normalisation for Indian land records. Inputs come from a PDF
 * text layer, from OCR, or typed by hand, and mix English with Marathi
 * (Devanagari), Konkani or Portuguese labels. Normalisation converts
 * Devanagari digits, unifies punctuation and repairs common OCR confusions
 * inside numeric tokens before any field is read.
 */

const DEVANAGARI_DIGITS = "०१२३४५६७८९";

export function normalise(text: string) {
  let t = text.normalize("NFC");
  t = t.replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)));
  t = t.replace(/[‐-―]/g, "-").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/ /g, " ");
  t = t.replace(/[ \t]+/g, " ").replace(/\r/g, "");
  // OCR confusions inside numbers: O→0, l/I→1, S→5 when flanked by digits.
  t = t.replace(/(?<=\d)[Oo](?=[\d.,/])|(?<=[\d.,/])[Oo](?=\d)/g, "0");
  t = t.replace(/(?<=\d)[lI|](?=\d)|(?<=\d[.,/])[lI|](?=\d)/g, "1");
  t = t.replace(/(?<=\d)S(?=\d)/g, "5");
  return t;
}

/** Finds the value after any of the labels, on the same line, up to a delimiter or the next label. */
export function field(text: string, labels: string[], pattern = "[^\\n|;]+"): string | null {
  for (const label of labels) {
    const esc = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*");
    const m = new RegExp(`${esc}\\s*(?:[:：\\-–=]|\\bno\\.?|क्र\\.?)?\\s*(${pattern})`, "iu").exec(text);
    if (m) {
      const v = m[1].trim().replace(/\s{2,}.*$/, "").replace(/[,.]$/, "");
      if (v) return v;
    }
  }
  return null;
}

export function numberIn(s: string | null): number | null {
  if (!s) return null;
  const m = /-?\d[\d,]*(?:\.\d+)?/.exec(s);
  return m ? Number(m[0].replace(/,/g, "")) : null;
}

/** Hectare-are(-centiare) notation used on 7/12 extracts: "1.20.50" or "1-20-50" (H.R.P.) → square metres. */
export function hectareAreToSqm(s: string | null): number | null {
  if (!s) return null;
  const m = /(\d+)\s*[.\-]\s*(\d{1,2})(?:\s*[.\-]\s*(\d{1,2}))?/.exec(s);
  if (!m) return numberIn(s);
  const [h, r, p] = [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)];
  return h * 10_000 + r * 100 + p;
}

export function lines(text: string) {
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}

export function datesIn(s: string) {
  return [...s.matchAll(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/g)].map((m) => `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`);
}

export interface ParseResult<T> {
  recordType: "7_12" | "property_card" | "form_i_xiv" | "escritura";
  parsed: T;
  /** Share of required fields found, discounted for OCR noise. */
  confidence: number;
  warnings: string[];
  missing: string[];
  script: "latin" | "devanagari" | "mixed";
}

export function scriptOf(text: string): ParseResult<unknown>["script"] {
  const dev = (text.match(/[ऀ-ॿ]/g) ?? []).length;
  const lat = (text.match(/[A-Za-z]/g) ?? []).length;
  if (dev > lat * 2) return "devanagari";
  if (lat > dev * 2) return "latin";
  return "mixed";
}

/** Confidence from required-field coverage, reduced when the text looks like noisy OCR. */
export function confidence(found: number, required: number, text: string, ocr: boolean) {
  const coverage = required ? found / required : 1;
  const noise = (text.match(/[^\p{L}\p{N}\s.,:;/()\-–'"%₹]/gu) ?? []).length / Math.max(1, text.length);
  const penalty = (ocr ? 0.08 : 0) + Math.min(0.25, noise * 4);
  return Math.max(0.05, +(coverage * (1 - penalty)).toFixed(2));
}
