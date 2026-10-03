/** Jurisdiction context for Mumbai (Maharashtra) and Goa, injected into India-aware prompts. */

export const MAHARASHTRA_CONTEXT = `MAHARASHTRA AND MUMBAI REFERENCE FRAMEWORK (rates as configured 1 April 2026; confirm before execution)
- Stamp duty in Mumbai: 5% plus 1% metro cess = 6% for a male or joint male buyer; a sole woman buyer pays 5%. Charged on the higher of the agreement value and the Ready Reckoner (Annual Statement of Rates) value. Registration fee 1%, capped at ₹30,000.
- Ready Reckoner: published each 1 April by IGR Maharashtra by zone and sub-zone. A consideration more than 10% below it is taxed as income for the buyer (s.56(2)(x)) and as deemed consideration for the seller (s.50C).
- MahaRERA: every project with more than 8 units or 500 sq m must be registered (s.3). Quarterly Forms 1, 2 and 3. 70% of collections in the designated account. Advance capped at 10% before a registered agreement (s.13). Extensions under s.6 signal delay. Complaints and orders are public.
- Land records: 7/12 extract (Satbara) for surveyed land; property card from the City Survey Office for CTS-surveyed urban land in Mumbai. Class II occupancy needs Collector permission. "Other rights" (इतर अधिकार) shows charges (बोजा), tenants (कुळ) and restrictions.
- Index II is the registered transaction record. Encumbrance search covers 13 to 30 years.
- Co-operative housing societies: share certificate, society NOC, transfer premium capped at ₹25,000 (Model Bye-laws 38). Conveyance or deemed conveyance under MOFA s.11.
- MCGM building approvals: IOD, commencement certificate (CC), occupation certificate (OC), fire NOC. A completed building without an OC cannot be lawfully occupied and is hard to finance.
- Redevelopment: MHADA layouts, SRA schemes (rehabilitation first, free sale after), DCPR 2034 Regulation 33(7) for cessed buildings and 33(9) for cluster redevelopment. Tenant consent of 51% or more.
- DCPR 2034: permissible FSI by road width (Island City and Suburbs), premium FSI, TDR and 35% fungible area.
- GST 5% on under-construction residential (1% affordable), none on completed property with OC. TDS 1% under s.194-IA when consideration is ₹50 lakh or more; s.195 TDS when the seller is an NRI.`;

export const GOA_CONTEXT = `GOA REFERENCE FRAMEWORK (rates as configured 1 April 2026; confirm before execution)
- Stamp duty 3.5% standard, 2.5% for women buyers, on the higher of consideration and the Collector's minimum value. Registration fee 3%.
- Goa RERA registers projects and hears complaints. Many Goa villa projects fall below the RERA threshold and must be diligenced as private sales.
- Land use: Regional Plan for Goa 2021 zones (settlement S1 to S3, orchard, agricultural or paddy, natural cover, eco-sensitive, no-development slope above 25%). Only settlement and commercial zones are buildable for housing. Conversion of use needs a sanad under s.32 of the Goa Land Revenue Code; typical timeline six months or more.
- CRZ Notification 2019: CRZ-I no new construction; CRZ-II landward construction allowed; CRZ-III no-development zone up to 200 m (50 m in CRZ-IIIB) from the high tide line; CRZ-IV water area.
- Comunidades: village communities holding land under the Code of Comunidades 1961. Plots are granted on aforamento (perpetual lease, annual foro) with General Body resolution and the Administrator's approval; transfers need consent and some grants forbid alienation.
- Mundkars: the Mundkars (Protection from Eviction) Act 1975 gives a mundkar the right to the dwelling house and to purchase the dwelling plot. A pending claim prevents vacant possession.
- Form I and XIV is the record of rights: occupants, tenants (kul), mundkars, other rights, cultivation.
- Title often roots in a Portuguese-era Escritura; inherited property needs concluded inventory proceedings (Inventário), and the communion of assets regime requires the spouse's consent.
- NRIs and OCIs may not buy agricultural, orchard or plantation land. Foreign nationals not resident in India cannot buy at all.`;
