import { NextResponse } from "next/server";
import { z } from "zod";
import { appendAudit, getMandate, setMandateStatus } from "@/lib/data/store";
import { MANDATE_STAGES, STAGE_LABEL } from "@/lib/data/types";

const body = z.object({ status: z.enum(MANDATE_STAGES) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!getMandate(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  setMandateStatus(id, parsed.data.status);
  appendAudit({ mandateId: id, actor: "Analyst", actorType: "user", action: `moved mandate to ${STAGE_LABEL[parsed.data.status]}`, detail: id });
  return NextResponse.json({ ok: true });
}
