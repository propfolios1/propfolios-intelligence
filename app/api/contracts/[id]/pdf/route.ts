import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { contractPdf } from "@/lib/pdf/contract-pdf";
import { scope } from "@/lib/tenant-db";

/** The contract as a PDF, for staff on the deal and for the client whose deal it is. */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const db = await getDb();
  const [row] = await db.select({ c: s.contracts, deal: s.deals, firm: s.tenants.name }).from(s.contracts).innerJoin(s.deals, eq(s.deals.id, s.contracts.dealId)).innerJoin(s.tenants, eq(s.tenants.id, s.contracts.tenantId)).where(scope(s.contracts, user.tenantId, eq(s.contracts.id, id)));
  if (!row) throw new HttpError(404, "Contract not found.");
  if (user.role === "client" && row.deal.clientId !== user.clientId) throw new HttpError(404, "Contract not found.");
  const pdf = await contractPdf({ title: row.c.title, firm: row.firm, reference: `${row.deal.reference} · ${row.c.title} · version ${row.c.version}`, hash: row.c.contentHash, html: row.c.contentHtml, signedBy: row.c.signedBy, status: row.c.status });
  await audit(user, `downloaded "${row.c.title}" as PDF`, { entityType: "contract", entityId: id });
  const name = `${row.deal.reference}-${row.c.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50)}-v${row.c.version}.pdf`;
  return new Response(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${name}"`, "cache-control": "private, no-store" } });
});
