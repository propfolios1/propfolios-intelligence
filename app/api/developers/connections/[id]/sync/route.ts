import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { audit, handle } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { syncConnection } from "@/lib/developers/sync";

/** Syncs now. An upload connection takes the price list as multipart "file" (CSV, JSON or XML, up to 10 MB). */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(["tenant_admin"]);
  const { id } = await params;
  let upload: { body: string; format: "csv" | "json" | "xml" } | undefined;
  if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const f = (await req.formData()).get("file");
    if (!(f instanceof File)) throw new HttpError(422, "Attach the price list.");
    if (f.size > 10 * 1024 * 1024) throw new HttpError(413, "Files must be 10 MB or smaller.");
    const name = f.name.toLowerCase();
    const format = name.endsWith(".json") ? "json" : name.endsWith(".xml") ? "xml" : name.endsWith(".csv") || name.endsWith(".txt") ? "csv" : null;
    if (!format) throw new HttpError(415, "Upload a CSV, JSON or XML file. Save spreadsheets as CSV first.");
    upload = { body: await f.text(), format };
  }
  const run = await syncConnection(await getDb(), user.tenantId, id, { upload });
  await audit(user, `synced developer inventory${upload ? " from an upload" : ""}: ${run.ok ? `${run.units} units` : run.error}`, { entityType: "developer_connection", entityId: id, after: run });
  return NextResponse.json({ run }, { status: run.ok ? 200 : 422 });
});
