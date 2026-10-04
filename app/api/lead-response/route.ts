import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { LR_CHANNELS } from "@/db/schema-production";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { lrConfig, lrMetrics, previewReply, saveLrSettings } from "@/lib/lead-response/service";

export const GET = handle(async () => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const db = await getDb();
  const [cfg, metrics] = await Promise.all([lrConfig(db, user.tenantId), lrMetrics(db, user.tenantId)]);
  return NextResponse.json({ settings: cfg.settings, learning: cfg.learning, metrics });
});

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const settings = z.object({
  enabled: z.boolean().optional(),
  channels: z.array(z.enum(LR_CHANNELS)).optional(),
  highValueAed: z.number().int().min(100_000).max(1_000_000_000).optional(),
  viewingMinutes: z.number().int().min(15).max(180).optional(),
  handoffSlaMinutes: z.number().int().min(5).max(1440).optional(),
  signature: z.string().max(200).optional(),
  hours: z.object({ start: hhmm, end: hhmm, days: z.array(z.number().int().min(0).max(6)).min(1), timezone: z.string().min(3).max(60) }).optional(),
});

export const PATCH = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "firm:settings");
  const b = await parseBody(req, settings);
  if (b.hours) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: b.hours.timezone });
    } catch {
      return NextResponse.json({ error: `Unknown time zone "${b.hours.timezone}". Use an IANA name such as Asia/Dubai.` }, { status: 422 });
    }
    if (b.hours.end <= b.hours.start) return NextResponse.json({ error: "Closing time must be after opening time." }, { status: 422 });
  }
  const row = await saveLrSettings(await getDb(), user.tenantId, b);
  await audit(user, "updated the lead response settings", { entityType: "lead_response", detail: b });
  return NextResponse.json({ settings: row.settings });
});

const preview = z.object({ text: z.string().trim().min(1).max(2000), intent: z.enum(["buy", "rent"]).default("buy"), listingId: z.string().uuid().nullable().default(null) });

/** A dry run: nothing is sent or stored. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const b = await parseBody(req, preview);
  return NextResponse.json(await previewReply(await getDb(), user.tenantId, b));
});
