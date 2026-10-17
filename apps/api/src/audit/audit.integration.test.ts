import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { loadConfig } from "../config.js";
import { createPgliteDb } from "../db/client.js";
import { SESSION_COOKIE_NAME } from "../identity/cookies.js";
import { SqlPlatformStore } from "../platform/sql-store.js";

function config() {
  return loadConfig({
    NODE_ENV: "test",
    SESSION_PEPPER: "test-session-pepper-not-for-production",
    BCRYPT_COST: "4",
    CORS_ORIGIN: "http://localhost:5173",
  });
}

function cookieFrom(response: Response): string {
  const raw = response.headers.get("set-cookie") ?? "";
  const match = raw.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  if (!match) throw new Error("missing session cookie");
  return `${SESSION_COOKIE_NAME}=${match[1]}`;
}

describe("audit event read surface", () => {
  let store: SqlPlatformStore;
  let app: Awaited<ReturnType<typeof createApp>>["app"];

  beforeEach(async () => {
    store = new SqlPlatformStore(await createPgliteDb());
    app = (await createApp({ config: config(), store, seedDemo: true })).app;
  });

  async function loginAs(roleKey: string) {
    const user = await store.findUserByEmail("demo@acquisition-os.local");
    if (!user) throw new Error("demo user missing");
    const createdAt = new Date().toISOString();
    await store.createOrganization({
      id: "org_a", name: "Org A", legalName: "Org A LLC", type: "independent",
      billingEntity: null, status: "active", createdAt,
    });
    await store.createLocation({ organizationId: "org_a" }, {
      id: "loc_a", organizationId: "org_a", name: "Location A", timezone: "UTC",
      address: null, phone: null, gbpLink: null, status: "live", createdAt,
    });
    await store.createWorkspace({ organizationId: "org_a" }, {
      id: "wks_a", organizationId: "org_a", name: "Workspace A", locationIds: ["loc_a"],
      planTier: "standard", settings: {}, status: "active", createdAt,
    });
    await store.assignMembership({ organizationId: "org_a" }, {
      id: "mem_a", userId: user.id, workspaceId: "wks_a", organizationId: "org_a",
      roleKey, locationScope: [], status: "active", createdAt,
    });
    const response = await app.request("/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "demo@acquisition-os.local",
        password: "ChangeMe-Demo-Only-1!",
      }),
    });
    expect(response.status).toBe(200);
    return cookieFrom(response);
  }

  it("denies callers without audit.read and records the enforced denial", async () => {
    const cookie = await loginAs("executive");
    const response = await app.request("/api/v1/audit/events", { headers: { cookie } });
    expect(response.status).toBe(403);

    const events = await store.listDomainEvents({ organizationId: "org_a" });
    expect(events[0]).toMatchObject({
      type: "permission.denied",
      organizationId: "org_a",
      payload: {
        permission: "audit.read",
        method: "GET",
        path: "/api/v1/audit/events",
      },
    });
  });

  it("returns newest-first own-organization events and never returns another organization", async () => {
    const cookie = await loginAs("owner");
    await store.createOrganization({
      id: "org_b", name: "Org B", legalName: "Org B LLC", type: "independent",
      billingEntity: null, status: "active", createdAt: "2026-01-01T00:00:00.000Z",
    });
    await store.appendDomainEvent({
      id: "evt_old", type: "test.old", organizationId: "org_a", workspaceId: null,
      payload: { actorUserId: "usr_a", marker: "old" }, createdAt: "2026-01-01T00:00:00.000Z",
    });
    await store.appendDomainEvent({
      id: "evt_new", type: "test.new", organizationId: "org_a", workspaceId: null,
      payload: { actorUserId: "usr_a", marker: "new" }, createdAt: "2026-01-02T00:00:00.000Z",
    });
    await store.appendDomainEvent({
      id: "evt_foreign", type: "test.foreign", organizationId: "org_b", workspaceId: null,
      payload: { actorUserId: "usr_b", marker: "foreign" }, createdAt: "2026-01-03T00:00:00.000Z",
    });

    const response = await app.request("/api/v1/audit/events?limit=100", { headers: { cookie } });
    expect(response.status).toBe(200);
    const body = await response.json();
    const ids = body.events.map((event: { id: string }) => event.id);
    expect(ids).toContain("evt_old");
    expect(ids).toContain("evt_new");
    expect(ids).not.toContain("evt_foreign");
    expect(ids.indexOf("evt_new")).toBeLessThan(ids.indexOf("evt_old"));
    expect(body.events.find((event: { id: string }) => event.id === "evt_new")).toMatchObject({
      type: "test.new",
      createdAt: "2026-01-02T00:00:00.000Z",
      payload: { actorUserId: "usr_a", marker: "new" },
    });
  });

  it("is append-only: no audit route accepts mutation methods", async () => {
    const cookie = await loginAs("owner");
    const before = await store.listDomainEvents({ organizationId: "org_a" });
    for (const method of ["POST", "PATCH", "DELETE"] as const) {
      const response = await app.request("/api/v1/audit/events", { method, headers: { cookie } });
      expect(response.status).toBe(404);
    }
    expect(await store.listDomainEvents({ organizationId: "org_a" })).toEqual(before);
  });

  it("emits users.invited and session events at their natural service points", async () => {
    const cookie = await loginAs("owner");
    const invite = await app.request("/api/v1/auth/invites", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ email: "audit-invite@example.com" }),
    });
    expect(invite.status).toBe(201);
    expect((await app.request("/api/v1/auth/logout", { method: "POST", headers: { cookie } })).status).toBe(200);

    const types = (await store.listDomainEvents({ organizationId: "org_a" }, 100)).map(
      (event) => event.type
    );
    expect(types).toEqual(expect.arrayContaining([
      "session.logged_in",
      "users.invited",
      "session.logged_out",
    ]));
  });
});
