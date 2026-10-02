import type { MandateListItem } from "./queries";

/** Mandate list rows as plain JSON for client components. */
export function mandateRows(rows: MandateListItem[]) {
  return rows.map((m) => ({
    id: m.id,
    reference: m.reference,
    title: m.title,
    status: m.status,
    priority: m.priority,
    deadline: m.deadline,
    ticketSizeAed: m.ticketSizeAed,
    recommendation: m.recommendation,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    running: Boolean(m.runningSince),
    clientId: m.clientId,
    clientName: m.clientName,
    propertyName: m.propertyName,
    community: m.community,
    analystName: m.analystName,
  }));
}

/** Insight rows to the client component's view (dates as ISO strings). */
export function insightViews(rows: { id: string; kind: "price_movement" | "developer_distress" | "undervalued" | "exit_window" | "follow_up"; severity: string; audience: string; title: string; body: string; metrics: { label: string; value: string }[]; status: "new" | "read" | "dismissed"; dueAt: Date | null; createdAt: Date }[]) {
  return rows.map((r) => ({ id: r.id, kind: r.kind, severity: r.severity, audience: r.audience, title: r.title, body: r.body, metrics: r.metrics, status: r.status, dueAt: r.dueAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString() }));
}
