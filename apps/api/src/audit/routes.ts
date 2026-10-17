import { Hono } from "hono";
import { z } from "zod";
import type { AuthService } from "../identity/auth-service.js";
import { AuthError } from "../identity/auth-service.js";
import { assertPermission, isAuthenticated, PermissionDeniedError } from "../identity/rbac.js";
import type { AuthContext } from "../identity/types.js";
import type { AuditService } from "./service.js";

type Variables = { auth: AuthContext | null };
const querySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) });

export function createAuditRoutes(deps: { auth: AuthService; audit: AuditService }) {
  const app = new Hono<{ Variables: Variables }>();

  app.use("*", async (c, next) => {
    c.set("auth", await deps.auth.resolveSession(c.req.header("cookie")));
    await next();
  });

  app.get("/audit/events", async (c) => {
    const actor = c.get("auth");
    try {
      if (!isAuthenticated(actor)) {
        throw new AuthError("UNAUTHENTICATED", "Not authenticated.", 401);
      }
      assertPermission(actor, "audit.read");
      const query = querySchema.safeParse({ limit: c.req.query("limit") ?? undefined });
      if (!query.success) {
        return c.json({ error: { code: "INVALID_QUERY", message: "limit must be from 1 to 100." } }, 400);
      }
      const events = await deps.audit.list(actor, query.data.limit);
      return c.json({ events });
    } catch (error) {
      if (error instanceof PermissionDeniedError) {
        try {
          await deps.audit.recordPermissionDenied({
            actor,
            permission: error.permission,
            method: c.req.method,
            path: c.req.path,
          });
        } catch (auditError) {
          console.error("[audit] failed to record permission denial", auditError);
        }
        return c.json({ error: { code: error.code, message: error.message } }, error.status);
      }
      if (error instanceof AuthError) {
        return c.json({ error: { code: error.code, message: error.message } }, error.status);
      }
      console.error("[audit] unexpected error", error);
      return c.json({ error: { code: "INTERNAL", message: "Unexpected error." } }, 500);
    }
  });

  return app;
}
