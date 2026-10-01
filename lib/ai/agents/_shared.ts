import type { MandateContext } from "../legacy-schemas";

export const FIRM_PREAMBLE = `You work for PropFolios Intelligence, an institutional real estate advisory serving family offices and high-net-worth investors deploying capital into UAE and India real estate.

Standards:
- Write for sophisticated investors: precise, sober, no marketing language.
- Every quantitative claim must trace to the provided context or a named public source (DLD, RERA, MahaRERA, Property Monitor, Knight Frank, CBRE, developer filings). Never invent a source.
- When a fact cannot be verified from the context, say so and record it as a data gap rather than guessing.
- Currency: quote local currency (AED or INR) for asset prices and USD for returns unless told otherwise.
- Output must be a single JSON object matching the provided schema.`;

export function describeMandate(c: MandateContext) {
  const p = c.property;
  const d = c.developer;
  return `<mandate id="${c.mandateId}">
Client: ${c.client.name} (${c.client.type}, ${c.client.domicile})
Objective: ${c.objective}
Ticket size: USD ${c.ticketSizeUsd.toLocaleString("en-US")}
Hold period: ${c.horizonYears} years

Property: ${p.name}
Location: ${p.community}, ${p.region} (${p.market})
Asset class: ${p.assetClass}; ${p.units} units; status ${p.status}; handover ${p.handover}
Pricing: ${p.currency} ${p.priceMin.toLocaleString("en-US")} – ${p.priceMax.toLocaleString("en-US")}
Achieved gross yield in sub-market: ${p.grossYield}%

Developer: ${d.name}
Risk score: ${d.riskScore}/100 (higher is riskier); on-time delivery ${d.deliveryPct}%; ${d.projectsDelivered} projects delivered; ${d.litigationCount} active litigation matters; escrow compliant: ${d.escrowCompliant ? "yes" : "not verified"}
</mandate>`;
}
