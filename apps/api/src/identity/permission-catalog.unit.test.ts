import { describe, expect, it } from "vitest";
import { CONSTITUTION_ROLE_KEYS } from "./rbac.js";
import {
  effectivePermissions,
  PERMISSIONS,
  roleHasPermission,
} from "./permission-catalog.js";

describe("permission catalog", () => {
  const expectedSamples = {
    owner: [true, true, true],
    executive: [true, true, false],
    operations_manager: [true, true, true],
    csr: [true, false, false],
    sales_manager: [true, true, false],
    marketing: [true, false, false],
    read_only: [true, false, false],
    support: [true, false, false],
    administrator: [true, true, true],
  } as const;

  it("evaluates every role across read, invite, and membership-create samples", () => {
    for (const role of CONSTITUTION_ROLE_KEYS) {
      expect([
        roleHasPermission(role, "organizations.read"),
        roleHasPermission(role, "users.invite"),
        roleHasPermission(role, "memberships.create"),
      ]).toEqual(expectedSamples[role]);
    }
  });

  it("grants full current-surface access to owner and administrator", () => {
    expect(effectivePermissions("owner")).toEqual(PERMISSIONS);
    expect(effectivePermissions("administrator")).toEqual(PERMISSIONS);
  });

  it("grants audit.read only to owner and administrator", () => {
    for (const role of CONSTITUTION_ROLE_KEYS) {
      expect(roleHasPermission(role, "audit.read")).toBe(
        role === "owner" || role === "administrator"
      );
    }
  });

  it("keeps read-only roles away from mutations", () => {
    expect(roleHasPermission("read_only", "organizations.read")).toBe(true);
    expect(roleHasPermission("read_only", "organizations.create")).toBe(false);
    expect(roleHasPermission("csr", "users.invite")).toBe(false);
  });

  it("fails closed for an unknown or absent role and permission", () => {
    expect(effectivePermissions("invented_role")).toEqual([]);
    expect(effectivePermissions(null)).toEqual([]);
    expect(roleHasPermission("owner", "invented.permission")).toBe(false);
  });
});
