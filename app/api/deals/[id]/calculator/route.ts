import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { calculationHistory, dealCalculator, deleteScenario, saveScenario, selectScenario } from "@/lib/commission/calc-service";
import { calcConfigSchema } from "@/lib/commission/calculator";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const { id } = await params;
  const db = await getDb();
  const [view, history] = await Promise.all([dealCalculator(db, user.tenantId, id), calculationHistory(db, user.tenantId, id)]);
  return NextResponse.json({ ...view, history: history.map((h) => ({ ...h.c, by: h.by })) });
});

const price = z.string().regex(/^\d{1,13}(\.\d{1,2})?$/, "Enter the price with at most two decimals.");
const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), id: z.string().uuid().optional(), name: z.string().trim().min(2).max(60), price, config: calcConfigSchema, structureId: z.string().uuid().nullable().optional(), select: z.boolean().optional() }),
  z.object({ action: z.literal("select"), scenarioId: z.string().uuid() }),
  z.object({ action: z.literal("delete"), scenarioId: z.string().uuid() }),
]);

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const { id } = await params;
  const b = await parseBody(req, body);
  const db = await getDb();
  if (b.action === "save") {
    const sc = await saveScenario(db, user.tenantId, user, id, b);
    await audit(user, `${b.select ? "saved and selected" : "saved"} commission scenario "${sc.name}"`, { entityType: "deal", entityId: id, after: { scenario: sc.id, gross: sc.result.gross, currency: sc.result.currency } });
    return NextResponse.json({ scenario: sc }, { status: b.id ? 200 : 201 });
  }
  if (b.action === "select") {
    const sc = await selectScenario(db, user.tenantId, user, id, b.scenarioId);
    await audit(user, `selected commission scenario "${sc.name}" for closing`, { entityType: "deal", entityId: id });
    return NextResponse.json({ ok: true });
  }
  const sc = await deleteScenario(db, user.tenantId, id, b.scenarioId);
  await audit(user, `deleted commission scenario "${sc.name}"`, { entityType: "deal", entityId: id });
  return NextResponse.json({ ok: true });
});
