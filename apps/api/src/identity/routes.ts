import { Hono } from "hono";
import { z } from "zod";
import type { AuthService } from "./auth-service.js";
import { AuthError } from "./auth-service.js";
import type { InviteService } from "./invite-service.js";
import { effectivePermissions } from "./permission-catalog.js";
import {
  assertPermission,
  isAuthenticated,
  PermissionDeniedError,
} from "./rbac.js";
import type { AuthContext } from "./types.js";
import type { AuditService } from "../audit/service.js";

type Variables = {
  auth: AuthContext | null;
};

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200).optional(),
});

export function createIdentityRoutes(deps: {
  auth: AuthService;
  invites: InviteService;
  audit: AuditService;
}) {
  const app = new Hono<{ Variables: Variables }>();

  app.use("*", async (c, next) => {
    const cookie = c.req.header("cookie");
    const auth = await deps.auth.resolveSession(cookie);
    c.set("auth", auth);
    await next();
  });

  app.get("/health", (c) => c.json({ ok: true, module: "identity" }));

  app.post("/auth/login", async (c) => {
    const body = loginSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: { code: "INVALID_BODY", message: "email and password required" } }, 400);
    }
    try {
      const result = await deps.auth.login(body.data.email, body.data.password);
      c.header("Set-Cookie", result.setCookie);
      return c.json({
        user: result.user,
        authContext: {
          userId: result.auth.userId,
          organizationId: result.auth.organizationId,
          workspaceId: result.auth.workspaceId,
          role: result.auth.role,
          locationScope: result.auth.locationScope,
        },
      });
    } catch (err) {
      return mapAuthError(c, err, deps.audit, c.get("auth"), c.req.method, c.req.path);
    }
  });

  app.post("/auth/logout", async (c) => {
    try {
      const auth = requireActor(c.get("auth"));
      assertPermission(auth, "sessions.read");
      const result = await deps.auth.logout(c.req.header("cookie"));
      c.header("Set-Cookie", result.setCookie);
      return c.json({ ok: true });
    } catch (err) {
      return mapAuthError(c, err, deps.audit, c.get("auth"), c.req.method, c.req.path);
    }
  });

  app.get("/auth/me", async (c) => {
    try {
      const auth = requireActor(c.get("auth"));
      assertPermission(auth, "auth.read");
      const result = await deps.auth.me(c.req.header("cookie"));
      return c.json({
        user: result.user,
        authContext: {
          userId: result.auth.userId,
          organizationId: result.auth.organizationId,
          workspaceId: result.auth.workspaceId,
          role: result.auth.role,
          locationScope: result.auth.locationScope,
        },
      });
    } catch (err) {
      return mapAuthError(c, err, deps.audit, c.get("auth"), c.req.method, c.req.path);
    }
  });

  /** Invite stub — authenticated caller only; no Membership write (Sprint 2). */
  app.post("/auth/invites", async (c) => {
    const auth = c.get("auth");
    if (!isAuthenticated(auth)) {
      return c.json({ error: { code: "UNAUTHENTICATED", message: "Not authenticated." } }, 401);
    }
    try {
      assertPermission(auth, "users.invite");
    } catch (err) {
      return mapAuthError(c, err, deps.audit, auth, c.req.method, c.req.path);
    }
    const body = inviteSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: { code: "INVALID_BODY", message: "email required" } }, 400);
    }
    try {
      const invite = await deps.invites.inviteUser({
        email: body.data.email,
        name: body.data.name,
        actor: auth,
      });
      return c.json({ invite }, 201);
    } catch (err) {
      return mapAuthError(c, err, deps.audit, auth, c.req.method, c.req.path);
    }
  });

  /** Effective permission surface for the authenticated caller. */
  app.get("/auth/rbac/probe", (c) => {
    try {
      const auth = requireActor(c.get("auth"));
      assertPermission(auth, "auth.read");
      return c.json({
        permissions: effectivePermissions(auth.role),
        authContext: {
          userId: auth.userId,
          organizationId: auth.organizationId,
          workspaceId: auth.workspaceId,
          role: auth.role,
          locationScope: auth.locationScope,
        },
      });
    } catch (err) {
      return mapAuthError(c, err, deps.audit, c.get("auth"), c.req.method, c.req.path);
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

async function mapAuthError(
  c: { json: (body: unknown, status?: ContentfulStatusCode) => Response },
  err: unknown,
  audit: AuditService,
  actor: AuthContext | null,
  method: string,
  path: string
): Promise<Response> {
  if (err instanceof AuthError) {
    return c.json(
      { error: { code: err.code, message: err.message } },
      err.status as ContentfulStatusCode
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
  console.error("[identity] unexpected error", err);
  return c.json({ error: { code: "INTERNAL", message: "Unexpected error." } }, 500);
}

type ContentfulStatusCode = 400 | 401 | 403 | 404 | 409 | 500;
