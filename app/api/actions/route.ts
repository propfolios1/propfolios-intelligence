import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { createAction, listActions } from "@/lib/actions";
import { handle, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";

const KIND = z.enum(["rent_reminder", "send_memo", "schedule_follow_up", "send_dd_to_lender", "update_crm", "esign_envelope", "escalate"]);

export const GET = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const q = z.object({ mandateId: z.uuid().optional(), status: z.string().optional() }).parse(Object.fromEntries(new URL(req.url).searchParams));
  const status = q.status?.split(",").filter((x): x is "proposed" | "executed" | "reversed" | "failed" | "dismissed" => ["proposed", "executed", "reversed", "failed", "dismissed"].includes(x));
  return NextResponse.json(await listActions(await getDb(), user.tenantId, { mandateId: q.mandateId, status: status?.length ? status : undefined }));
});

/** Propose an action by hand (for example a rent reminder); it still needs executing. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const body = await parseBody(
    req,
    z.object({
      kind: KIND,
      mandateId: z.uuid().nullable().optional(),
      clientId: z.uuid().nullable().optional(),
      title: z.string().trim().min(3).max(160),
      rationale: z.string().trim().min(3).max(800),
      payload: z.object({ dueInDays: z.number().int().min(0).max(90).optional(), recipient: z.string().max(120).optional(), note: z.string().max(400).optional(), amountAed: z.number().positive().max(100_000_000).optional(), property: z.string().max(160).optional() }).default({}),
    }),
  );
  return NextResponse.json(await createAction(await getDb(), user, body), { status: 201 });
});
