import type { ConstitutionRoleKey } from "./rbac.js";

/** Permissions for the API surface that exists at the start of Sprint 3. */
export const PERMISSIONS = [
  "auth.read",
  "sessions.read",
  "users.invite",
  "organizations.create",
  "organizations.read",
  "locations.create",
  "locations.read",
  "workspaces.create",
  "workspaces.read",
  "memberships.create",
  "memberships.read",
  "audit.read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL_PERMISSIONS = [...PERMISSIONS];
const TENANT_READ_PERMISSIONS: Permission[] = [
  "auth.read",
  "sessions.read",
  "organizations.read",
  "locations.read",
  "workspaces.read",
];

/** The server-side RBAC source of truth. Missing roles and permissions fail closed. */
export const PERMISSION_CATALOG: Readonly<
  Partial<Record<ConstitutionRoleKey, readonly Permission[]>>
> = {
  owner: ALL_PERMISSIONS,
  executive: [...TENANT_READ_PERMISSIONS, "users.invite", "memberships.read"],
  operations_manager: [
    ...TENANT_READ_PERMISSIONS,
    "users.invite",
    "locations.create",
    "workspaces.create",
    "memberships.create",
    "memberships.read",
  ],
  csr: TENANT_READ_PERMISSIONS,
  sales_manager: [...TENANT_READ_PERMISSIONS, "users.invite", "memberships.read"],
  marketing: TENANT_READ_PERMISSIONS,
  read_only: TENANT_READ_PERMISSIONS,
  support: [...TENANT_READ_PERMISSIONS, "memberships.read"],
  administrator: ALL_PERMISSIONS,
};

export function effectivePermissions(role: string | null): Permission[] {
  if (!role || !Object.prototype.hasOwnProperty.call(PERMISSION_CATALOG, role)) return [];
  return [...(PERMISSION_CATALOG[role as ConstitutionRoleKey] ?? [])];
}

export function roleHasPermission(role: string | null, permission: string): boolean {
  return effectivePermissions(role).some((candidate) => candidate === permission);
}
