import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { loadConfig } from "../config.js";
import { createPgliteDb } from "../db/client.js";
import { SESSION_COOKIE_NAME } from "../identity/cookies.js";
import { SqlPlatformStore } from "../platform/sql-store.js";

function testConfig() {
  return loadConfig({ NODE_ENV: "test", SESSION_PEPPER: "test-session-pepper-not-for-production", BCRYPT_COST: "4", CORS_ORIGIN: "http://localhost:5173" });
}

function cookieFrom(res: Response): string {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const raw = typeof headers.getSetCookie === "function" ? headers.getSetCookie().join("; ") : (headers.get("set-cookie") ?? "");
  const match = raw.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  if (!match) throw new Error("missing session cookie");
  return `${SESSION_COOKIE_NAME}=${match[1]}`;
}

describe("tenancy route authorization", () => {
  let store: SqlPlatformStore;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;

  beforeEach(async () => {
    store = new SqlPlatformStore(await createPgliteDb());
    app = (await createApp({ config: testConfig(), store, seedDemo: true })).app;
  });

  async function provision(roleKey: string, locationScope: string[] = []) {
    const user = await store.findUserByEmail("demo@acquisition-os.local");
    if (!user) throw new Error("demo user missing");
    const createdAt = new Date().toISOString();
    await store.createOrganization({ id: "org_main", name: "Main Org", legalName: "Main Org LLC", type: "multi_location", billingEntity: null, status: "active", createdAt });
    for (const [id, name] of [["loc_a", "Location A"], ["loc_b", "Location B"]]) {
      await store.createLocation({ organizationId: "org_main" }, { id, organizationId: "org_main", name, timezone: "UTC", address: null, phone: null, gbpLink: null, status: "live", createdAt });
    }
    await store.createWorkspace({ organizationId: "org_main" }, { id: "wks_a", organizationId: "org_main", name: "Workspace A", locationIds: ["loc_a"], planTier: "standard", settings: {}, status: "active", createdAt });
    await store.createWorkspace({ organizationId: "org_main" }, { id: "wks_b", organizationId: "org_main", name: "Workspace B", locationIds: ["loc_b"], planTier: "standard", settings: {}, status: "active", createdAt });
    await store.assignMembership({ organizationId: "org_main" }, { id: "mem_actor", userId: user.id, workspaceId: "wks_a", organizationId: "org_main", roleKey, locationScope, status: "active", createdAt });
    await store.createUser({ id: "usr_target", email: "target@example.com", name: "Target", passwordHash: null, status: "invited", createdAt, lastSeenAt: null });
    const login = await app.request("/api/v1/auth/login", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "demo@acquisition-os.local", password: "ChangeMe-Demo-Only-1!" }),
    });
    expect(login.status).toBe(200);
    return cookieFrom(login);
  }

  async function expectForbidden(response: Response) {
    expect(response.status).toBe(403);
    expect((await response.json()).error).toMatchObject({ code: "FORBIDDEN" });
  }

  it("allows an owner across every tenancy route group", async () => {
    const cookie = await provision("owner");
    const headers = { "content-type": "application/json", cookie };
    expect((await app.request("/api/v1/organizations", { method: "POST", headers, body: JSON.stringify({ name: "New Org", legalName: "New Org LLC", type: "independent" }) })).status).toBe(201);
    expect((await app.request("/api/v1/organizations/org_main", { headers })).status).toBe(200);
    expect((await app.request("/api/v1/organizations/org_main/locations", { method: "POST", headers, body: JSON.stringify({ name: "Location C", timezone: "UTC" }) })).status).toBe(201);
    expect((await app.request("/api/v1/organizations/org_main/locations/loc_a", { headers })).status).toBe(200);
    expect((await app.request("/api/v1/organizations/org_main/workspaces", { method: "POST", headers, body: JSON.stringify({ name: "Workspace C", locationIds: ["loc_a"] }) })).status).toBe(201);
    expect((await app.request("/api/v1/organizations/org_main/workspaces/wks_a", { headers })).status).toBe(200);
    expect((await app.request("/api/v1/organizations/org_main/memberships", { method: "POST", headers, body: JSON.stringify({ userId: "usr_target", workspaceId: "wks_a", roleKey: "csr" }) })).status).toBe(201);
    expect((await app.request("/api/v1/organizations/org_main/memberships", { headers })).status).toBe(200);
  });

  it("denies missing permissions with no data changes", async () => {
    const cookie = await provision("read_only");
    const headers = { "content-type": "application/json", cookie };
    await expectForbidden(await app.request("/api/v1/organizations", { method: "POST", headers, body: JSON.stringify({ name: "Denied", legalName: "Denied LLC", type: "independent" }) }));
    await expectForbidden(await app.request("/api/v1/organizations/org_main/locations", { method: "POST", headers, body: JSON.stringify({ name: "Denied", timezone: "UTC" }) }));
    await expectForbidden(await app.request("/api/v1/organizations/org_main/workspaces", { method: "POST", headers, body: JSON.stringify({ name: "Denied", locationIds: ["loc_a"] }) }));
    await expectForbidden(await app.request("/api/v1/organizations/org_main/memberships", { method: "POST", headers, body: JSON.stringify({ userId: "usr_target", workspaceId: "wks_a", roleKey: "csr" }) }));
    await expectForbidden(await app.request("/api/v1/organizations/org_main/memberships", { headers }));
    expect((await store.listOrganizations()).map((item) => item.id)).toEqual(["org_main"]);
    expect((await store.listLocations({ organizationId: "org_main" })).map((item) => item.id).sort()).toEqual(["loc_a", "loc_b"]);
    expect((await store.listWorkspaces({ organizationId: "org_main" })).map((item) => item.id).sort()).toEqual(["wks_a", "wks_b"]);
    expect(await store.listMemberships({ organizationId: "org_main" })).toHaveLength(1);
  });

  it("enforces non-empty location scope on location and workspace routes", async () => {
    const cookie = await provision("operations_manager", ["loc_a"]);
    const headers = { "content-type": "application/json", cookie };
    expect((await app.request("/api/v1/organizations/org_main/locations/loc_a", { headers })).status).toBe(200);
    await expectForbidden(await app.request("/api/v1/organizations/org_main/locations/loc_b", { headers }));
    await expectForbidden(await app.request("/api/v1/organizations/org_main/locations", { method: "POST", headers, body: JSON.stringify({ name: "Out of scope", timezone: "UTC" }) }));
    expect((await app.request("/api/v1/organizations/org_main/workspaces/wks_a", { headers })).status).toBe(200);
    await expectForbidden(await app.request("/api/v1/organizations/org_main/workspaces/wks_b", { headers }));
    expect((await app.request("/api/v1/organizations/org_main/workspaces", { method: "POST", headers, body: JSON.stringify({ name: "Scoped", locationIds: ["loc_a"] }) })).status).toBe(201);
    await expectForbidden(await app.request("/api/v1/organizations/org_main/workspaces", { method: "POST", headers, body: JSON.stringify({ name: "Mixed", locationIds: ["loc_a", "loc_b"] }) }));
    expect(await store.listLocations({ organizationId: "org_main" })).toHaveLength(2);
    expect(await store.listWorkspaces({ organizationId: "org_main" })).toHaveLength(3);
  });

  it("empty location scope permits all workspace locations", async () => {
    const cookie = await provision("read_only", []);
    expect((await app.request("/api/v1/organizations/org_main/locations/loc_b", { headers: { cookie } })).status).toBe(200);
    expect((await app.request("/api/v1/organizations/org_main/workspaces/wks_b", { headers: { cookie } })).status).toBe(200);
  });
});
