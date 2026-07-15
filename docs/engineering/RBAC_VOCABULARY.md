# RBAC Vocabulary — Acquisition OS

**Status:** Accepted — platform contract  
**Authority:** Product Manager · Security Engineer · CTO (Sprint 3 Plan approval)  
**Effective:** Sprint 3 (AuthZ + Audit)  
**Related:** [ADR 0009](./adr/0009-authz-audit.md) · [SPRINT_3_PLAN.md](./SPRINT_3_PLAN.md)

This document is the **canonical source of truth** for authorization in Acquisition OS.  
Implementations **must not invent** roles or permission names. Changes require Product Manager + Security Engineer approval (and ADR amendment when architectural).

Storage keys are **snake_case**. Display names are title case.

---

## 1. Roles

| Display name | Role key (`role_key`) | Description |
|---|---|---|
| Owner | `owner` | Full tenant authority including reserved system permission |
| Administrator | `administrator` | Full operational administration within a tenant (no `system.admin`) |
| Manager | `manager` | Manages workspaces, locations, and memberships |
| Operator | `operator` | Day-to-day operational writes with limited surface |
| Viewer | `viewer` | Read-only access |

Only these five role keys are valid on Membership. Unknown role keys are rejected at assign time.

---

## 2. Permissions

Permission names are **stable platform contract** strings (`resource.action`).

| Permission | Meaning |
|---|---|
| `organizations.read` | Read organization records in tenant |
| `organizations.create` | Create an organization (see bootstrap rule) |
| `organizations.update` | Update organization fields |
| `organizations.delete` | Delete / hard-remove organization (reserved for future; fail-closed if unused) |
| `workspaces.read` | Read workspaces |
| `workspaces.create` | Create workspaces |
| `workspaces.update` | Update workspaces |
| `workspaces.delete` | Delete workspaces (reserved for future; fail-closed if unused) |
| `locations.read` | Read locations |
| `locations.create` | Create locations |
| `locations.update` | Update locations |
| `locations.delete` | Delete locations (reserved for future; fail-closed if unused) |
| `memberships.read` | List / read memberships |
| `memberships.manage` | Assign or revoke memberships (includes role assignment) |
| `identity.read` | Read identity surfaces (self `/me` is session auth only) |
| `identity.manage` | Invite / manage users (invite stub and future identity admin) |
| `audit.read` | Read audit events (API foundation; no reporting UI in Sprint 3) |
| `system.admin` | Reserved system administration (Owner only) |

**Do not invent** additional permission strings in implementation PRs.

---

## 3. Resource ownership rules

1. **Hard tenant boundary** is `organization_id`. Authorization never grants cross-organization access.  
2. Actor `AuthContext.organizationId` (from active Membership) must match the target organization, except the **bootstrap** rule below.  
3. **Workspace** resources are owned by their organization; memberships bind a user to one workspace under that organization.  
4. **Location scope:** when `AuthContext.locationScope` is non-empty, location-targeted actions are denied for locations outside that set. Empty `locationScope` means all locations in the membership's workspace (ADR 0005).  
5. Client-supplied `organizationId` / `role` / permissions are **never** authoritative — only session + Membership + this vocabulary.

### Bootstrap exception (`organizations.create`)

An authenticated user with **no** active Membership may create their first Organization (tenant bootstrap). After Membership exists, further `organizations.create` requires the mapped permission (normally Owner / Administrator).

---

## 4. Permission inheritance

Roles inherit along a strict hierarchy (higher includes all lower grants, plus extras):

```
owner ⊃ administrator ⊃ manager ⊃ operator ⊃ viewer
```

Evaluation is **not** “pick any ancestor dynamically at runtime from partial grants.”  
Each role has an **explicit allow-list** (Section 5). Inheritance means Administrator never receives fewer operational grants than Manager, etc., and Owner alone receives `system.admin`.

Unknown roles ⇒ deny.  
Unknown permissions ⇒ deny.

---

## 5. Default role mapping

| Permission | owner | administrator | manager | operator | viewer |
|---|---|---|---|---|---|
| `organizations.read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `organizations.create` | ✓ | ✓ | | | |
| `organizations.update` | ✓ | ✓ | | | |
| `organizations.delete` | ✓ | ✓ | | | |
| `workspaces.read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `workspaces.create` | ✓ | ✓ | ✓ | | |
| `workspaces.update` | ✓ | ✓ | ✓ | | |
| `workspaces.delete` | ✓ | ✓ | ✓ | | |
| `locations.read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `locations.create` | ✓ | ✓ | ✓ | ✓ | |
| `locations.update` | ✓ | ✓ | ✓ | ✓ | |
| `locations.delete` | ✓ | ✓ | ✓ | | |
| `memberships.read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `memberships.manage` | ✓ | ✓ | ✓ | | |
| `identity.read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `identity.manage` | ✓ | ✓ | | | |
| `audit.read` | ✓ | ✓ | ✓ | | ✓ |
| `system.admin` | ✓ | | | | |

---

## 6. Fail-closed behavior

| Condition | Result |
|---|---|
| Missing / unauthenticated session on protected route | `401 UNAUTHENTICATED` |
| Authenticated but permission not granted | `403 FORBIDDEN` (`PERMISSION_DENIED`) |
| Unknown permission string | Deny |
| Unknown / null role | Deny (except bootstrap `organizations.create`) |
| Inactive / revoked membership (no AuthContext role) | Deny for tenant-scoped permissions |
| Cross-tenant target organization | Deny (`TENANT_ISOLATION` / 403) — AuthZ does not override isolation |
| Evaluation error | Deny |

There are **no implicit grants**. Absence from the matrix is denial.

---

## 7. Reserved system permissions

| Permission | Rule |
|---|---|
| `system.admin` | Owner only. Never grant to Administrator or below. Used for future platform/system operations — not product Reporting. |

Sprint 3 does not expose a general `system.admin` HTTP surface beyond capability readiness in the matrix/tests.

---

## Endpoint binding (Sprint 3)

| Surface | Permission |
|---|---|
| `POST /organizations` | `organizations.create` (bootstrap exception when no membership) |
| `GET /organizations/:id` | `organizations.read` |
| `PATCH /organizations/:id` | `organizations.update` |
| `POST .../locations` | `locations.create` |
| `GET .../locations/:id` | `locations.read` |
| `POST .../workspaces` | `workspaces.create` |
| `GET .../workspaces/:id` | `workspaces.read` |
| `PATCH .../workspaces/:id` | `workspaces.update` |
| `POST .../memberships` | `memberships.manage` |
| `GET .../memberships` | `memberships.read` |
| `POST .../memberships/:id/revoke` | `memberships.manage` |
| `POST /auth/invites` | `identity.manage` |
| `GET /auth/rbac/probe` | exercises `identity.manage` (live deny/allow) |
| `GET .../audit-events` (optional read foundation) | `audit.read` |
| `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` | Session AuthN only (no RBAC permission) |

---

## Change control

1. Propose vocabulary change in PR + update this file and ADR 0009 appendix.  
2. Product Manager + Security Engineer approve.  
3. Update default mapping tests.  
4. Never rename existing permission strings without a versioned migration story.
