import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { openJson } from "@/lib/integrations/vault";
import { appOrigin } from "@/lib/integrations/origin";
import { parseTwilio } from "@/lib/whatsapp/inbound";
import { verifyTwilio, type WaCreds } from "@/lib/whatsapp/providers";
import { applyStatus, receiveInbound } from "@/lib/whatsapp/service";

const twiml = (status = 200) => new Response("<Response/>", { status, headers: { "content-type": "text/xml" } });

/** Twilio inbound messages and status callbacks, verified with X-Twilio-Signature. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const db = await getDb();
  const [account] = await db.select().from(s.whatsappAccounts).where(eq(s.whatsappAccounts.webhookToken, (await params).token));
  if (!account || account.provider !== "twilio") return twiml(404);
  const p = Object.fromEntries(new URLSearchParams(await req.text())) as Record<string, string>;
  const creds = openJson<WaCreds>(account.credentialsEncrypted);
  const u = new URL(req.url);
  const url = `${appOrigin(req)}${u.pathname}${u.search}`;
  if (!creds?.authToken || !verifyTwilio(creds.authToken, url, p, req.headers.get("x-twilio-signature"))) return twiml(403);
  const { inbound, status } = parseTwilio(p);
  if (status) await applyStatus(db, status.id, status.status, new Date(), status.error);
  if (inbound) await receiveInbound(db, account, inbound);
  return twiml();
}
