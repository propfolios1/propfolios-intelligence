"use client";

import * as React from "react";
import { Segmented } from "@/components/primitives/segmented";
import type { DocumentItem } from "@/lib/data/types";
import { DocumentCard } from "./document-card";
import { EmptyState } from "./empty-state";

const PLURAL: Record<string, string> = { All: "All", Memo: "Memos", SPA: "SPAs", Valuation: "Valuations", "Title deed": "Title deeds", Research: "Research", Statement: "Statements" };

export function DocumentsGrid({ docs, subtitles }: { docs: DocumentItem[]; subtitles: Record<string, string> }) {
  const types = ["All", ...new Set(docs.map((d) => d.type))];
  const [type, setType] = React.useState("All");
  const shown = type === "All" ? docs : docs.filter((d) => d.type === type);
  return (
    <>
      <Segmented
        label="Document type"
        className="mt-10 mb-8 flex-wrap gap-y-2"
        value={type}
        onChange={setType}
        options={types.map((t) => ({ value: t, label: PLURAL[t] ?? t, count: t === "All" ? docs.length : docs.filter((d) => d.type === t).length }))}
      />
      {shown.length ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {shown.map((d) => (
            <DocumentCard key={d.id} doc={d} subtitle={subtitles[d.id]} />
          ))}
        </div>
      ) : (
        <EmptyState glyph="documents" headline="No documents of this type yet." />
      )}
    </>
  );
}
