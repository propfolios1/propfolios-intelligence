import "@/lib/lead-response/install";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { parseCloud } from "@/lib/whatsapp/inbound";
import { applyStatus, receiveInbound } from "@/lib/whatsapp/service";

/** 360dialog webhooks (Cloud API format). 360dialog does not sign webhooks, so the URL carries a random per-firm token. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const db = await getDb();
  const [account] = await db.select().from(s.whatsappAccounts).where(eq(s.whatsappAccounts.webhookToken, (await params).token));
  if (!account || account.provider !== "360dialog") return NextResponse.json({ error: "Unknown webhook." }, { status: 404 });
  const { inbound, statuses } = parseCloud(await req.json().catch(() => ({})));
  for (const st of statuses) await applyStatus(db, st.id, st.status, st.at, st.error);
  for (const m of inbound) await receiveInbound(db, account, m);
  return NextResponse.json({ received: inbound.length, statuses: statuses.length });
}
