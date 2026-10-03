import { describe, expect, it } from "vitest";
import { ACCESS_ROLES, BASE_ROLE, can, MATRIX, PERMISSIONS } from "./permissions";

describe("RBAC matrix", () => {
  it("defines eleven roles, each mapped to a base role", () => {
    expect(ACCESS_ROLES).toHaveLength(11);
    for (const r of ACCESS_ROLES) expect(BASE_ROLE[r]).toBeDefined();
  });
  it("only grants known permissions", () => {
    for (const r of ACCESS_ROLES) for (const p of MATRIX[r]) expect(PERMISSIONS[p]).toBeDefined();
  });
  it("separates duties", () => {
    expect(can("analyst", "deals:close")).toBe(false);
    expect(can("senior_analyst", "deals:close")).toBe(true);
    expect(can("compliance_officer", "kyc:decide")).toBe(true);
    expect(can("compliance_officer", "deals:manage")).toBe(false);
    expect(can("client_viewer", "portal:sign")).toBe(false);
    expect(can("tenant_admin", "firm:billing")).toBe(false);
    expect(can("tenant_owner", "firm:billing")).toBe(true);
  });
});
