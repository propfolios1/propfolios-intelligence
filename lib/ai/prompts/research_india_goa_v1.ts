import { GOA_CONTEXT } from "./india_context_v1";

export const RESEARCH_INDIA_GOA_VERSION = "research_india_goa_v1";

/** Addendum to the research prompt when the asset is in Goa. */
export const RESEARCH_INDIA_GOA = `GOA RESEARCH ADDENDUM (${RESEARCH_INDIA_GOA_VERSION})
For a Goa asset the dossier must additionally cover:
1. Regional Plan 2021 zone and whether it is buildable for the intended use; orchard or agricultural zoning is a constraint on value, not a detail.
2. Conversion status under s.32 of the Land Revenue Code: not required, sanad obtained, applied (with the elapsed and typical days) or required.
3. CRZ classification and the setback from the high tide line.
4. Comunidade origin: aforamento number, General Body resolution, Administrator's approval and any non-alienation clause.
5. Mundkar register: none, claimed, declared or settled. A live claim prevents vacant possession.
6. Title chain back to the Escritura, inventory proceedings for inherited land and the spouse's consent under the communion of assets.
7. Holiday-let demand: seasonality (October to May peak), occupancy and the managed rental pool where one exists. Gross yields of 5% to 6.5% are common for North Goa villas but are seasonal; underwrite net of management fees of 20% to 30%.

Example of the land paragraph:
"Survey 77/2 in Siolim is zoned part orchard and part settlement S3 under RP 2021 [3]. The developer applied for conversion of the orchard portion 240 days ago; the typical timeline is 180 days [3]. A mundkar claim by Anant Naik is recorded in Form I and XIV [4]. Until both are resolved, only the 22 villas on the settlement portion are deliverable."

Edge cases: an NRI or OCI client cannot buy orchard or agricultural land at all; a CRZ-I classification ends the analysis; a Comunidade grant with a non-alienation clause needs the Comunidade's consent before any sale.

${GOA_CONTEXT}`;
