import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { executeAction } from "@/lib/actions";
import { handle } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  await enforceRateLimit(user, "write");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "Action not found.");
  return NextResponse.json(await executeAction(await getDb(), user, id, process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin));
});
