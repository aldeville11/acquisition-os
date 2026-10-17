/**
 * Acquisition OS API public exports.
 */
export { createApp } from "./app.js";
export { loadConfig } from "./config.js";
export { AuthService, AuthError } from "./identity/auth-service.js";
export { InviteService } from "./identity/invite-service.js";
export {
  assertPermission,
  isAuthenticated,
  toAuthContext,
  PermissionDeniedError,
  CONSTITUTION_ROLE_KEYS,
} from "./identity/rbac.js";
export {
  effectivePermissions,
  roleHasPermission,
  PERMISSIONS,
  PERMISSION_CATALOG,
} from "./identity/permission-catalog.js";
export type { Permission } from "./identity/permission-catalog.js";
export type { AuthContext, PublicUser } from "./identity/types.js";
export {
  SESSION_COOKIE_NAME,
  buildSessionCookie,
  clearSessionCookie,
} from "./identity/cookies.js";
export { TenancyService, DOMAIN_EVENT } from "./tenancy/service.js";
export { SqlPlatformStore, TenantIsolationError } from "./platform/sql-store.js";
export { createSqlDb, createPgliteDb, applyMigrations } from "./db/client.js";
