# Sprint 3 — AuthZ + Audit — Release Summary

**Sprint:** 03 — authz-audit  
**Status:** COMPLETE (pending close gate + merge)  
**Version:** 0.3.0  
**Date:** 2026-07-15  

## Delivered

- Canonical [`RBAC_VOCABULARY.md`](./RBAC_VOCABULARY.md) (roles, permissions, inheritance, fail-closed)
- ADR 0009 **Accepted** — AuthZ + AuditEvent architecture
- Live deny-by-default `assertPermission` / `authorize` on protected endpoints
- Durable `audit_events` migration + writers (login/logout/tenancy/permission grant·deny)
- PATCH org/workspace + membership revoke surfaces for audited mutations
- Mandatory Authorization Test Suite in CI alongside Tenant Isolation Suite

## Acceptance

| Area | Result |
|---|---|
| Every protected endpoint requires explicit AuthZ | Met |
| Unknown permissions deny | Met |
| No implicit grants / fail-closed | Met |
| Audit foundation for required actions | Met |
| No reporting / analytics / Sprint 4 outbox | Met |

## Security review

- Cross-tenant AuthZ failures covered in Authorization Suite
- Bootstrap/activation paths documented and limited (no silent privilege escalation after membership)
- `system.admin` Owner-only
- Probe no longer returns `RBAC_NOT_READY`

## Coverage

API statements ~78.6% (vitest coverage). AuthZ + isolation suites green.

## Out of scope (confirmed)

CSRF #19 · rate limit #20 · session idle #22 · outbox S4 · Audit UI
