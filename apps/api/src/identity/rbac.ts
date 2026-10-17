/**
 * RBAC role vocabulary, AuthContext assembly, and deny-by-default guard.
 * Owner: Security Engineer · Reviewer: Backend Lead
 */

import type { AuthContext } from "./types.js";
import { roleHasPermission } from "./permission-catalog.js";

/** Constitution v1 role keys (frozen vocabulary). */
export const CONSTITUTION_ROLE_KEYS = [
  "owner",
  "executive",
  "operations_manager",
  "csr",
  "sales_manager",
  "marketing",
  "read_only",
  "support",
  "administrator",
] as const;

export type ConstitutionRoleKey = (typeof CONSTITUTION_ROLE_KEYS)[number];

export class PermissionDeniedError extends Error {
  readonly code = "FORBIDDEN";
  readonly status = 403;
  constructor(
    message = "Permission denied.",
    readonly permission: string | null = null
  ) {
    super(message);
    this.name = "PermissionDeniedError";
  }
}

/**
 * AuthContext assembly after session validation.
 * Populate tenancy fields from active Membership when present.
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
 * Check the catalog using the actor's server-derived Membership role.
 */
export function assertPermission(
  actor: AuthContext,
  permission: string
): void {
  if (!roleHasPermission(actor.role, permission)) {
    throw new PermissionDeniedError("Permission denied.", permission);
  }
}

export function isAuthenticated(actor: AuthContext | null): actor is AuthContext {
  return actor !== null && actor.status === "active";
}
