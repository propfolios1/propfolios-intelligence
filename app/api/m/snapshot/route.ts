import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { agentSnapshot, touchSession } from "@/lib/pwa/snapshot";

/** The offline data set, cached by the service worker. */
export const GET = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const db = await getDb();
  const snap = await agentSnapshot(db, user);
  await touchSession(db, user, req.headers.get("x-nakhla-device") ?? req.headers.get("user-agent")?.slice(0, 120) ?? "unknown", snap.version);
  return NextResponse.json(snap, { headers: { "cache-control": "private, no-store" } });
});
