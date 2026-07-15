/**
 * Authorization Test Suite — mandatory CI (Sprint 3).
 * Verifies role matrix, fail-closed behavior, cross-tenant AuthZ denials,
 * and AuditEvent foundation writers.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { loadConfig } from "../config.js";
import { createPgliteDb } from "../db/client.js";
import { SESSION_COOKIE_NAME } from "../identity/cookies.js";
import { hashPassword } from "../identity/password.js";
import { can, RBAC_ROLE_KEYS, type RbacRoleKey } from "../identity/rbac.js";
import { newId } from "../identity/tokens.js";
import { SqlPlatformStore } from "../platform/sql-store.js";

function testConfig() {
  return loadConfig({
    NODE_ENV: "test",
    SESSION_PEPPER: "test-session-pepper-not-for-production",
    BCRYPT_COST: "4",
    CORS_ORIGIN: "http://localhost:5173",
  });
}

function cookieFrom(res: Response): string {
  const anyHeaders = res.headers as Headers & { getSetCookie?: () => string[] };
  const raw =
    typeof anyHeaders.getSetCookie === "function"
      ? anyHeaders.getSetCookie().join("; ")
      : (res.headers.get("set-cookie") ?? "");
  const match = raw.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  if (!match) throw new Error("missing session cookie");
  return `${SESSION_COOKIE_NAME}=${match[1]}`;
}

async function login(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app: any,
  email: string,
  password: string
) {
  const res = await app.request("/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return res;
}

describe("Authorization Test Suite", () => {
  let store: SqlPlatformStore;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  let orgId: string;
  let wksId: string;
  let locId: string;

  const passwords: Record<RbacRoleKey, string> = {
    owner: "Owner-Pass-1!",
    administrator: "Admin-Pass-1!",
    manager: "Manager-Pass-1!",
    operator: "Operator-Pass-1!",
    viewer: "Viewer-Pass-1!",
  };

  const cookies: Partial<Record<RbacRoleKey, string>> = {};

  beforeEach(async () => {
    const db = await createPgliteDb();
    store = new SqlPlatformStore(db);
    const created = await createApp({ config: testConfig(), store, seedDemo: false });
    app = created.app;

    const now = new Date().toISOString();
    const ownerUser = await store.createUser({
      id: newId("usr"),
      email: "owner@authz.test",
      name: "Owner",
      passwordHash: await hashPassword(passwords.owner, 4),
      status: "active",
      createdAt: now,
      lastSeenAt: null,
    });

    const org = await store.createOrganization({
      id: newId("org"),
      name: "AuthZ Org",
      legalName: "AuthZ Org LLC",
      type: "independent",
      billingEntity: null,
      status: "active",
      createdAt: now,
    });
    orgId = org.id;

    const loc = await store.createLocation(
      { organizationId: orgId },
      {
        id: newId("loc"),
        organizationId: orgId,
        name: "HQ",
        timezone: "UTC",
        address: null,
        phone: null,
        gbpLink: null,
        status: "live",
        createdAt: now,
      }
    );
    locId = loc.id;

    const wks = await store.createWorkspace(
      { organizationId: orgId },
      {
        id: newId("wks"),
        organizationId: orgId,
        name: "Primary",
        locationIds: [locId],
        planTier: "standard",
        settings: {},
        status: "active",
        createdAt: now,
      }
    );
    wksId = wks.id;

    await store.assignMembership(
      { organizationId: orgId },
      {
        id: newId("mem"),
        userId: ownerUser.id,
        workspaceId: wksId,
        organizationId: orgId,
        roleKey: "owner",
        locationScope: [],
        status: "active",
        createdAt: now,
      }
    );

    for (const role of RBAC_ROLE_KEYS) {
      if (role === "owner") continue;
      const user = await store.createUser({
        id: newId("usr"),
        email: `${role}@authz.test`,
        name: role,
        passwordHash: await hashPassword(passwords[role], 4),
        status: "active",
        createdAt: now,
        lastSeenAt: null,
      });
      await store.assignMembership(
        { organizationId: orgId },
        {
          id: newId("mem"),
          userId: user.id,
          workspaceId: wksId,
          organizationId: orgId,
          roleKey: role,
          locationScope: [],
          status: "active",
          createdAt: now,
        }
      );
    }

    for (const role of RBAC_ROLE_KEYS) {
      const res = await login(app, `${role}@authz.test`, passwords[role]);
      expect(res.status).toBe(200);
      cookies[role] = cookieFrom(res);
    }
  });

  it("matrix: owner can update organization; viewer cannot", async () => {
    const ownerRes = await app.request(`/api/v1/organizations/${orgId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: cookies.owner! },
      body: JSON.stringify({ name: "AuthZ Org Renamed" }),
    });
    expect(ownerRes.status).toBe(200);

    const viewerRes = await app.request(`/api/v1/organizations/${orgId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: cookies.viewer! },
      body: JSON.stringify({ name: "Nope" }),
    });
    expect(viewerRes.status).toBe(403);
    const body = await viewerRes.json();
    expect(body.error.code).toBe("PERMISSION_DENIED");
  });

  it("matrix: administrator can identity.manage; manager cannot", async () => {
    expect(can("administrator", "identity.manage")).toBe(true);
    expect(can("manager", "identity.manage")).toBe(false);

    const adminProbe = await app.request("/api/v1/auth/rbac/probe", {
      headers: { cookie: cookies.administrator! },
    });
    expect(adminProbe.status).toBe(200);
    expect((await adminProbe.json()).allowed).toBe(true);

    const mgrProbe = await app.request("/api/v1/auth/rbac/probe", {
      headers: { cookie: cookies.manager! },
    });
    expect(mgrProbe.status).toBe(403);
    expect((await mgrProbe.json()).allowed).toBe(false);
  });

  it("matrix: manager can manage memberships; operator cannot", async () => {
    const target = await store.createUser({
      id: newId("usr"),
      email: "temp@authz.test",
      name: "Temp",
      passwordHash: await hashPassword("Temp-Pass-1!", 4),
      status: "active",
      createdAt: new Date().toISOString(),
      lastSeenAt: null,
    });

    const mgr = await app.request(`/api/v1/organizations/${orgId}/memberships`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookies.manager! },
      body: JSON.stringify({
        userId: target.id,
        workspaceId: wksId,
        roleKey: "viewer",
      }),
    });
    expect(mgr.status).toBe(201);

    const target2 = await store.createUser({
      id: newId("usr"),
      email: "temp2@authz.test",
      name: "Temp2",
      passwordHash: await hashPassword("Temp-Pass-1!", 4),
      status: "active",
      createdAt: new Date().toISOString(),
      lastSeenAt: null,
    });
    const op = await app.request(`/api/v1/organizations/${orgId}/memberships`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookies.operator! },
      body: JSON.stringify({
        userId: target2.id,
        workspaceId: wksId,
        roleKey: "viewer",
      }),
    });
    expect(op.status).toBe(403);
  });

  it("matrix: operator can create locations; viewer cannot", async () => {
    const op = await app.request(`/api/v1/organizations/${orgId}/locations`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookies.operator! },
      body: JSON.stringify({ name: "Ops Loc", timezone: "UTC" }),
    });
    expect(op.status).toBe(201);

    const viewer = await app.request(`/api/v1/organizations/${orgId}/locations`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookies.viewer! },
      body: JSON.stringify({ name: "Viewer Loc", timezone: "UTC" }),
    });
    expect(viewer.status).toBe(403);
  });

  it("matrix: viewer can read organization", async () => {
    const res = await app.request(`/api/v1/organizations/${orgId}`, {
      headers: { cookie: cookies.viewer! },
    });
    expect(res.status).toBe(200);
  });

  it("fail-closed: unknown permission never grants", () => {
    expect(can("owner", "invented.permission")).toBe(false);
  });

  it("cross-tenant authorization failures", async () => {
    const now = new Date().toISOString();
    const orgB = await store.createOrganization({
      id: newId("org"),
      name: "Other",
      legalName: "Other LLC",
      type: "independent",
      billingEntity: null,
      status: "active",
      createdAt: now,
    });
    const res = await app.request(`/api/v1/organizations/${orgB.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: cookies.owner! },
      body: JSON.stringify({ name: "Hijack" }),
    });
    expect(res.status).toBe(403);
  });

  it("missing permission failures audited", async () => {
    await app.request(`/api/v1/organizations/${orgId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: cookies.viewer! },
      body: JSON.stringify({ name: "Nope" }),
    });
    const events = await store.listAuditEvents({ organizationId: orgId });
    expect(events.some((e) => e.action === "permission.denied")).toBe(true);
  });

  it("audit foundation: login + organization.updated + permission.granted", async () => {
    await app.request(`/api/v1/organizations/${orgId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: cookies.owner! },
      body: JSON.stringify({ name: "Audited Name" }),
    });
    const events = await store.listAuditEvents({ organizationId: orgId });
    const actions = events.map((e) => e.action);
    expect(actions).toContain("login");
    expect(actions).toContain("organization.updated");
    expect(actions).toContain("permission.granted");
  });

  it("permission inheritance holds for key capabilities", () => {
    expect(can("owner", "memberships.manage")).toBe(true);
    expect(can("administrator", "memberships.manage")).toBe(true);
    expect(can("manager", "memberships.manage")).toBe(true);
    expect(can("operator", "memberships.manage")).toBe(false);
    expect(can("viewer", "memberships.manage")).toBe(false);
  });
});
