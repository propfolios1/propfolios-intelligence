"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

/** Drag-and-drop or browse upload to /api/documents. PDF or image, 10 MB. */
export function DocumentUpload({ defaultType = "kyc", types = ["kyc", "spa", "title_deed", "valuation", "statement", "other"], clientId, mandateId }: { defaultType?: string; types?: string[]; clientId?: string; mandateId?: string }) {
  const router = useRouter();
  const input = React.useRef<HTMLInputElement>(null);
  const [type, setType] = React.useState(defaultType);
  const [over, setOver] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const LABEL: Record<string, string> = { kyc: "KYC (passport, Emirates ID, proof of address)", spa: "Sale and purchase agreement", title_deed: "Title deed", valuation: "Valuation", statement: "Statement", research: "Research", other: "Other" };

  async function upload(file: File) {
    if (file.size > 10 * 1024 * 1024) return void toast.error("Files must be 10 MB or smaller.");
    setBusy(true);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("type", type);
    fd.set("title", file.name.replace(/\.[^.]+$/, ""));
    if (clientId) fd.set("clientId", clientId);
    if (mandateId) fd.set("mandateId", mandateId);
    const res = await fetch("/api/documents", { method: "POST", body: fd });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return void toast.error("Upload failed", { description: json.error });
    toast.success(`${file.name} uploaded`, { description: json.stored ? "Stored securely." : "Recorded. File storage is not configured on this deployment." });
    router.refresh();
  }

  return (
    <div className="rounded-md border border-hairline bg-surface p-5 shadow-card">
      <label className="flex flex-col gap-1.5">
        <span className="text-ui font-medium text-ink-900">Document type</span>
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          {types.map((t) => (
            <option key={t} value={t}>
              {LABEL[t] ?? t}
            </option>
          ))}
        </Select>
      </label>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files[0];
          if (f) void upload(f);
        }}
        className={cn("mt-4 flex flex-col items-center justify-center gap-3 rounded-md border border-dashed px-6 py-8 text-center transition-colors duration-150", over ? "border-navy-900 bg-navy-50" : "border-hairline")}
      >
        <p className="text-small text-ink-700">Drop a PDF or image here, up to 10 MB</p>
        <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? "Uploading" : "Choose file"}
        </Button>
        <input
          ref={input}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
