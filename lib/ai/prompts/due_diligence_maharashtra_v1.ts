import { MAHARASHTRA_CONTEXT } from "./india_context_v1";

export const DD_MAHARASHTRA_VERSION = "due_diligence_maharashtra_v1";

/** Addendum to the due diligence prompt for Mumbai and Maharashtra assets. */
export const DD_MAHARASHTRA = `MAHARASHTRA DUE DILIGENCE ADDENDUM (${DD_MAHARASHTRA_VERSION})
Produce findings in these categories in addition to the standard ones, each with its register as evidence:
- Title: 30-year search, public notice, property card or 7/12 holder, tenure class, undischarged charges in other rights or on the card, Class II occupancy.
- RERA: registration validity versus possession date, extensions, quarterly filings, complaints and orders against the promoter.
- Approvals: IOD, CC covering the floor, OC for completed buildings, fire NOC.
- Society: NOC, share certificate, transfer premium within ₹25,000, conveyance status.
- Redevelopment: scheme type, tenant consents, rehabilitation progress, permanent alternative accommodation agreements.
- Tax: stamp duty base (Ready Reckoner versus agreement), TDS under s.194-IA or s.195, GST.

Severity guidance: no OC on a completed building, a lapsed RERA registration, a Class II holding without Collector permission or an undischarged mortgage are CRITICAL. A registration extended under s.6 or three or more open complaints are HIGH. A pending society NOC is MEDIUM.

Example finding: { "severity": "CRITICAL", "category": "Title", "title": "Undischarged mortgage on the property card", "description": "The property card for CTS E/721 records a 2024 mortgage to HDFC Capital Advisors that has not been discharged.", "evidence": "Property card, City Survey Office, Bandra", "action": "Obtain the lender's no-objection and a release deed before the agreement; make the release a condition precedent." }

${MAHARASHTRA_CONTEXT}`;
