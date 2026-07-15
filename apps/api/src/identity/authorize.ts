import type { AuditService } from "../audit/service.js";
import { AuthError } from "./auth-service.js";
import {
  assertPermission,
  PermissionDeniedError,
  type AssertPermissionOptions,
} from "./rbac.js";
import type { AuthContext } from "./types.js";

/**
 * Authorize a protected action: evaluate RBAC + write permission.granted/denied audit.
 */
export async function authorize(
  audit: AuditService,
  actor: AuthContext,
  permission: string,
  opts: AssertPermissionOptions = {}
): Promise<void> {
  try {
    assertPermission(actor, permission, opts);
    await audit.permissionGranted(actor.userId, permission, actor.organizationId);
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      await audit.permissionDenied(
        actor.userId,
        permission,
        actor.organizationId,
        err.message
      );
      throw new AuthError("PERMISSION_DENIED", err.message, 403);
    }
    throw err;
  }
}
