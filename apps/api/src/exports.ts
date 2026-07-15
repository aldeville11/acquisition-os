/**
 * Acquisition OS API public exports.
 */
export { createApp } from "./app.js";
export { loadConfig } from "./config.js";
export { AuditService } from "./audit/service.js";
export type { AuditEventRecord, AuditAction } from "./audit/types.js";
export { AuthService, AuthError } from "./identity/auth-service.js";
export { InviteService } from "./identity/invite-service.js";
export {
  assertPermission,
  can,
  isAuthenticated,
  toAuthContext,
  PermissionDeniedError,
  RbacNotReadyError,
  CONSTITUTION_ROLE_KEYS,
  RBAC_ROLE_KEYS,
  RBAC_PERMISSIONS,
  ROLE_PERMISSIONS,
} from "./identity/rbac.js";
export type { AuthContext, PublicUser } from "./identity/types.js";
export {
  SESSION_COOKIE_NAME,
  buildSessionCookie,
  clearSessionCookie,
} from "./identity/cookies.js";
export { TenancyService, DOMAIN_EVENT } from "./tenancy/service.js";
export { SqlPlatformStore, TenantIsolationError } from "./platform/sql-store.js";
export { createSqlDb, createPgliteDb, applyMigrations } from "./db/client.js";
