import { getDb } from "@/db";
import { audit, handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { memoPdf } from "@/lib/pdf/memo-export";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Renders the memo as an A4 PDF in the tenant's house style. */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const { pdf, filename, mandate } = await memoPdf(await getDb(), user, id);
  await audit(user, "exported memo PDF", { entityType: "memo", entityId: id, mandateId: mandate.id });
  return new Response(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${filename}"`, "cache-control": "private, no-store" } });
});
