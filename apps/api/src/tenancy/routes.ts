import { Hono } from "hono";
import { z } from "zod";
import type { AuditService } from "../audit/service.js";
import type { AuthService } from "../identity/auth-service.js";
import { AuthError } from "../identity/auth-service.js";
import { authorize } from "../identity/authorize.js";
import { isAuthenticated } from "../identity/rbac.js";
import type { AuthContext } from "../identity/types.js";
import type { PlatformStore } from "../platform/types.js";
import type { TenancyService } from "./service.js";

type Variables = { auth: AuthContext | null };

const orgSchema = z.object({
  name: z.string().min(1).max(200),
  legalName: z.string().min(1).max(300),
  type: z.enum(["independent", "multi_location", "franchise", "pe_portfolio", "partner"]),
  billingEntity: z.string().max(300).optional(),
  status: z.enum(["prospect", "active", "suspended", "churned"]).optional(),
});

const orgUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  legalName: z.string().min(1).max(300).optional(),
  billingEntity: z.string().max(300).nullable().optional(),
  status: z.enum(["prospect", "active", "suspended", "churned"]).optional(),
});

const locationSchema = z.object({
  name: z.string().min(1).max(200),
  timezone: z.string().min(1).max(100),
  address: z.string().max(500).optional(),
  phone: z.string().max(50).optional(),
  gbpLink: z.string().max(500).optional(),
  status: z.enum(["setup", "live", "paused", "closed"]).optional(),
});

const workspaceSchema = z.object({
  name: z.string().min(1).max(200),
  locationIds: z.array(z.string().min(1)).min(1),
  planTier: z.string().max(50).optional(),
  status: z.enum(["provisioning", "active", "locked"]).optional(),
});

const workspaceUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  planTier: z.string().max(50).optional(),
  status: z.enum(["provisioning", "active", "locked"]).optional(),
});

const membershipSchema = z.object({
  userId: z.string().min(1),
  workspaceId: z.string().min(1),
  roleKey: z.string().min(1),
  locationScope: z.array(z.string()).optional(),
  status: z.enum(["invited", "active", "revoked"]).optional(),
});

