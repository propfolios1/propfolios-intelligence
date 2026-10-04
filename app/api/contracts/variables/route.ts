import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { firmVariables, setFirmVariable } from "@/lib/contracts/service";

export const GET = handle(async () => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  return NextResponse.json({ variables: await firmVariables(await getDb(), user.tenantId) });
});

const body = z.object({ path: z.string().trim().min(3).max(60), label: z.string().trim().min(2).max(80), value: z.string().trim().max(500) });

export const PUT = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "firm:settings");
  const b = await parseBody(req, body);
  const v = await setFirmVariable(await getDb(), user.tenantId, b);
  await audit(user, `set contract variable ${b.path}`, { entityType: "contract_variable", entityId: v.id, after: b });
  return NextResponse.json({ variable: v });
});
