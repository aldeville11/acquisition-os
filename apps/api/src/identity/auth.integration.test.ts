import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { loadConfig } from "../config.js";
import { createPgliteDb } from "../db/client.js";
import { SESSION_COOKIE_NAME } from "./cookies.js";
import { SqlPlatformStore } from "../platform/sql-store.js";

async function grantDemoRole(
  store: SqlPlatformStore,
  roleKey: string,
  locationScope: string[] = []
) {
  const user = await store.findUserByEmail("demo@acquisition-os.local");
  if (!user) throw new Error("demo user missing");
  const createdAt = new Date().toISOString();
  const organizationId = `org_${roleKey}`;
  const locationId = `loc_${roleKey}`;
  const workspaceId = `wks_${roleKey}`;
  await store.createOrganization({
    id: organizationId,
    name: "Test Org",
    legalName: "Test Org LLC",
    type: "independent",
    billingEntity: null,
    status: "active",
    createdAt,
  });
  await store.createLocation({ organizationId }, {
    id: locationId,
    organizationId,
    name: "Test Location",
    timezone: "UTC",
    address: null,
    phone: null,
    gbpLink: null,
    status: "live",
    createdAt,
  });
  await store.createWorkspace({ organizationId }, {
    id: workspaceId,
    organizationId,
    name: "Test Workspace",
    locationIds: [locationId],
    planTier: "standard",
    settings: {},
    status: "active",
    createdAt,
  });
  await store.assignMembership({ organizationId }, {
    id: `mem_${roleKey}`,
    userId: user.id,
    workspaceId,
    organizationId,
    roleKey,
    locationScope,
    status: "active",
    createdAt,
  });
}

function testConfig() {
  return loadConfig({
    NODE_ENV: "test",
    SESSION_PEPPER: "test-session-pepper-not-for-production",
    BCRYPT_COST: "4",
    CORS_ORIGIN: "http://localhost:5173",
    API_PORT: "3001",
  });
}

function getSetCookie(res: Response): string {
  const anyHeaders = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") {
    return anyHeaders.getSetCookie().join("; ");
  }
  return res.headers.get("set-cookie") ?? "";
}

function sessionCookieFrom(res: Response): string {
  const raw = getSetCookie(res);
  const match = raw.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  if (!match) throw new Error(`No ${SESSION_COOKIE_NAME} in ${raw}`);
  return `${SESSION_COOKIE_NAME}=${match[1]}`;
}

describe("auth integration (postgres-backed store)", () => {
  let store: SqlPlatformStore;

  beforeEach(async () => {
    const db = await createPgliteDb();
    store = new SqlPlatformStore(db);
  });

  it("login → me → logout round-trip", async () => {
    const { app } = await createApp({
      config: testConfig(),
      store,
      seedDemo: true,
    });
    await grantDemoRole(store, "owner");

    const login = await app.request("/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "demo@acquisition-os.local",
        password: "ChangeMe-Demo-Only-1!",
      }),
    });
    expect(login.status).toBe(200);
    const loginBody = await login.json();
    expect(loginBody.user.email).toBe("demo@acquisition-os.local");
    expect(loginBody.authContext.organizationId).toBe("org_owner");

    const cookie = sessionCookieFrom(login);

    const me = await app.request("/api/v1/auth/me", { headers: { cookie } });
    expect(me.status).toBe(200);

    const logout = await app.request("/api/v1/auth/logout", {
      method: "POST",
      headers: { cookie },
    });
    expect(logout.status).toBe(200);

    const meAfter = await app.request("/api/v1/auth/me", { headers: { cookie } });
    expect(meAfter.status).toBe(401);
  });

  it("rejects bad password", async () => {
    const { app } = await createApp({ config: testConfig(), store, seedDemo: true });
    await grantDemoRole(store, "owner");
    const res = await app.request("/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "demo@acquisition-os.local",
        password: "wrong-password",
      }),
    });
    expect(res.status).toBe(401);
  });

  it("invite stub creates invited user without tenancy", async () => {
    const { app } = await createApp({ config: testConfig(), store, seedDemo: true });
    await grantDemoRole(store, "owner");
    const login = await app.request("/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "demo@acquisition-os.local",
        password: "ChangeMe-Demo-Only-1!",
      }),
    });
    const cookie = sessionCookieFrom(login);
    const invite = await app.request("/api/v1/auth/invites", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ email: "new.ops@example.com", name: "New Ops" }),
    });
    expect(invite.status).toBe(201);
    const body = await invite.json();
    expect(body.invite.userStatus).toBe("invited");
  });

  it("rbac probe returns the caller's effective permissions", async () => {
    const { app } = await createApp({ config: testConfig(), store, seedDemo: true });
    await grantDemoRole(store, "owner");
    const login = await app.request("/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "demo@acquisition-os.local",
        password: "ChangeMe-Demo-Only-1!",
      }),
    });
    const cookie = sessionCookieFrom(login);
    const probe = await app.request("/api/v1/auth/rbac/probe", { headers: { cookie } });
    expect(probe.status).toBe(200);
    const body = await probe.json();
    expect(body.permissions).toContain("auth.read");
  });

  it("denies protected identity routes without catalog grants and does not invite", async () => {
    const { app } = await createApp({ config: testConfig(), store, seedDemo: true });
    const login = await app.request("/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "demo@acquisition-os.local",
        password: "ChangeMe-Demo-Only-1!",
      }),
    });
    const cookie = sessionCookieFrom(login);

    for (const [path, method] of [
      ["/api/v1/auth/me", "GET"],
      ["/api/v1/auth/logout", "POST"],
      ["/api/v1/auth/rbac/probe", "GET"],
    ] as const) {
      const response = await app.request(path, { method, headers: { cookie } });
      expect(response.status).toBe(403);
      expect((await response.json()).error.code).toBe("FORBIDDEN");
    }

    const invite = await app.request("/api/v1/auth/invites", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ email: "denied@example.com" }),
    });
    expect(invite.status).toBe(403);
    expect((await invite.json()).error.code).toBe("FORBIDDEN");
    expect(await store.findUserByEmail("denied@example.com")).toBeNull();
  });
});
