import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { handle, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { previewTemplate } from "@/lib/contracts/service";

const body = z.object({ body: z.string().max(100_000), dealId: z.string().uuid().nullable().optional(), values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional() });

/** Renders a template against a deal (or the firm's values alone) without saving anything. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const b = await parseBody(req, body);
  return NextResponse.json(await previewTemplate(await getDb(), user.tenantId, b));
});
