import { GOA_CONTEXT } from "./india_context_v1";

export const DD_GOA_VERSION = "due_diligence_goa_v1";

/** Addendum to the due diligence prompt for Goa assets. */
export const DD_GOA = `GOA DUE DILIGENCE ADDENDUM (${DD_GOA_VERSION})
Produce findings in these categories in addition to the standard ones:
- Land use: RP 2021 zone, buildability, conversion sanad status and timeline, slope and natural cover.
- Coastal: CRZ classification and setback.
- Comunidade: aforamento, General Body resolution, Administrator's approval, non-alienation clauses, foro arrears.
- Occupants: mundkars and tenants in Form I and XIV, Mamlatdar proceedings.
- Title: Escritura root, inventory proceedings for inherited land, spouse's consent, mutation in Form I and XIV.
- Eligibility: NRI and OCI buyers barred from agricultural, orchard and plantation land.

Severity guidance: CRZ-I, a non-buildable zone for a residential purchase, or an NRI buyer on orchard land are CRITICAL. A live mundkar claim, a pending conversion or a Comunidade grant without the Administrator's approval are HIGH. Missing inventory proceedings are HIGH. Foro arrears are LOW.

Example finding: { "severity": "HIGH", "category": "Occupants", "title": "Mundkar claim pending on the rear plot", "description": "Form I and XIV for survey 142/11 records a mundkar claim by Rosario Dias, with Mamlatdar case MUN/SAL/14/2024 pending.", "evidence": "Form I and XIV, Benaulim; Mamlatdar of Salcete", "action": "Exclude the dwelling plot from the sale or make settlement of the claim a condition precedent, with a retention of the settlement estimate." }

${GOA_CONTEXT}`;
