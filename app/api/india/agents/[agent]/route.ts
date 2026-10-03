import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { runGoaLandUse, runMahareraCompliance, runNriWorkflow, runReadyReckoner } from "@/lib/india/service";

export const maxDuration = 120;

const body = z.object({
  propertyId: z.string().uuid(),
  clientId: z.string().uuid().optional(),
  agreementValue: z.number().positive().optional(),
  buyerResidency: z.string().optional(),
  purpose: z.enum(["residential", "holiday_home", "land_bank"]).optional(),
  side: z.enum(["buy", "sell"]).default("buy"),
  canTravel: z.boolean().default(false),
  fundedFrom: z.enum(["nre", "nro", "fcnr", "inward_remittance", "mixed"]).default("nre"),
});

/** Runs one India agent for a property: maharera-compliance, goa-land-use, ready-reckoner or nri-workflow. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ agent: string }> }) => {
  const user = await requireApiUser(["tenant_admin", "analyst", "client"]);
  await enforceRateLimit(user, "agents");
  const { agent } = await params;
  const b = await parseBody(req, body);
  if (user.role === "client") {
    // Clients may plan their own NRI workflow and nothing else.
    if (agent !== "nri-workflow" || !user.clientId) throw new HttpError(403, "Your role does not permit this action.");
    b.clientId = user.clientId;
  }
  const db = await getDb();
  const run =
    agent === "maharera-compliance"
      ? await runMahareraCompliance(db, user, b.propertyId)
      : agent === "goa-land-use"
        ? await runGoaLandUse(db, user, b.propertyId, b.buyerResidency, b.purpose)
        : agent === "ready-reckoner"
          ? await runReadyReckoner(db, user, b.propertyId, b.agreementValue)
          : agent === "nri-workflow"
            ? b.clientId
              ? await runNriWorkflow(db, user, { clientId: b.clientId, propertyId: b.propertyId, side: b.side, canTravel: b.canTravel, fundedFrom: b.fundedFrom })
              : (() => {
                  throw new HttpError(422, "clientId is required for the NRI workflow.");
                })()
            : null;
  if (!run) throw new HttpError(404, `Unknown India agent "${agent}".`);
  await audit(user, `ran ${agent} agent`, { entityType: "property", entityId: b.propertyId, detail: { costUsd: run.costUsd, model: run.model } });
  return NextResponse.json({ output: run.output, model: run.model, costUsd: run.costUsd, replay: run.replay });
});
