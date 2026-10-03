"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { StructuredDetail } from "@/components/os/structured-detail";
import { Button } from "@/components/ui/button";
import { FormField, Select, Textarea } from "@/components/ui/form";
import { toast } from "@/components/ui/toaster";

type Result = { recordType: string; parsed: Record<string, unknown>; confidence: number; warnings: string[]; missing: string[]; method: string };

/** Upload a scan or PDF, or paste text, of a 7/12, property card, Form I and XIV or Comunidade grant; shows the parse inline. */
export function LandRecordUpload({ propertyId, state }: { propertyId: string; state: "MH" | "GA" }) {
  const router = useRouter();
  const [kind, setKind] = React.useState("");
  const [text, setText] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<Result | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData();
    fd.set("propertyId", propertyId);
    if (kind) fd.set("kind", kind);
    if (file) fd.set("file", file);
    else fd.set("text", text);
    const res = await fetch("/api/india/land-records", { method: "POST", body: fd });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return void toast.error("Record not filed", { description: json.error });
    setResult(json);
    toast.success("Land record filed", { description: `${json.warnings.length} findings, confidence ${Math.round(json.confidence * 100)}%.` });
    router.refresh();
  };
  return (
    <form onSubmit={submit} className="rounded-md border border-ink-200 bg-surface p-5 shadow-card">
      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        <FormField label="Record type" hint="Detected from the content when left blank.">
          <Select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">Detect automatically</option>
            {state === "MH" ? (
              <>
                <option value="7_12">7/12 extract</option>
                <option value="property_card">Property card</option>
              </>
            ) : (
              <>
                <option value="form_i_xiv">Form I and XIV</option>
                <option value="escritura">Comunidade / Escritura</option>
              </>
            )}
          </Select>
        </FormField>
        <FormField label="Scan, PDF or text file" hint="PDF text layers are read directly; scans and photographs are transcribed by OCR, including Marathi and Portuguese.">
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-small text-ink-700 file:mr-3 file:h-8 file:rounded-sm file:border file:border-ink-200 file:bg-surface file:px-3 file:text-ui file:text-ink-900" />
        </FormField>
      </div>
      {!file && (
        <FormField label="Or paste the record's text" className="mt-4">
          <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={state === "MH" ? "गाव Village: …\nभूमापन क्रमांक Survey No: …" : "Taluka: …\nVillage: …\nSurvey No: …"} />
        </FormField>
      )}
      <div className="mt-4 flex justify-end">
        <Button type="submit" disabled={busy || (!file && text.trim().length < 40)}>
          {busy ? "Parsing" : "Parse and file"}
        </Button>
      </div>
      {result && (
        <div className="mt-6 border-t border-ink-200 pt-5">
          <div className="text-small text-ink-700">
            Parsed as <span className="font-medium text-ink-900">{result.recordType.replace(/_/g, " ")}</span> by {result.method === "ocr" ? "OCR" : "text"}; confidence <span className="num">{Math.round(result.confidence * 100)}%</span>.
          </div>
          {result.warnings.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-small text-ink-700">
              {result.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          <StructuredDetail output={result.parsed} className="mt-4" />
        </div>
      )}
    </form>
  );
}
