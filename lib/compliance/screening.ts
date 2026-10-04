import "server-only";
import type { ScreeningHit } from "@/db/schema-production";
import { nameScore, SAMPLE_LIST } from "@/lib/client/aml";
import { IntegrationError, request } from "@/lib/integrations/http";

/**
 * Screening providers. OpenSanctions (consolidated sanctions lists, PEPs and
 * crime-related entities from public sources) is used when
 * OPENSANCTIONS_API_KEY is set; its hosted API is free for non-commercial use
 * and licensed for commercial use. Without a key the built-in sample list is
 * used, which is fictional and demonstrates the workflow only: a firm must
 * connect a licensed provider before relying on screening results.
 */

export interface ScreeningQuery {
  name: string;
  entityType: "person" | "company";
  birthDate?: string | null;
  nationality?: string | null;
}

export interface ScreeningResult {
  provider: string;
  status: "clear" | "potential_match" | "confirmed_match" | "error";
  hits: ScreeningHit[];
  riskScore: number;
  error?: string;
}

const TOPIC_WEIGHT: Record<string, number> = { sanction: 100, "sanction.linked": 80, "crime.terror": 100, "crime.fin": 70, crime: 60, "role.pep": 50, "role.rca": 40, debarment: 40, "poi": 30 };

export function riskFromHits(hits: ScreeningHit[]) {
  if (!hits.length) return 0;
  return Math.min(100, Math.round(Math.max(...hits.map((h) => Math.max(20, ...h.topics.map((t) => TOPIC_WEIGHT[t] ?? 20)) * h.score))));
}

export function statusFromHits(hits: ScreeningHit[]): ScreeningResult["status"] {
  if (hits.some((h) => h.score >= 0.98 && h.topics.some((t) => t.startsWith("sanction") || t === "crime.terror"))) return "confirmed_match";
  return hits.length ? "potential_match" : "clear";
}

export const SAMPLE_PROVIDER = "Nakhla sample list (demonstration only)";

function sample(q: ScreeningQuery): ScreeningResult {
  const topic = { sanctions: "sanction", pep: "role.pep", adverse_media: "crime" } as const;
  const hits: ScreeningHit[] = SAMPLE_LIST.map((e, i) => ({ listId: `sample-${i}`, list: e.list, name: e.name, score: nameScore(q.name, e.name), topics: [topic[e.type]], note: e.note, url: null }))
    .filter((h) => h.score >= 0.85)
    .sort((a, b) => b.score - a.score);
  return { provider: SAMPLE_PROVIDER, status: statusFromHits(hits), hits, riskScore: riskFromHits(hits) };
}

type OsResponse = { responses: Record<string, { results: { id: string; caption: string; score: number; match: boolean; datasets: string[]; properties: { topics?: string[]; notes?: string[]; position?: string[] } }[] }> };

async function openSanctions(q: ScreeningQuery, key: string, fetcher?: typeof fetch): Promise<ScreeningResult> {
  const properties: Record<string, string[]> = { name: [q.name] };
  if (q.birthDate && q.entityType === "person") properties.birthDate = [q.birthDate];
  if (q.nationality) properties[q.entityType === "person" ? "nationality" : "jurisdiction"] = [q.nationality];
  const body = { queries: { q: { schema: q.entityType === "person" ? "Person" : "Company", properties } } };
  const r = await request<OsResponse>("OpenSanctions", `${process.env.OPENSANCTIONS_URL || "https://api.opensanctions.org"}/match/default?threshold=0.7&limit=10`, { method: "POST", body, headers: { authorization: `ApiKey ${key}` }, timeoutMs: 12_000, fetcher });
  const hits: ScreeningHit[] = (r.responses.q?.results ?? []).map((x) => ({ listId: x.id, list: x.datasets.slice(0, 3).join(", "), name: x.caption, score: Math.round(x.score * 100) / 100, topics: x.properties.topics ?? [], note: [...(x.properties.position ?? []), ...(x.properties.notes ?? [])].join("; ").slice(0, 300), url: `https://www.opensanctions.org/entities/${x.id}/` }));
  return { provider: "OpenSanctions", status: statusFromHits(hits), hits, riskScore: riskFromHits(hits) };
}

export const screeningProvider = () => (process.env.OPENSANCTIONS_API_KEY ? "OpenSanctions" : SAMPLE_PROVIDER);

export async function screenSubject(q: ScreeningQuery, opts: { fetcher?: typeof fetch } = {}): Promise<ScreeningResult> {
  const key = process.env.OPENSANCTIONS_API_KEY;
  if (!key) return sample(q);
  try {
    return await openSanctions(q, key, opts.fetcher);
  } catch (e) {
    // A failed screen is never reported as clear.
    return { provider: "OpenSanctions", status: "error", hits: [], riskScore: 0, error: e instanceof IntegrationError ? e.message : (e as Error).message };
  }
}
