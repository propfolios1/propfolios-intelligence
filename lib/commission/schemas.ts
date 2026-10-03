import { z } from "zod";

/** Commission structure as created or edited in Administration. */
export const structureBody = z
  .object({
    name: z.string().min(3).max(120),
    type: z.enum(["percentage", "fixed", "tiered"]),
    ratePct: z.number().min(0).max(20).nullable().optional(),
    fixedAmount: z.number().min(0).nullable().optional(),
    currency: z.enum(["AED", "INR", "USD"]).nullable().optional(),
    tiers: z.array(z.object({ upTo: z.number().positive().nullable(), ratePct: z.number().min(0).max(20) })).max(6).default([]),
    splits: z.array(z.object({ label: z.string().min(2).max(60), role: z.enum(["senior_analyst", "analyst", "junior_analyst", "house"]).optional(), userId: z.string().uuid().optional(), pct: z.number().min(0).max(100) })).min(1).max(8),
    appliesTo: z.object({ jurisdictions: z.array(z.enum(["dubai", "abu_dhabi", "mumbai", "goa", "other"])).optional(), dealTypes: z.array(z.enum(["residential_resale", "off_plan", "co_op_resale", "freehold_villa", "commercial"])).optional(), minValue: z.number().min(0).optional() }).default({}),
    payer: z.enum(["developer", "seller", "buyer"]),
    isDefault: z.boolean().default(false),
    active: z.boolean().default(true),
  })
  .refine((v) => Math.abs(v.splits.reduce((a, x) => a + x.pct, 0) - 100) < 0.01, { message: "Splits must total 100%.", path: ["splits"] })
  .refine((v) => (v.type === "percentage" ? v.ratePct != null : v.type === "fixed" ? v.fixedAmount != null : v.tiers.length > 0), { message: "Set the rate, the fixed amount or at least one tier.", path: ["type"] });
