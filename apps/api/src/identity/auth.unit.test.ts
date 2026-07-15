import { describe, expect, it } from "vitest";
import {
  buildSessionCookie,
  clearSessionCookie,
  readCookie,
  SESSION_COOKIE_NAME,
} from "./cookies.js";
import { hashPassword, verifyPassword } from "./password.js";
import {
  assertPermission,
  can,
  CONSTITUTION_ROLE_KEYS,
  isAuthenticated,
  PermissionDeniedError,
  permissionsForRole,
  RBAC_PERMISSIONS,
  RBAC_ROLE_KEYS,
  toAuthContext,
} from "./rbac.js";
import { generateSessionToken, hashSessionToken } from "./tokens.js";

describe("password", () => {
  it("hashes and verifies with bcrypt", async () => {
    const hash = await hashPassword("secret-value", 4);
    expect(hash).not.toContain("secret-value");
    expect(await verifyPassword("secret-value", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});

describe("session tokens", () => {
  it("hashes with HMAC-SHA-256 pepper (ADR 0002)", () => {
    const token = generateSessionToken();
    const a = hashSessionToken(token, "pepper-a");
    const b = hashSessionToken(token, "pepper-b");
    expect(a).toHaveLength(64);
    expect(a).not.toBe(token);
    expect(a).not.toBe(b);
  });
});

describe("cookies", () => {
  it("builds aos_session with HttpOnly SameSite=Lax", () => {
    const cookie = buildSessionCookie("tok123", { secure: true, maxAgeSeconds: 3600 });
    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=tok123`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("Max-Age=3600");
  });

  it("omits Secure outside production flags", () => {
    const cookie = buildSessionCookie("tok", { secure: false, maxAgeSeconds: 1 });
    expect(cookie).not.toContain("Secure");
  });

  it("clears cookie and reads from header", () => {
    const cleared = clearSessionCookie(false);
    expect(cleared).toContain("Max-Age=0");
    expect(readCookie(`${SESSION_COOKIE_NAME}=abc; other=1`, SESSION_COOKIE_NAME)).toBe("abc");
    expect(readCookie(undefined, SESSION_COOKIE_NAME)).toBeNull();
  });
});

describe("rbac vocabulary + matrix", () => {
  it("exposes locked role + permission vocabulary", () => {
    expect(RBAC_ROLE_KEYS).toEqual([
      "owner",
      "administrator",
      "manager",
      "operator",
      "viewer",
    ]);
    expect(CONSTITUTION_ROLE_KEYS).toEqual(RBAC_ROLE_KEYS);
    expect(RBAC_PERMISSIONS).toContain("identity.manage");
    expect(RBAC_PERMISSIONS).toContain("system.admin");
    expect(RBAC_PERMISSIONS).not.toContain("users.invite");
  });

  it("owner has system.admin; others do not", () => {
    expect(can("owner", "system.admin")).toBe(true);
    expect(can("administrator", "system.admin")).toBe(false);
    expect(can("manager", "system.admin")).toBe(false);
    expect(can("operator", "system.admin")).toBe(false);
    expect(can("viewer", "system.admin")).toBe(false);
  });

  it("permission inheritance: owner ⊃ administrator ⊃ manager ⊃ operator ⊃ viewer", () => {
    const viewer = new Set(permissionsForRole("viewer"));
    const operator = new Set(permissionsForRole("operator"));
    const manager = new Set(permissionsForRole("manager"));
    const administrator = new Set(permissionsForRole("administrator"));
    const owner = new Set(permissionsForRole("owner"));

    for (const p of viewer) {
      if (p === "audit.read") {
        expect(manager.has(p)).toBe(true);
        continue;
      }
      expect(operator.has(p)).toBe(true);
    }
    for (const p of operator) expect(manager.has(p)).toBe(true);
    for (const p of manager) expect(administrator.has(p)).toBe(true);
    for (const p of administrator) expect(owner.has(p)).toBe(true);
  });

  it("unknown permission and unknown role deny", () => {
    expect(can("owner", "not.a.real.permission")).toBe(false);
    expect(can("executive", "organizations.read")).toBe(false);
    expect(can(null, "organizations.read")).toBe(false);
  });

  it("builds AuthContext with membership tenancy when provided", () => {
    const ctx = toAuthContext({
      userId: "usr_1",
      email: "a@b.c",
      status: "active",
      sessionId: "ses_1",
      organizationId: "org_1",
      workspaceId: "wks_1",
      role: "owner",
      locationScope: ["loc_1"],
    });
    expect(ctx.organizationId).toBe("org_1");
    expect(ctx.workspaceId).toBe("wks_1");
    expect(ctx.role).toBe("owner");
    expect(ctx.locationScope).toEqual(["loc_1"]);
    expect(isAuthenticated(ctx)).toBe(true);
  });

  it("assertPermission allows owner identity.manage and denies viewer", () => {
    const owner = toAuthContext({
      userId: "usr_1",
      email: "a@b.c",
      status: "active",
      sessionId: "ses_1",
      organizationId: "org_1",
      role: "owner",
    });
    expect(() => assertPermission(owner, "identity.manage")).not.toThrow();

    const viewer = toAuthContext({
      userId: "usr_2",
      email: "v@b.c",
      status: "active",
      sessionId: "ses_2",
      organizationId: "org_1",
      role: "viewer",
    });
    expect(() => assertPermission(viewer, "identity.manage")).toThrow(PermissionDeniedError);
  });

  it("assertPermission fail-closed for missing role", () => {
    const ctx = toAuthContext({
      userId: "usr_1",
      email: "a@b.c",
      status: "active",
      sessionId: "ses_1",
    });
    expect(() => assertPermission(ctx, "organizations.read")).toThrow(PermissionDeniedError);
  });

  it("bootstrap org create allowed without membership", () => {
    const ctx = toAuthContext({
      userId: "usr_1",
      email: "a@b.c",
      status: "active",
      sessionId: "ses_1",
    });
    expect(() =>
      assertPermission(ctx, "organizations.create", { bootstrapOrgCreate: true })
    ).not.toThrow();
  });
});
