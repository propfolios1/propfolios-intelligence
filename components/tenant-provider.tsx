"use client";

import * as React from "react";
import type { TenantConfig } from "@/db/schema";

export interface TenantBrand {
  tenantId: string | null;
  slug: string | null;
  name: string;
  plan: string | null;
  config: TenantConfig;
}

const TenantContext = React.createContext<TenantBrand | null>(null);

/** Makes the current tenant's brand available to every client component. */
export function TenantProvider({ brand, children }: { brand: TenantBrand; children: React.ReactNode }) {
  return <TenantContext.Provider value={brand}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const t = React.useContext(TenantContext);
  if (!t) throw new Error("useTenant must be used inside TenantProvider");
  return t;
}
