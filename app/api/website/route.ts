import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { addPage, getEditorData, publishSite, setCustomDomain, setSeo, setTheme, verifyDomain } from "@/lib/website/service";

export const GET = handle(async () => {
  const user = await requireApiUser(["tenant_admin"]);
  return NextResponse.json(await getEditorData(await getDb(), user.tenantId));
});

const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("publish") }),
  z.object({ action: z.literal("theme"), theme: z.enum(["modern", "classic", "luxury", "minimal", "bold"]) }),
  z.object({
    action: z.literal("seo"),
    seo: z.object({ title: z.string().trim().min(5).max(70), description: z.string().trim().min(20).max(170), ogImage: z.string().url().nullable(), keywords: z.array(z.string().max(40)).max(20), index: z.boolean() }),
    contact: z.object({ email: z.string().email().nullable(), phone: z.string().max(40).nullable(), whatsapp: z.string().max(40).nullable(), address: z.string().max(200).nullable() }).optional(),
  }),
  z.object({ action: z.literal("domain"), domain: z.string().max(253).nullable() }),
  z.object({ action: z.literal("verify") }),
  z.object({ action: z.literal("add_page"), title: z.string().trim().min(2).max(60) }),
]);

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "firm:settings");
  const b = await parseBody(req, action);
  const db = await getDb();
  switch (b.action) {
    case "publish": {
      const cfg = await publishSite(db, user.tenantId);
      await audit(user, "published the website", { entityType: "website", entityId: cfg.id });
      return NextResponse.json({ publishedAt: cfg.publishedAt });
    }
    case "theme":
      await setTheme(db, user.tenantId, b.theme);
      await audit(user, `set the website theme to ${b.theme}`, { entityType: "website" });
      break;
    case "seo":
      await setSeo(db, user.tenantId, b.seo, b.contact);
      await audit(user, "updated website search settings", { entityType: "website" });
      break;
    case "domain":
      await setCustomDomain(db, user.tenantId, b.domain);
      await audit(user, b.domain ? `set the website domain to ${b.domain}` : "removed the website domain", { entityType: "website" });
      break;
    case "verify":
      return NextResponse.json({ check: await verifyDomain(db, user.tenantId) });
    case "add_page":
      return NextResponse.json({ page: await addPage(db, user.tenantId, b.title) }, { status: 201 });
  }
  return NextResponse.json({ ok: true });
});
