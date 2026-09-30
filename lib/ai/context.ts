import "server-only";
import { getMandateView } from "@/lib/data/store";
import type { MandateContext } from "./schemas";

export function buildMandateContext(mandateId: string): MandateContext | undefined {
  const v = getMandateView(mandateId);
  if (!v) return undefined;
  const { mandate: m, client: c, property: p, developer: d } = v;
  return {
    mandateId: m.id,
    client: { name: c.name, type: c.type, domicile: c.domicile },
    objective: m.objective,
    ticketSizeUsd: m.ticketSize,
    horizonYears: m.horizonYears,
    property: {
      name: p.name,
      market: p.market,
      region: p.region,
      community: p.community,
      assetClass: p.assetClass,
      status: p.status,
      handover: p.handover,
      currency: p.currency,
      priceMin: p.priceMin,
      priceMax: p.priceMax,
      units: p.units,
      grossYield: p.grossYield,
    },
    developer: {
      name: d.name,
      riskScore: d.riskScore,
      deliveryPct: d.deliveryPct,
      litigationCount: d.litigationCount,
      projectsDelivered: d.projectsDelivered,
      escrowCompliant: d.escrowCompliant,
    },
  };
}
