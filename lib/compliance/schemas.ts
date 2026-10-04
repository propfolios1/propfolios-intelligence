import { z } from "zod";

/** What staff (and, within limits, the client) may change on a due diligence record. */
export const kycPatch = z.object({
  documents: z.array(z.object({ type: z.string().max(60), documentId: z.string().uuid().nullable().optional(), status: z.enum(["missing", "uploaded", "verified", "rejected"]).optional(), expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), note: z.string().max(300).nullable().optional() })).max(20).optional(),
  sourceOfFunds: z.string().trim().max(2000).nullable().optional(),
  sourceOfWealth: z.string().trim().max(2000).nullable().optional(),
  pepDeclared: z.boolean().optional(),
  beneficialOwners: z.array(z.object({ name: z.string().trim().min(2).max(120), pct: z.number().min(0).max(100), nationality: z.string().max(60).nullable(), pep: z.boolean() })).max(20).optional(),
  level: z.enum(["simplified", "standard", "enhanced"]).optional(),
});
