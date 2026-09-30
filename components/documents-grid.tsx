"use client";

import { FolderOpen } from "lucide-react";
import * as React from "react";
import { DocumentCard } from "./document-card";
import { EmptyState } from "./empty-state";
import type { DocumentItem } from "@/lib/data/types";
import { cn } from "@/lib/utils";

export function DocumentsGrid({ docs, subtitles }: { docs: DocumentItem[]; subtitles: Record<string, string> }) {
  const types = ["All", ...new Set(docs.map((d) => d.type))];
  const [type, setType] = React.useState("All");
  const shown = type === "All" ? docs : docs.filter((d) => d.type === type);
  return (
    <>
      <div className="mt-10 mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Document type">
        {types.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={type === t}
            onClick={() => setType(t)}
            className={cn(
              "h-8 rounded-full border px-3.5 text-sm transition-colors",
              type === t ? "border-navy-900 bg-navy-900 text-white" : "border-ink-200 bg-surface text-ink-700 hover:border-ink-300",
            )}
          >
            {t}
            <span className={cn("num ml-2 text-xs", type === t ? "text-white/70" : "text-ink-400")}>{t === "All" ? docs.length : docs.filter((d) => d.type === t).length}</span>
          </button>
        ))}
      </div>
      {shown.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {shown.map((d) => (
            <DocumentCard key={d.id} doc={d} subtitle={subtitles[d.id]} />
          ))}
        </div>
      ) : (
        <EmptyState icon={FolderOpen} headline="No documents of this type" subtext="Documents shared by your analyst appear here." />
      )}
    </>
  );
}
