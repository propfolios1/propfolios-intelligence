import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { setReportStatus } from "@/lib/compliance/service";
import { scope } from "@/lib/tenant-db";

type Ctx = { params: Promise<{ id: string }> };

/** The report file, for import into goAML or FINnet, or to paste into the SAR Portal or SONAR. */
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser(["tenant_admin"]);
  const { id } = await params;
  const [r] = await (await getDb()).select().from(s.regulatoryReports).where(scope(s.regulatoryReports, user.tenantId, eq(s.regulatoryReports.id, id)));
  if (!r) throw new HttpError(404, "Report not found.");
  await audit(user, `downloaded ${r.title}`, { entityType: "regulatory_report", entityId: id });
  const d = r.data as { filename?: string; mime?: string };
  return new Response(r.content, { headers: { "content-type": `${d.mime ?? "text/plain"}; charset=utf-8`, "content-disposition": `attachment; filename="${d.filename ?? `${r.type}.txt`}"`, "cache-control": "no-store" } });
});

const body = z.object({ status: z.enum(["ready", "filed", "withdrawn"]), reference: z.string().trim().max(80).nullable().optional() });

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser(["tenant_admin"]);
  const { id } = await params;
  const b = await parseBody(req, body);
  const r = await setReportStatus(await getDb(), user.tenantId, id, { ...b, userId: user.id });
  await audit(user, `marked ${r.title} as ${b.status}${b.reference ? ` (${b.reference})` : ""}`, { entityType: "regulatory_report", entityId: id, after: { status: r.status, reference: r.filingReference } });
  return NextResponse.json({ report: r });
});