export function createTenancyRoutes(deps: {
  auth: AuthService;
  tenancy: TenancyService;
  store: PlatformStore;
  audit: AuditService;
}) {
  const app = new Hono<{ Variables: Variables }>();

  app.use("*", async (c, next) => {
    const auth = await deps.auth.resolveSession(c.req.header("cookie"));
    c.set("auth", auth);
    await next();
  });

  app.post("/organizations", async (c) => {
    try {
      const actor = requireActor(c.get("auth"));
      await authorize(deps.audit, actor, "organizations.create", {
        bootstrapOrgCreate: true,
      });
      const body = orgSchema.safeParse(await c.req.json().catch(() => null));
      if (!body.success) {
        return c.json({ error: { code: "INVALID_BODY", message: "Invalid organization payload" } }, 400);
      }
      const organization = await deps.tenancy.createOrganization(actor, body.data);
      return c.json({ organization }, 201);
    } catch (err) {
      return mapErr(c, err);
    }
  });

  app.get("/organizations/:organizationId", async (c) => {
    try {
      const actor = requireActor(c.get("auth"));
      await authorize(deps.audit, actor, "organizations.read");
      await deps.tenancy.resolveTenant(actor, c.req.param("organizationId"));
      const organization = await deps.store.getOrganization(c.req.param("organizationId"));
      if (!organization) {
        return c.json({ error: { code: "NOT_FOUND", message: "Organization not found." } }, 404);
      }
      return c.json({ organization });
    } catch (err) {
      return mapErr(c, err);
    }
  });

  app.patch("/organizations/:organizationId", async (c) => {
    try {
      const actor = requireActor(c.get("auth"));
      await authorize(deps.audit, actor, "organizations.update");
      const body = orgUpdateSchema.safeParse(await c.req.json().catch(() => null));
      if (!body.success) {
        return c.json({ error: { code: "INVALID_BODY", message: "Invalid organization update" } }, 400);
      }
      const organization = await deps.tenancy.updateOrganization(
        actor,
        c.req.param("organizationId"),
        body.data
      );
      return c.json({ organization });
    } catch (err) {
      return mapErr(c, err);
    }
  });

  app.post("/organizations/:organizationId/locations", async (c) => {
    try {
      const actor = requireActor(c.get("auth"));
      await authorize(deps.audit, actor, "locations.create", {
        activationBootstrap: true,
      });
      const body = locationSchema.safeParse(await c.req.json().catch(() => null));
      if (!body.success) {
        return c.json({ error: { code: "INVALID_BODY", message: "Invalid location payload" } }, 400);
      }
      const location = await deps.tenancy.createLocation(
        actor,
        c.req.param("organizationId"),
        body.data
      );
      return c.json({ location }, 201);
    } catch (err) {
      return mapErr(c, err);
    }
  });

  app.get("/organizations/:organizationId/locations/:locationId", async (c) => {
    try {
      const actor = requireActor(c.get("auth"));
      await authorize(deps.audit, actor, "locations.read", {
        locationId: c.req.param("locationId"),
      });
      const location = await deps.tenancy.getLocation(
        actor,
        c.req.param("organizationId"),
        c.req.param("locationId")
      );
      if (!location) {
        return c.json({ error: { code: "NOT_FOUND", message: "Location not found." } }, 404);
      }
      return c.json({ location });
    } catch (err) {
      return mapErr(c, err);
    }
  });

  app.post("/organizations/:organizationId/workspaces", async (c) => {
    try {
      const actor = requireActor(c.get("auth"));
      await authorize(deps.audit, actor, "workspaces.create", {
        activationBootstrap: true,
      });
      const body = workspaceSchema.safeParse(await c.req.json().catch(() => null));
      if (!body.success) {
        return c.json({ error: { code: "INVALID_BODY", message: "Invalid workspace payload" } }, 400);
      }
      const workspace = await deps.tenancy.createWorkspace(
        actor,
        c.req.param("organizationId"),
        body.data
      );
      return c.json({ workspace }, 201);
    } catch (err) {
      return mapErr(c, err);
    }
  });

  app.get("/organizations/:organizationId/workspaces/:workspaceId", async (c) => {
    try {
      const actor = requireActor(c.get("auth"));
      await authorize(deps.audit, actor, "workspaces.read");
      const workspace = await deps.tenancy.getWorkspace(
        actor,
        c.req.param("organizationId"),
        c.req.param("workspaceId")
      );
      if (!workspace) {
        return c.json({ error: { code: "NOT_FOUND", message: "Workspace not found." } }, 404);
      }
      return c.json({ workspace });
    } catch (err) {
      return mapErr(c, err);
    }
  });

  app.patch("/organizations/:organizationId/workspaces/:workspaceId", async (c) => {
    try {
      const actor = requireActor(c.get("auth"));
      await authorize(deps.audit, actor, "workspaces.update");
      const body = workspaceUpdateSchema.safeParse(await c.req.json().catch(() => null));
      if (!body.success) {
        return c.json({ error: { code: "INVALID_BODY", message: "Invalid workspace update" } }, 400);
      }
      const workspace = await deps.tenancy.updateWorkspace(
        actor,
        c.req.param("organizationId"),
        c.req.param("workspaceId"),
        body.data
      );
      return c.json({ workspace });
    } catch (err) {
      return mapErr(c, err);
    }
  });

  app.post("/organizations/:organizationId/memberships", async (c) => {
    try {
      const actor = requireActor(c.get("auth"));
      await authorize(deps.audit, actor, "memberships.manage", {
        activationBootstrap: true,
      });
      const body = membershipSchema.safeParse(await c.req.json().catch(() => null));
      if (!body.success) {
        return c.json({ error: { code: "INVALID_BODY", message: "Invalid membership payload" } }, 400);
      }
      const membership = await deps.tenancy.assignMembership(
        actor,
        c.req.param("organizationId"),
        body.data
      );
      return c.json({ membership }, 201);
    } catch (err) {
      return mapErr(c, err);
    }
  });

  app.get("/organizations/:organizationId/memberships", async (c) => {
    try {
      const actor = requireActor(c.get("auth"));
      await authorize(deps.audit, actor, "memberships.read");
      const workspaceId = c.req.query("workspaceId") || undefined;
      const memberships = await deps.tenancy.listMemberships(
        actor,
        c.req.param("organizationId"),
        workspaceId
      );
      return c.json({ memberships });
    } catch (err) {
      return mapErr(c, err);
    }
  });

  app.post("/organizations/:organizationId/memberships/:membershipId/revoke", async (c) => {
    try {
      const actor = requireActor(c.get("auth"));
      await authorize(deps.audit, actor, "memberships.manage");
      const membership = await deps.tenancy.revokeMembership(
        actor,
        c.req.param("organizationId"),
        c.req.param("membershipId")
      );
      return c.json({ membership });
    } catch (err) {
      return mapErr(c, err);
    }
  });

  app.get("/organizations/:organizationId/audit-events", async (c) => {
    try {
      const actor = requireActor(c.get("auth"));
      await authorize(deps.audit, actor, "audit.read");
      const events = await deps.tenancy.listAuditEvents(actor, c.req.param("organizationId"));
      return c.json({ events });
    } catch (err) {
      return mapErr(c, err);
    }
  });

  return app;
}

function requireActor(auth: AuthContext | null): AuthContext {
  if (!isAuthenticated(auth)) {
    throw new AuthError("UNAUTHENTICATED", "Not authenticated.", 401);
  }
  return auth;
}

function mapErr(
  c: { json: (body: unknown, status?: 400 | 401 | 403 | 404 | 409 | 500) => Response },
  err: unknown
) {
  if (err instanceof AuthError) {
    return c.json(
      { error: { code: err.code, message: err.message } },
      err.status as 400 | 401 | 403 | 404 | 409 | 500
    );
  }
  console.error("[tenancy]", err);
  return c.json({ error: { code: "INTERNAL", message: "Unexpected error." } }, 500);
}
