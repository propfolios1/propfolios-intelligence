import "server-only";
import { desc, inArray, ne } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { scope } from "@/lib/tenant-db";

export interface StyleExemplar {
  headings: string[];
  opening: string;
}

export interface LearnedStyle {
  exemplars: StyleExemplar[];
  /** Headings that recur across the firm's approved memos, in their usual order. */
  headingOrder: string[];
  avgSentenceWords: number;
  learnedFrom: number;
}

const strip = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

/**
 * Learns a tenant's memo house style from its most recent approved or
 * delivered memos: section headings, their usual order, the opening of the
 * executive summary and average sentence length. Passed to the memo agent as
 * exemplars of voice and structure, never as facts.
 */
export async function learnHouseStyle(db: DB, tenantId: string, excludeMandateId?: string, limit = 3): Promise<LearnedStyle | null> {
  const rows = await db
    .select({ html: s.memos.contentHtml })
    .from(s.memos)
    .where(scope(s.memos, tenantId, inArray(s.memos.status, ["approved", "delivered"]), excludeMandateId ? ne(s.memos.mandateId, excludeMandateId) : undefined))
    .orderBy(desc(s.memos.approvedAt))
    .limit(limit);
  if (!rows.length) return null;
  const exemplars = rows.map((r) => {
    const headings = [...r.html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => strip(m[1]!)).filter(Boolean);
    const firstPara = r.html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "";
    return { headings, opening: strip(firstPara).slice(0, 600) };
  });
  const counts = new Map<string, { n: number; pos: number }>();
  for (const e of exemplars) e.headings.forEach((h, i) => counts.set(h, { n: (counts.get(h)?.n ?? 0) + 1, pos: (counts.get(h)?.pos ?? 0) + i }));
  const headingOrder = [...counts.entries()]
    .filter(([, v]) => v.n >= Math.min(2, exemplars.length))
    .sort((a, b) => a[1].pos / a[1].n - b[1].pos / b[1].n)
    .map(([h]) => h);
  const text = rows.map((r) => strip(r.html)).join(" ");
  const sentences = text.split(/(?<=[.!?])\s+/).filter((x) => x.length > 20);
  const avgSentenceWords = sentences.length ? Math.round(sentences.reduce((a, x) => a + x.split(" ").length, 0) / sentences.length) : 0;
  return { exemplars, headingOrder, avgSentenceWords, learnedFrom: rows.length };
}

