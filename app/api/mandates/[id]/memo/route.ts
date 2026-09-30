import { NextResponse } from "next/server";
import { z } from "zod";
import { getMandate, saveMemoHtml } from "@/lib/data/store";

const body = z.object({ html: z.string().max(500_000) });

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!getMandate(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid memo" }, { status: 400 });
  saveMemoHtml(id, parsed.data.html);
  return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
}
