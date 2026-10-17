import { Hono } from "hono";
import { z } from "zod";
import type { AuthService } from "../identity/auth-service.js";
import { AuthError } from "../identity/auth-service.js";
import {
  assertPermission,
  isAuthenticated,
  PermissionDeniedError,
} from "../identity/rbac.js";
import type { AuthContext } from "../identity/types.js";
import type { PlatformStore } from "../platform/types.js";
import type { TenancyService } from "./service.js";
import type { AuditService } from "../audit/service.js";

type Variables = { auth: AuthContext | null };

const orgSchema = z.object({
  name: z.string().min(1).max(200),
  legalName: z.string().min(1).max(300),
  type: z.enum(["independent", "multi_location", "franchise", "pe_portfolio", "partner"]),
  billingEntity: z.string().max(300).optional(),
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
      assertPermission(actor, "organizations.create");
      const body = orgSchema.safeParse(await c.req.json().catch(() => null));
      if (!body.success) {
        return c.json({ error: { code: "INVALID_BODY", message: "Invalid organization payload" } }, 400);
      }
      const organization = await deps.tenancy.createOrganization(actor, body.data);
      return c.json({ organization }, 201);
    } catch (err) {
      return mapErr(c, err, deps.audit, c.get("auth"), c.req.method, c.req.path);
    }
  });

  app.get("/organizations/:organizationId", async (c) => {
    try {
      const actor = requireActor(c.get("auth"));
      assertPermission(actor, "organizations.read");
      await deps.tenancy.resolveTenant(actor, c.req.param("organizationId"));
      const organization = await deps.store.getOrganization(c.req.param("organizationId"));
      if (!organization) {
        return c.json({ error: { code: "NOT_FOUND", message: "Organization not found." } }, 404);
      }
      return c.json({ organization });
    } catch (err) {
      return mapErr(c, err, deps.audit, c.get("auth"), c.req.method, c.req.path);
    }
  });

  app.post("/organizations/:organizationId/locations", async (c) => {
    try {
      const actor = requireActor(c.get("auth"));
      assertPermission(actor, "locations.create");
      if (actor.locationScope.length > 0) {
        throw new PermissionDeniedError("Permission denied.", "locations.create");
      }
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
      return mapErr(c, err, deps.audit, c.get("auth"), c.req.method, c.req.path);
    }
  });

  app.get("/organizations/:organizationId/locations/:locationId", async (c) => {
    try {
      const actor = requireActor(c.get("auth"));
      assertPermission(actor, "locations.read");
      assertLocationScope(actor, [c.req.param("locationId")], "locations.read");
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
      return mapErr(c, err, deps.audit, c.get("auth"), c.req.method, c.req.path);
    }
  });

  app.post("/organizations/:organizationId/workspaces", async (c) => {
    try {
      const actor = requireActor(c.get("auth"));
      assertPermission(actor, "workspaces.create");
      const body = workspaceSchema.safeParse(await c.req.json().catch(() => null));
      if (!body.success) {
        return c.json({ error: { code: "INVALID_BODY", message: "Invalid workspace payload" } }, 400);
      }
      assertLocationScope(actor, body.data.locationIds, "workspaces.create");
      const workspace = await deps.tenancy.createWorkspace(
        actor,
        c.req.param("organizationId"),
        body.data
      );
      return c.json({ workspace }, 201);
    } catch (err) {
      return mapErr(c, err, deps.audit, c.get("auth"), c.req.method, c.req.path);
    }
  });

  app.get("/organizations/:organizationId/workspaces/:workspaceId", async (c) => {
    try {
      const actor = requireActor(c.get("auth"));
      assertPermission(actor, "workspaces.read");
      const workspace = await deps.tenancy.getWorkspace(
        actor,
        c.req.param("organizationId"),
        c.req.param("workspaceId")
      );
      if (!workspace) {
        return c.json({ error: { code: "NOT_FOUND", message: "Workspace not found." } }, 404);
      }
      assertLocationScope(actor, workspace.locationIds, "workspaces.read");
      return c.json({ workspace });
    } catch (err) {
      return mapErr(c, err, deps.audit, c.get("auth"), c.req.method, c.req.path);
    }
  });

  app.post("/organizations/:organizationId/memberships", async (c) => {
    try {
      const actor = requireActor(c.get("auth"));
      assertPermission(actor, "memberships.create");
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
      return mapErr(c, err, deps.audit, c.get("auth"), c.req.method, c.req.path);
    }
  });

  app.get("/organizations/:organizationId/memberships", async (c) => {
    try {
      const actor = requireActor(c.get("auth"));
      assertPermission(actor, "memberships.read");
      const workspaceId = c.req.query("workspaceId") || undefined;
      const memberships = await deps.tenancy.listMemberships(
        actor,
        c.req.param("organizationId"),
        workspaceId
      );
      return c.json({ memberships });
    } catch (err) {
      return mapErr(c, err, deps.audit, c.get("auth"), c.req.method, c.req.path);
    }
  });

  return app;
}

function assertLocationScope(
  actor: AuthContext,
  locationIds: string[],
  permission: string
): void {
  if (actor.locationScope.length === 0 || locationIds.length === 0) return;
  const allowed = new Set(actor.locationScope);
  if (locationIds.some((locationId) => !allowed.has(locationId))) {
    throw new PermissionDeniedError("Permission denied.", permission);
  }
}

function requireActor(auth: AuthContext | null): AuthContext {
  if (!isAuthenticated(auth)) {
    throw new AuthError("UNAUTHENTICATED", "Not authenticated.", 401);
  }
  return auth;
}

async function mapErr(
  c: { json: (body: unknown, status?: 400 | 401 | 403 | 404 | 409 | 500) => Response },
  err: unknown,
  audit: AuditService,
  actor: AuthContext | null,
  method: string,
  path: string
): Promise<Response> {
  if (err instanceof AuthError) {
    return c.json(
      { error: { code: err.code, message: err.message } },
      err.status as 400 | 401 | 403 | 404 | 409 | 500
    );
  }
  if (err instanceof PermissionDeniedError) {
    try {
      await audit.recordPermissionDenied({ actor, permission: err.permission, method, path });
    } catch (auditError) {
      console.error("[audit] failed to record permission denial", auditError);
    }
    return c.json({ error: { code: err.code, message: err.message } }, err.status);
  }
  console.error("[tenancy]", err);
  return c.json({ error: { code: "INTERNAL", message: "Unexpected error." } }, 500);
}
