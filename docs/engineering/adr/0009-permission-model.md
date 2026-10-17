# ADR 0009: Server-side permission model

## Status
**Accepted** — 2026-10-17  
**Sign-off:** Product Manager · CTO · Backend Lead · Security Engineer

## Context
Sprint 3 must enforce the frozen nine-role vocabulary on the existing API surface without weakening Organization isolation or inventing permissions for routes that do not exist. Authorization denials and sensitive lifecycle actions also need an organization-scoped audit trail.

## Decision
- Keep the server-side permission catalog in `apps/api/src/identity/permission-catalog.ts` as the source of truth.
- Name permissions in `resource.action` dot form and include only operations implemented by the current route surface.
- Fail closed: absent or unknown roles and unknown permissions receive no grants; enforced denials return HTTP 403 `FORBIDDEN`.
- Record enforced permission denials as `permission.denied` in `domain_events` without allowing an audit-write failure to replace the denial response (D3).
- Restrict `audit.read` to `owner` and `administrator` in v1 (D4).
- Enforce non-empty Membership `locationScope` on location-associated routes; per ADR 0005, an empty scope means all Workspace locations (D5).
- Keep `GET /api/v1/auth/rbac/probe` as an authenticated effective-permissions surface protected by `auth.read` (D6).

## Consequences
- Route handlers enforce catalog permissions while existing tenant service and repository checks remain mandatory.
- Owner and administrator have the full current catalog; other roles receive explicit subsets.
- Audit reads are derived from the caller's AuthContext Organization and cannot select another Organization by URL or query.
- Adding a route operation requires an explicit catalog and enforcement decision; grants do not appear implicitly.
- The current latest-active-Membership AuthContext selection remains technical debt for users with multiple active Memberships.

## Non-goals
- No policy engine, attribute-based authorization, UI permissions editor, or custom roles.
- No audit table, publisher, outbox worker, or audit mutation API.
- No change to the frozen role vocabulary or Organization tenancy boundary.
