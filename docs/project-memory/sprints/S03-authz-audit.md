# Sprint 03 — authz-audit

**Sprint:** 03  
**Codename / slug:** authz-audit  
**Dates:** 2026-07-15  
**Status:** COMPLETE  
**Memory author:** Technical Writer  
**Contributors:** CTO · Backend Lead · Security Engineer · Product Manager · QA Lead  

> Closed via `governance:close -- 3` PASS after AuthZ + Audit foundation delivery.

---

## 1. Sprint Summary

Sprint 3 delivered server-side AuthZ from the locked RBAC Vocabulary (deny-by-default) and a durable AuditEvent foundation separate from domain events. Protected tenancy and identity routes require explicit permissions; Authorization and Isolation suites are mandatory CI. CSRF, rate limits, session idle remainder, outbox, and Audit UI remain out of scope.

## 2. Objectives Completed

- [x] RBAC_VOCABULARY.md canonical contract  
- [x] ADR 0009 Accepted  
- [x] Live assertPermission / authorize (fail-closed)  
- [x] AuditEvent table + writers for required actions  
- [x] Authorization Test Suite (mandatory CI)  
- [x] Docs + memory + close gate  
- [x] Version 0.3.0  

## 3. Files Created

| Path | Purpose |
|---|---|
| `docs/engineering/RBAC_VOCABULARY.md` | AuthZ platform contract |
| `docs/engineering/AUDIT.md` | Audit API notes |
| `docs/engineering/adr/0009-authz-audit.md` | AuthZ + Audit ADR |
| `apps/api/src/audit/**` | AuditService + types |
| `apps/api/src/db/migrations/002_sprint3_audit.ts` | audit_events migration |
| `apps/api/src/identity/authorize.ts` | Authorize helper + audit |
| `apps/api/src/identity/authorization.suite.test.ts` | Mandatory AuthZ suite |
| `docs/engineering/SPRINT_3_*.md` | Plan / release / coverage |
| `docs/engineering/retrospectives/S03-retrospective.md` | Retrospective |
| `docs/engineering/scorecards/S03-scorecard.md` | Scorecard |

## 4. Files Modified

| Path | Change |
|---|---|
| `apps/api/src/identity/rbac.ts` | Live matrix + five roles |
| `apps/api/src/identity/routes.ts` | AuthZ on invites/probe |
| `apps/api/src/tenancy/routes.ts` | AuthZ + PATCH/revoke/audit read |
| `apps/api/src/tenancy/service.ts` | Audit writers + updates |
| `apps/api/src/platform/sql-store.ts` | Audit + update methods |
| `apps/api/src/app.ts` | Wire AuditService; sprint 3 |
| `.github/workflows/ci.yml` | AuthZ suite + pre-sprint smoke |
| `package.json` | 0.3.0 + test:authz |

## 5. ADRs Added

| ADR | Title | Status |
|---|---|---|
| 0009 | AuthZ matrix + AuditEvent store | Accepted |

## 6. Product Decisions

- Roles locked to Owner / Administrator / Manager / Operator / Viewer  
- Permission names are stable platform contract  
- Activation bootstrap allows first-tenant setup without inventing extra permissions  

## 7. Engineering Decisions

- Deny-by-default pure `can(role, permission)`  
- `audit_events` ≠ `domain_events`  
- Authorization Suite mandatory forever with Isolation Suite  

## 8. Technical Debt Introduced

| Item | Paydown |
|---|---|
| Activation bootstrap path | Activation playbook later |
| Delete HTTP surfaces unused | When product needs deletes |
| #19–#22 remain | Hardening sprints |
| Multi-membership AuthContext | Workspace switcher |

## 9. Risks Identified

| Risk | Mitigation |
|---|---|
| Confusing audit with domain events | ADR 0009 + AUDIT.md |
| Skipping AuthZ suite | CI mandatory |

## 10. Blockers

| Blocker | Status |
|---|---|
| Plan approval + vocabulary amendment | Resolved |
| ADR 0009 | Resolved — Accepted |

## 11. Test Results

| Suite | Result |
|---|---|
| Unit/integration | 38 passed |
| Tenant Isolation Suite | 9 passed |
| Authorization Suite | 10 passed |
| Coverage | ~78.6% statements |
| `npm run verify` | Pass |

## 12. Performance Impact

Indexed audit append; synchronous writes on privileged paths — acceptable for S3 foundation volume.

## 13. Security Considerations

Fail-closed AuthZ; cross-tenant denials; Owner-only `system.admin`; probe live; no claimed reporting surface.

## 14. Documentation Updated

RBAC_VOCABULARY, ADR 0009, AUTH, TENANCY, AUDIT, release/coverage/retro/scorecard.

## 15. Definition of Done Verification

| DoD item | Met? |
|---|---|
| CI + isolation + authz | Yes |
| Matrix documented + enforced | Yes |
| Audit foundation | Yes |
| Docs / memory | Yes |
| No Sprint 4 scope | Yes |

## 16. Lessons Learned

- Vocabulary-first AuthZ prevents permission invention.  
- Bootstrap/activation must be explicit exceptions, not silent grants.

## 17. Recommended Next Sprint

**Sprint 04 — Outbox / workers** (async domain event publisher).  
May start only after `governance:pre-sprint -- 4` PASS + plan approval.

## 18–20. Law 001

Sprint 3 COMPLETE. Do not begin Sprint 4 until readiness + authorization.
