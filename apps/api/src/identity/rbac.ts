/**
 * RBAC — Sprint 3.
 * Canonical vocabulary: docs/engineering/RBAC_VOCABULARY.md
 * ADR: 0009
 * Owner: Security Engineer · Reviewer: Backend Lead
 */

import type { AuthContext } from "./types.js";

/** Platform role keys — locked in RBAC_VOCABULARY.md */
export const RBAC_ROLE_KEYS = [
  "owner",
  "administrator",
  "manager",
  "operator",
  "viewer",
] as const;

export type RbacRoleKey = (typeof RBAC_ROLE_KEYS)[number];

/** @deprecated Use RBAC_ROLE_KEYS — kept as alias for callers migrating from S1/S2 names */
export const CONSTITUTION_ROLE_KEYS = RBAC_ROLE_KEYS;
export type ConstitutionRoleKey = RbacRoleKey;

/** Platform permission strings — locked in RBAC_VOCABULARY.md (do not invent). */
export const RBAC_PERMISSIONS = [
  "organizations.read",
  "organizations.create",
  "organizations.update",
  "organizations.delete",
  "workspaces.read",
  "workspaces.create",
  "workspaces.update",
  "workspaces.delete",
  "locations.read",
  "locations.create",
  "locations.update",
  "locations.delete",
  "memberships.read",
  "memberships.manage",
  "identity.read",
  "identity.manage",
  "audit.read",
  "system.admin",
] as const;

export type RbacPermission = (typeof RBAC_PERMISSIONS)[number];

const ALL = new Set<RbacPermission>(RBAC_PERMISSIONS);

const VIEWER_PERMS: RbacPermission[] = [
  "organizations.read",
  "workspaces.read",
  "locations.read",
  "memberships.read",
  "identity.read",
  "audit.read",
];

const OPERATOR_PERMS: RbacPermission[] = [
  ...VIEWER_PERMS.filter((p) => p !== "audit.read"),
  "locations.create",
  "locations.update",
];

const MANAGER_PERMS: RbacPermission[] = [
  ...OPERATOR_PERMS,
  "workspaces.create",
  "workspaces.update",
  "workspaces.delete",
  "locations.delete",
  "memberships.manage",
  "audit.read",
];

const ADMINISTRATOR_PERMS: RbacPermission[] = [
  ...MANAGER_PERMS,
  "organizations.create",
  "organizations.update",
  "organizations.delete",
  "identity.manage",
];

const OWNER_PERMS: RbacPermission[] = [...ADMINISTRATOR_PERMS, "system.admin"];

/** Explicit allow-lists — absence is denial (fail-closed). */
export const ROLE_PERMISSIONS: Record<RbacRoleKey, ReadonlySet<RbacPermission>> = {
  viewer: new Set(VIEWER_PERMS),
  operator: new Set(OPERATOR_PERMS),
  manager: new Set(MANAGER_PERMS),
  administrator: new Set(ADMINISTRATOR_PERMS),
  owner: new Set(OWNER_PERMS),
};

export class PermissionDeniedError extends Error {
  readonly code = "PERMISSION_DENIED";
  readonly status = 403 as const;
  constructor(
    message = "Permission denied.",
    readonly permission?: string
  ) {
    super(message);
    this.name = "PermissionDeniedError";
  }
}

/** @deprecated Removed from production path — retained only for type compatibility */
export class RbacNotReadyError extends Error {
  readonly code = "RBAC_NOT_READY";
  constructor(message = "RBAC is live; use PermissionDeniedError.") {
    super(message);
    this.name = "RbacNotReadyError";
  }
}

export function isRbacPermission(value: string): value is RbacPermission {
  return (RBAC_PERMISSIONS as readonly string[]).includes(value);
}

export function isRbacRoleKey(value: string | null | undefined): value is RbacRoleKey {
  return !!value && (RBAC_ROLE_KEYS as readonly string[]).includes(value);
}

/**
 * Pure matrix evaluation. Unknown permission or role ⇒ false (deny).
 */
export function can(role: string | null | undefined, permission: string): boolean {
  if (!isRbacPermission(permission)) return false;
  if (!isRbacRoleKey(role)) return false;
  return ROLE_PERMISSIONS[role].has(permission);
}

export type AssertPermissionOptions = {
  /**
   * Allow organizations.create for authenticated users with no membership
   * (first-org bootstrap — RBAC_VOCABULARY.md).
   */
  bootstrapOrgCreate?: boolean;
  /**
   * Allow initial tenant activation writes when the actor has no membership yet:
   * locations.create | workspaces.create | memberships.manage
   */
  activationBootstrap?: boolean;
  /** When set, require locationId ∈ locationScope if scope is non-empty. */
  locationId?: string;
};

/**
 * AuthContext assembly after session validation.
 */
export function toAuthContext(input: {
  userId: string;
  email: string;
  status: AuthContext["status"];
  sessionId: string;
  organizationId?: string | null;
  workspaceId?: string | null;
  role?: string | null;
  locationScope?: string[];
}): AuthContext {
  return {
    userId: input.userId,
    email: input.email,
    status: input.status,
    organizationId: input.organizationId ?? null,
    workspaceId: input.workspaceId ?? null,
    role: input.role ?? null,
    locationScope: input.locationScope ?? [],
    sessionId: input.sessionId,
  };
}

/**
 * Deny-by-default permission check. Throws PermissionDeniedError on deny.
 */
export function assertPermission(
  actor: AuthContext,
  permission: string,
  opts: AssertPermissionOptions = {}
): void {
  if (!isAuthenticated(actor)) {
    throw new PermissionDeniedError("Not authenticated.", permission);
  }

  if (opts.bootstrapOrgCreate && permission === "organizations.create" && !actor.organizationId) {
    return;
  }

  const activationAllowed = new Set([
    "locations.create",
    "workspaces.create",
    "memberships.manage",
  ]);
  if (
    opts.activationBootstrap &&
    !actor.organizationId &&
    !actor.role &&
    activationAllowed.has(permission)
  ) {
    return;
  }

  if (!isRbacPermission(permission) || !ALL.has(permission)) {
    throw new PermissionDeniedError(`Unknown permission: ${permission}`, permission);
  }

  if (!can(actor.role, permission)) {
    throw new PermissionDeniedError(
      `Role '${actor.role ?? "none"}' lacks permission '${permission}'.`,
      permission
    );
  }

  if (opts.locationId && actor.locationScope.length > 0) {
    if (!actor.locationScope.includes(opts.locationId)) {
      throw new PermissionDeniedError(
        "Location is outside actor location_scope.",
        permission
      );
    }
  }
}

export function isAuthenticated(actor: AuthContext | null): actor is AuthContext {
  return actor !== null && actor.status === "active";
}

export function permissionsForRole(role: RbacRoleKey): RbacPermission[] {
  return [...ROLE_PERMISSIONS[role]];
}
