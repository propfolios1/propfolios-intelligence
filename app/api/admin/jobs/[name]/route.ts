import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { audit, handle } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { runJob } from "@/lib/jobs/runner";

export const maxDuration = 300;

/** Run now, from Administration > System health. Jobs span every firm, so only platform administrators may start one. */
export const POST = handle(async (_req: Request, { params }: { params: Promise<{ name: string }> }) => {
  const user = await requireApiUser();
  if (!user.platformAdmin) throw new HttpError(403, "Jobs run across every firm; only a platform administrator can start one.");
  const name = (await params).name;
  const { run } = await runJob(await getDb(), name, { trigger: "manual", actor: user.name });
  await audit(user, `ran scheduled job ${name} manually`, { entityType: "job_run", entityId: run.id, detail: { status: run.status } });
  return NextResponse.json({ run });
});
