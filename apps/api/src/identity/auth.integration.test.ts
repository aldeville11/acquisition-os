import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { loadConfig } from "../config.js";
import { createPgliteDb } from "../db/client.js";
import { SESSION_COOKIE_NAME } from "./cookies.js";
import { SqlPlatformStore } from "../platform/sql-store.js";

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

async function bootstrapOwner(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app: any,
  cookie: string,
  userId: string
) {
  const orgRes = await app.request("/api/v1/organizations", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      name: "Demo Org",
      legalName: "Demo Org LLC",
      type: "independent",
    }),
  });
  expect(orgRes.status).toBe(201);
  const { organization } = await orgRes.json();
  const locRes = await app.request(`/api/v1/organizations/${organization.id}/locations`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ name: "Main", timezone: "UTC" }),
  });
  const { location } = await locRes.json();
  const wksRes = await app.request(`/api/v1/organizations/${organization.id}/workspaces`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ name: "WS", locationIds: [location.id] }),
  });
  const { workspace } = await wksRes.json();
  const memRes = await app.request(`/api/v1/organizations/${organization.id}/memberships`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      userId,
      workspaceId: workspace.id,
      roleKey: "owner",
    }),
  });
  expect(memRes.status).toBe(201);
  return organization.id;
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
    expect(loginBody.authContext.organizationId).toBeNull();

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

  it("invite stub requires identity.manage (owner)", async () => {
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
    const loginBody = await login.json();
    await bootstrapOwner(app, cookie, loginBody.user.id);

    const invite = await app.request("/api/v1/auth/invites", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ email: "new.ops@example.com", name: "New Ops" }),
    });
    expect(invite.status).toBe(201);
    const body = await invite.json();
    expect(body.invite.userStatus).toBe("invited");
  });

  it("rbac probe is live (ready) and denies without role", async () => {
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
    const probe = await app.request("/api/v1/auth/rbac/probe", { headers: { cookie } });
    expect(probe.status).toBe(403);
    const body = await probe.json();
    expect(body.ready).toBe(true);
    expect(body.allowed).toBe(false);
  });

  it("writes login and logout audit events", async () => {
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
    const loginBody = await login.json();
    const orgId = await bootstrapOwner(app, cookie, loginBody.user.id);

    // Re-login after membership so login audit carries organization_id
    const login2 = await app.request("/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "demo@acquisition-os.local",
        password: "ChangeMe-Demo-Only-1!",
      }),
    });
    const cookie2 = sessionCookieFrom(login2);
    await app.request("/api/v1/auth/logout", { method: "POST", headers: { cookie: cookie2 } });

    const events = await store.listAuditEvents({ organizationId: orgId });
    const actions = events.map((e) => e.action);
    expect(actions).toContain("organization.created");
    expect(actions).toContain("workspace.created");
    expect(actions).toContain("membership.assigned");
    expect(actions).toContain("login");
    expect(actions).toContain("logout");
  });
});

