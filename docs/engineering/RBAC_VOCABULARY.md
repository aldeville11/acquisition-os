# RBAC Vocabulary — Roles and Permission Matrix

**Status:** Sprint 3 (AuthZ + Audit), 2026-10-17.
**Source of truth:** `apps/api/src/identity/permission-catalog.ts`. This document
is the human-readable policy matrix generated from that catalog. If the two ever
disagree, the catalog wins and this document is the defect.
**Decision record:** ADR 0009 (server-side permission model).

## Rules

- Role keys are the Constitution v1 frozen vocabulary (9 roles). No role may be
  invented, renamed, or removed outside an approved ADR.
- Permissions are dot-form `resource.action`, granted only for routes that
  exist. No speculative permissions.
- Evaluation fails closed: an unknown or absent role, or an unknown
  permission, grants nothing.
- Tenant isolation is enforced separately and first: a permission never
  grants access to another organization.

## Roles

| Role key | Meaning |
|---|---|
| `owner` | Full tenant authority |
| `administrator` | Full operational administration within the tenant |
| `executive` | Tenant-wide read, invites, membership visibility |
| `operations_manager` | Day-to-day operations: locations, workspaces, memberships |
| `sales_manager` | Tenant read, invites, membership visibility |
| `support` | Tenant read plus membership visibility |
| `csr` | Tenant read |
| `marketing` | Tenant read |
| `read_only` | Tenant read |

## Permission matrix

Tenant-read set (held by every role): `auth.read`, `sessions.read`,
`organizations.read`, `locations.read`, `workspaces.read`.

| Permission | owner | administrator | executive | operations_manager | sales_manager | support | csr | marketing | read_only |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `auth.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `sessions.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `organizations.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `locations.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `workspaces.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `users.invite` | ✓ | ✓ | ✓ | ✓ | ✓ | | | | |
| `memberships.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | | |
| `locations.create` | ✓ | ✓ | | ✓ | | | | | |
| `workspaces.create` | ✓ | ✓ | | ✓ | | | | | |
| `memberships.create` | ✓ | ✓ | | ✓ | | | | | |
| `organizations.create` | ✓ | ✓ | | | | | | | |
| `audit.read` | ✓ | ✓ | | | | | | | |

## Notes

- `audit.read` is restricted to `owner` and `administrator` in v1 (ADR 0009,
  decision D4). The audit read surface is organization-scoped: it returns
  only the caller's own organization events, under any role.
- `locationScope` (ADR 0005) further restricts location and workspace
  access: an empty scope means all of the workspace's locations; a non-empty
  scope denies access outside the listed locations, including creating a
  location (a new location cannot already be in scope).
- Denied requests return HTTP 403 with code `FORBIDDEN` and are recorded as
  `permission.denied` audit events.
