import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { runTaxAdvisor, taxQuote } from "@/lib/india/service";

const body = z.object({
  jurisdiction: z.enum(["mumbai", "maharashtra", "goa", "dubai", "abu_dhabi"]),
  value: z.number().positive(),
  governmentValue: z.number().positive().optional(),
  propertyType: z.enum(["residential", "commercial", "land"]).default("residential"),
  underConstruction: z.boolean().default(false),
  affordable: z.boolean().optional(),
  coOpSociety: z.boolean().optional(),
  buyer: z.object({ gender: z.enum(["male", "female", "joint_with_female", "company"]), residency: z.enum(["resident_indian", "nri", "oci", "foreign_national", "uae_resident", "company"]) }),
  seller: z.object({ residency: z.enum(["resident", "nri"]), holdingMonths: z.number().int().min(0), purchasePrice: z.number().positive().optional() }).optional(),
  buyerBrokeragePct: z.number().min(0).max(5).optional(),
  landUse: z.enum(["settlement", "orchard", "agricultural", "conservation", "commercial", "industrial"]).optional(),
  crzZone: z.enum(["none", "CRZ-I", "CRZ-II", "CRZ-III", "CRZ-IV"]).optional(),
  mundkarStatus: z.enum(["none", "claimed", "declared", "settled"]).optional(),
  comunidade: z.boolean().optional(),
  conversionStatus: z.enum(["not_required", "sanad_obtained", "applied", "required"]).optional(),
  explain: z.boolean().default(false),
  clientId: z.string().uuid().nullable().optional(),
});

/** Transaction cost quote from the rules engine; with explain=true the India tax advisor agent explains it. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const b = await parseBody(req, body);
  const { explain, clientId, ...quote } = b;
  if (!explain || quote.jurisdiction === "dubai" || quote.jurisdiction === "abu_dhabi") return NextResponse.json({ quote: taxQuote(quote) });
  const result = await runTaxAdvisor(await getDb(), user, { quote, clientId: user.role === "client" ? user.clientId : (clientId ?? null) });
  await audit(user, "ran India tax advisor", { entityType: "tax_quote", detail: { jurisdiction: quote.jurisdiction, value: quote.value, costUsd: result.run.costUsd } });
  return NextResponse.json({ quote: result.quote, advice: result.run.output, model: result.run.model, costUsd: result.run.costUsd });
});
