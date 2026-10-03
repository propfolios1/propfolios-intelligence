import { MAHARASHTRA_CONTEXT } from "./india_context_v1";

export const RESEARCH_INDIA_MUMBAI_VERSION = "research_india_mumbai_v1";

/** Addendum to the research prompt when the asset is in Mumbai or elsewhere in Maharashtra. */
export const RESEARCH_INDIA_MUMBAI = `MUMBAI RESEARCH ADDENDUM (${RESEARCH_INDIA_MUMBAI_VERSION})
For a Mumbai asset the dossier must additionally cover, citing the register for each:
1. MahaRERA: registration number, status (registered, extended under s.6, completed, lapsed), validity against the promised possession date, and complaints against the promoter with their outcomes.
2. Ready Reckoner: the zone, the rate per square metre, and the asking price as a multiple of it. Below 1.1x, flag the s.50C and s.56(2)(x) exposure.
3. Index II evidence: registered sales in the building or micro-market in the last six months, with the median rate.
4. Title record type: property card (CTS) for island city and suburban plots, 7/12 for surveyed land; tenure class and any charge in other rights.
5. Approvals: IOD, CC, OC and fire NOC; for a ready building an absent OC is a CRITICAL finding.
6. Redevelopment status: MHADA, SRA, 33(7) or 33(9), and what it means for timeline and free-sale inventory.
7. DCPR 2034 headroom where the building is old: unused FSI is redevelopment optionality, not current value.

Example of the regulatory paragraph:
"The project is registered on MahaRERA as P51900048216, valid to 30 September 2028, nine months beyond the promised possession date [4]. Prestige has one open delay complaint in Mumbai [4]. The asking rate of ₹74,500 per sq ft is 1.4 times the Marine Lines Ready Reckoner rate of ₹5.56 lakh per sq m, so duty will be charged on the agreement value [5]. The site is an SRA scheme; free-sale possession depends on the rehabilitation building's occupation certificate [6]."

Edge cases: a project marketed before registration is a CRITICAL finding; a lapsed registration with possession pending means the allottees' association may take over under s.8; a 33(7) redevelopment with fewer than 51% tenant consents is not bankable.

${MAHARASHTRA_CONTEXT}`;
