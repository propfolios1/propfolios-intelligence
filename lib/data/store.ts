import "server-only";
import { buildSampleAnalysis } from "./analysis";
import * as seed from "./seed";
import type { AuditEvent, MandateAnalysis, MandateStatus, Memo } from "./types";

/**
 * Repository layer. Reads come from seed data merged with any results the
 * agents have produced during this server's lifetime. Swap the internals for
 * a database client without touching callers.
 */
interface RuntimeState {
  analyses: Map<string, Partial<MandateAnalysis>>;
  statusOverrides: Map<string, MandateStatus>;
  audit: AuditEvent[];
  memoHtml: Map<string, string>;
  seededAt: number;
}

const g = globalThis as unknown as { __pfState?: RuntimeState };
const state: RuntimeState = (g.__pfState ??= {
  analyses: new Map(),
  statusOverrides: new Map(),
  audit: [],
  memoHtml: new Map(),
  seededAt: Date.now(),
});

export const clients = seed.clients;
export const developers = seed.developers;
export const properties = seed.properties;
export const analysts = seed.analysts;

export function listMandates() {
  return seed.mandates.map((m) => ({ ...m, status: state.statusOverrides.get(m.id) ?? m.status }));
}

export function getMandate(id: string) {
  return listMandates().find((m) => m.id === id);
}

export function getClient(id: string) {
  return seed.clients.find((c) => c.id === id);
}
export function getProperty(id: string) {
  return seed.properties.find((p) => p.id === id);
}
export function getDeveloper(id: string) {
  return seed.developers.find((d) => d.id === id);
}
export function getAnalyst(id: string) {
  return seed.analysts.find((a) => a.id === id);
}

/** Mandate joined with its client, property, developer and analyst. */
export function getMandateView(id: string) {
  const m = getMandate(id);
  if (!m) return undefined;
  const property = getProperty(m.propertyId)!;
  return {
    mandate: m,
    client: getClient(m.clientId)!,
    property,
    developer: getDeveloper(property.developerId)!,
    analyst: getAnalyst(m.analystId)!,
  };
}

export type MandateRow = ReturnType<typeof listMandateRows>[number];
export function listMandateRows() {
  return listMandates().map((m) => {
    const p = getProperty(m.propertyId)!;
    return {
      id: m.id,
      status: m.status,
      client: getClient(m.clientId)!.name,
      clientId: m.clientId,
      property: p.name,
      community: p.community,
      developer: getDeveloper(p.developerId)!.name,
      analyst: getAnalyst(m.analystId)!.name,
      createdAt: m.createdAt,
      deadline: m.deadline,
      ticketSize: m.ticketSize,
      priority: m.priority,
    };
  });
}

export function getAnalysis(id: string): MandateAnalysis | undefined {
  const view = getMandateView(id);
  if (!view) return undefined;
  const sample = buildSampleAnalysis(view.mandate, view.property, view.developer);
  const live = state.analyses.get(id);
  return live ? { ...sample, ...live } : sample;
}

export function saveAnalysis(id: string, patch: Partial<MandateAnalysis>) {
  state.analyses.set(id, { ...(state.analyses.get(id) ?? {}), ...patch });
}

export function setMandateStatus(id: string, status: MandateStatus) {
  state.statusOverrides.set(id, status);
}

export function listAudit(filter?: { mandateId?: string; limit?: number }) {
  const all = [...state.audit, ...seed.auditEvents].sort((a, b) => b.at.localeCompare(a.at));
  const scoped = filter?.mandateId ? all.filter((e) => e.mandateId === filter.mandateId) : all;
  return filter?.limit ? scoped.slice(0, filter.limit) : scoped;
}

export function appendAudit(event: Omit<AuditEvent, "id" | "at"> & { at?: string }) {
  const e: AuditEvent = { id: `ev_rt_${state.audit.length + 1}_${Date.now()}`, at: new Date().toISOString(), ...event };
  state.audit.unshift(e);
  return e;
}

export function listMemos(): (Memo & { client: string; property: string })[] {
  return seed.memos.map((memo) => {
    const view = getMandateView(memo.mandateId)!;
    return { ...memo, client: view.client.name, property: view.property.name };
  });
}

export function getMemoHtml(mandateId: string) {
  return state.memoHtml.get(mandateId);
}
export function saveMemoHtml(mandateId: string, html: string) {
  state.memoHtml.set(mandateId, html);
}

export function listDocuments(clientId?: string) {
  return clientId ? seed.documents.filter((d) => d.clientId === clientId) : seed.documents;
}

export const holdings = seed.holdings;
export const portfolioAlerts = seed.portfolioAlerts;
export const clientRecommendations = seed.clientRecommendations;
export const marketMonths = seed.marketMonths;
export const supplyPipeline = seed.supplyPipeline;
export const priceTrend = seed.priceTrend;
export const heatmap = seed.heatmap;
export const heatmapRegions = seed.heatmapRegions;
export const heatmapClasses = seed.heatmapClasses;
export const users = seed.users;
export const DEMO_CLIENT_ID = seed.DEMO_CLIENT_ID;

export function runtimeStats() {
  return {
    agentRuns: state.audit.filter((e) => e.actorType === "agent").length,
    analyses: state.analyses.size,
    seededAt: state.seededAt,
  };
}

export function resetRuntime() {
  state.analyses.clear();
  state.statusOverrides.clear();
  state.audit.length = 0;
  state.memoHtml.clear();
  state.seededAt = Date.now();
}
