import { NextResponse } from "next/server";
import { appendAudit, resetRuntime } from "@/lib/data/store";

/** Resets runtime state (agent outputs, status moves, memo edits) back to seed data. */
export async function POST() {
  resetRuntime();
  appendAudit({ actor: "Administrator", actorType: "system", action: "re-seeded demo data" });
  return NextResponse.json({ ok: true });
}
