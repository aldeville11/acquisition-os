# Sprint 03 — Retrospective

**Sprint:** 03 — authz-audit  
**Date:** 2026-07-15  
**Status:** Final — Sprint COMPLETE  
**Facilitator:** Engineering Manager / CTO  

## What went well

- Required amendment (RBAC Vocabulary) prevented permission invention during coding.  
- Execution Plan S3 scope held (AuthZ + Audit foundation only).  
- Authorization Suite made role/matrix expectations CI-mandatory.  
- Clear separation of `audit_events` vs `domain_events`.

## What slowed us down

- Bootstrap/activation path required careful documentation so first-org setup still works without inventing roles.  
- Prior Constitution role vocabulary (executive/csr/…) needed migration to the five locked roles.

## Unexpected discoveries

- Permission grant audits during activation bootstrap often lack `organization_id` until membership exists — tenant-scoped audit lists omit them by design.  
- Invite stub must wait for `identity.manage` (owner/administrator), not anonymous auth alone.

## Architecture concerns

- Multi-membership AuthContext still “latest active” (S2 debt).  
- Delete permission keys exist but delete HTTP surfaces deferred.  
- Branch protection still owner UI action.

## Technical debt introduced

| Item | Tracking |
|---|---|
| Activation bootstrap path | Documented in RBAC_VOCABULARY — tighten with product Activation playbook later |
| Delete endpoints unused | Permissions reserved; implement when product needs |
| #19 CSRF / #20 rate limit / #22 session | Remain open |
| Outbox | Sprint 4 |

## Engineering lessons

- Lock vocabulary before implementation — prevents drift.  
- Authorization suite should mirror isolation suite as forever-CI.

## Product lessons

- Five-role model is sufficient for P0 AuthZ; prior longer Constitution list collapsed cleanly.

## Risks for next sprint

| Risk | Mitigation |
|---|---|
| Outbox consumers mis-read audit as domain events | ADR 0009 + docs separation |
| Skipping authz suite | CI step mandatory |

## Actions to carry forward

| Action | Owner |
|---|---|
| Sprint 4 outbox publisher | Platform |
| Mirror #19–#22 issues in acquisition-os | Security |
| Persist Product Constitution / Architecture under docs/ | Technical Architect |

## Scorecard

[`scorecards/S03-scorecard.md`](./scorecards/S03-scorecard.md)
