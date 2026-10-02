import "server-only";
import { notFound } from "next/navigation";
import type { TenantConfig } from "@/db/schema";
import type { CurrentUser } from "./auth";
import { getTenantById } from "./tenant";

export type Feature = keyof TenantConfig["features"];

export async function tenantFeatures(tenantId: string) {
  const t = await getTenantById(tenantId);
  return t?.configJson.features ?? { assistant: true, clientPortal: true, marketTiming: true, crossBorder: true };
}

/** 404 when the tenant has this feature switched off. */
export async function requireFeature(user: CurrentUser, feature: Feature) {
  const f = await tenantFeatures(user.tenantId);
  if (f[feature] === false) notFound();
}
