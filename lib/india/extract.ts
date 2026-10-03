import "server-only";
import { anthropic, isAiConfigured, MODELS, recordAgentRun } from "@/lib/ai/client";
import { costUsd } from "@/lib/ai/cost";

/**
 * Text from an uploaded land record. Typed text and PDFs with a text layer
 * are read directly. Scanned PDFs and photographs go through Claude's
 * document and vision input (OCR that reads Devanagari and Portuguese
 * script) when an Anthropic key is configured; otherwise the caller is told
 * the scan needs a text layer.
 */
export async function extractText(file: { bytes: Uint8Array; mime: string; name: string }, ctx: { tenantId: string; actor: string }): Promise<{ text: string; method: "text" | "pdf_text" | "ocr"; note?: string }> {
  if (file.mime.startsWith("text/") || /\.(txt|md|csv)$/i.test(file.name)) return { text: new TextDecoder().decode(file.bytes), method: "text" };
  if (file.mime === "application/pdf" || /\.pdf$/i.test(file.name)) {
    const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(file.bytes));
    const { text } = await pdfText(pdf, { mergePages: true });
    const t = Array.isArray(text) ? text.join("\n") : text;
    if (t.replace(/\s/g, "").length > 80) return { text: t, method: "pdf_text" };
  }
  if (!isAiConfigured()) return { text: "", method: "ocr", note: "This file is a scan without a text layer. OCR needs the Anthropic key (Settings in Vercel); alternatively paste the record's text." };
  const started = Date.now();
  const data = Buffer.from(file.bytes).toString("base64");
  const isPdf = file.mime === "application/pdf" || /\.pdf$/i.test(file.name);
  const media = (/(png|jpe?g|gif|webp)$/i.exec(file.mime)?.[1] ?? "png").replace("jpg", "jpeg");
  const source = isPdf ? ({ type: "document", source: { type: "base64", media_type: "application/pdf", data } } as const) : ({ type: "image", source: { type: "base64", media_type: `image/${media}` as "image/png", data } } as const);
  const res = await anthropic().messages.create({
    model: MODELS.fast,
    max_tokens: 4000,
    messages: [{ role: "user", content: [source, { type: "text", text: "Transcribe this Indian land record exactly, line by line, keeping each label with its value on one line (for example 'गाव Village: Eksar'). Keep Marathi, Konkani and Portuguese text in its original script and digits as written. Output only the transcription." }] }],
  });
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("\n");
  const usage = { input_tokens: res.usage.input_tokens, output_tokens: res.usage.output_tokens };
  await recordAgentRun({ tenantId: ctx.tenantId, actor: ctx.actor }, "land-record-ocr", "land record transcription (ocr_v1)", { model: res.model, usage, costUsd: costUsd(res.model, usage), durationMs: Date.now() - started });
  return { text, method: "ocr" };
}
