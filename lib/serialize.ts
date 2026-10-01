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
