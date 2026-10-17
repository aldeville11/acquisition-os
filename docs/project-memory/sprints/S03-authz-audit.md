# Sprint 03 — authz-audit

**Sprint:** 03  
**Codename / slug:** authz-audit  
**Dates:** 2026-10-16 to 2026-10-17  
**Status:** **COMPLETE** — merged to main 2026-10-17 (PR #13, merge commit 823a005213fa8234bab7e71f7244db0b415a7793); `npm run governance:close -- 3` PASS (exit 0) on the merged main; Law 001 steps 13–14 done  
**Memory author:** Technical Writer  
**Contributors:** Product Manager · CTO · Backend Lead · Security Engineer · QA Lead · Hastings · Codex builder  

> Status **COMPLETE** remains forbidden until merge and a successful `npm run governance:close -- 3`.

---

## 1. Sprint Summary

Sprint 3 delivered server-side authorization for every current protected Identity and Tenancy route using a 12-permission catalog and the frozen nine-role vocabulary. It added `locationScope` enforcement, auditable denials and lifecycle events in the existing `domain_events` store, and an owner/administrator-only organization-scoped audit read surface. Tenant isolation remains an independent mandatory boundary and its permanent suite stayed green.

## 2. Objectives Completed

- [x] Catalog the current API surface in dot-form permissions
- [x] Implement fail-closed role and permission evaluation
- [x] Retain the RBAC probe as an effective-permissions surface
- [x] Enforce permissions across protected Identity routes
- [x] Enforce permissions across Organization, Location, Workspace, and Membership routes
- [x] Enforce ADR 0005 `locationScope` semantics
- [x] Record `permission.denied` without changing the 403 response
- [x] Record invite and session lifecycle audit events
- [x] Add the `audit.read` permission only to owner and administrator
- [x] Add an organization-scoped, append-only `GET /api/v1/audit/events` surface
- [x] Expand unit and integration coverage while retaining the mandatory isolation suite
- [x] Complete the pre-merge documentation, ADR, debt, retrospective, scorecard, and memory package

## 3. Files Created

| Path | Purpose |
|---|---|
| `apps/api/src/identity/permission-catalog.ts` | Server-side permission source of truth |
| `apps/api/src/identity/permission-catalog.unit.test.ts` | Role matrix and fail-closed tests |
| `apps/api/src/audit/service.ts` | Audit event catalog, denial writer, and org-scoped reads |
| `apps/api/src/audit/routes.ts` | Permission-gated audit read endpoint |
| `apps/api/src/audit/audit.integration.test.ts` | Audit denial, isolation, ordering, append-only, and lifecycle tests |
| `docs/engineering/adr/0009-permission-model.md` | Permission-model decision record |
| `docs/engineering/retrospectives/S03-retrospective.md` | Sprint retrospective |
| `docs/engineering/scorecards/S03-scorecard.md` | Review scorecard |
| `stage4-report.md` | Stage 4 delivery report |

## 4. Files Modified

| Path | Change |
|---|---|
| `apps/api/src/identity/rbac.ts` | Catalog-backed fail-closed guard and attempted permission on denial errors |
| `apps/api/src/identity/routes.ts` | Identity route enforcement, effective-permissions probe, denial auditing |
| `apps/api/src/identity/auth-service.ts` | Login/logout event emission |
| `apps/api/src/identity/invite-service.ts` | Invite event emission |
| `apps/api/src/identity/auth.unit.test.ts` | Authorization unit coverage |
| `apps/api/src/identity/auth.integration.test.ts` | Identity route allow/deny and probe coverage |
| `apps/api/src/exports.ts` | Authorization catalog exports |
| `apps/api/src/tenancy/routes.ts` | Route and location-scope enforcement with denial auditing |
| `apps/api/src/tenancy/tenancy.integration.test.ts` | Route matrix, no-mutation, and location-scope coverage |
| `apps/api/src/platform/types.ts` | Bounded domain-event list contract |
| `apps/api/src/platform/sql-store.ts` | Org-filtered, newest-first, limited event query |
| `apps/api/src/app.ts` | Audit service and route wiring |
| `docs/engineering/AUTH.md` | Current session, authorization, scope, route, and audit behavior |
| `docs/engineering/adr/README.md` | ADR 0009 index entry |
| `SECURITY.md` | #21 resolution and current open debt |
| `docs/engineering/checklists/sprints/S03-close.md` | Honest pre-merge closure evidence |
| `docs/project-memory/INDEX.md` | Sprint 03 OPEN entry |

## 5. ADRs Added

| ADR | Title | Status |
|---|---|---|
| 0009 | Server-side permission model | Accepted |

## 6. Product Decisions

- The role vocabulary remains the frozen nine-role v1 set; no custom roles were introduced.
- Only owner and administrator receive `audit.read` in v1.
- The existing RBAC probe remains and exposes effective permissions rather than a readiness placeholder.
- Audit UI, policy editors, outbox/publisher work, CSRF (#19), and rate limiting (#20) were not Sprint 3 scope.

## 7. Engineering Decisions

- `permission-catalog.ts` is the authorization source of truth and permissions use `resource.action` names.
- Unknown or absent roles and unknown permissions fail closed.
- Existing tenant-boundary service/repository checks remain required beneath route authorization.
- Empty `locationScope` means all Workspace locations; a non-empty scope is enforced on location-associated routes.
- Audit records reuse append-only `domain_events`; a denial-audit write failure cannot replace the 403 response.
- Audit reads derive Organization from AuthContext and accept no caller-selected Organization identifier.

## 8. Technical Debt Introduced / Carried Forward

| Item | Status | Paydown trigger |
|---|---|---|
| #19 CSRF beyond SameSite baseline | OPEN — explicitly not Sprint 3 scope; CTO decision required | Before cross-site mutating API exposure |
| #20 authentication rate limiting | OPEN — explicitly not Sprint 3 scope; CTO decision required | Before public/abuse-prone authentication traffic |
| #21 AuditEvent module | **Resolved in Sprint 3** | N/A |
| #22 session idle timeout / revoke-all | OPEN | Session lifecycle hardening |
| Latest-active-Membership AuthContext selection | OPEN | Explicit workspace/membership switcher |
| Owner/administrator act as per-merchant operations admins | OPEN convention | Revisit before separate platform-admin behavior |
| Domain events have no durable publisher | OPEN | Sprint 4 outbox/publisher |

## 9. Risks Identified

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Multi-membership actor receives an implicit context | Medium | High | Keep selection debt explicit; require a selector before cross-workspace UX |
| Merchant and future platform admin semantics diverge | Medium | High | Record current convention; decide boundary before platform-admin work |
| Audit events are not asynchronously published | High | Medium | Sprint 4 outbox/publisher and ADR 0003 decision |
| RBAC change weakens tenancy | Low | Critical | Preserve repository TenantContext checks and mandatory isolation CI |

## 10. Blockers

| Blocker | Owner | Status |
|---|---|---|
| Node 24 did not satisfy `engines.node <23` | Builder | Resolved — required Node 22 runtime used |
| Claude builder usage limit required seat failover | Engineering | Resolved — Codex continued with evidence revalidation |
| Product Constitution / Engineering Architecture absent from repo | CTO · Product | Open documentation debt; qualified at pre-sprint |
| Merge approval and merge | CTO | Open — Law 001 steps 13–14 intentionally pending |

## 11. Test Results

| Suite | Result | Notes |
|---|---|---|
| `npm run typecheck` | Pass | Node 22; all packages and apps |
| `npm run lint` | Pass | Included in verify |
| `npm run test` | Pass | 36 API tests plus package tests; dedicated isolation rerun also passed |
| `npm run test:isolation` | Pass | 9/9; permanent suite source unchanged |
| `npm run build` | Pass | Included in verify; production builds passed |
| `npm run verify` | Pass, exit 0 | Run under required PATH and SESSION_PEPPER by the builder and Hastings |
| CI workflow | Pre-merge local equivalent green | Remote post-push CI/merge remains pending |

## 12. Performance Impact

Audit reads are bounded to 1–100 records (default 50), filtered by Organization, and ordered newest first. Audit writes are synchronous on existing service/denial paths. No load benchmark was added; async publication remains Sprint 4.

## 13. Security Considerations

Authorization is fail-closed and driven by a server-derived Membership role. Every protected route is permission-gated, `locationScope` is enforced where a target location exists, denied mutations do not execute, and Organization isolation remains below RBAC. Denials and sensitive lifecycle operations are audited without exposing a cross-organization selector.

## 14. Documentation Updated

- `docs/engineering/AUTH.md`
- `docs/engineering/adr/0009-permission-model.md` and ADR index
- `SECURITY.md`
- Sprint 03 memory, retrospective, scorecard, close checklist, INDEX, and Stage 4 report

## 15. Definition of Done Verification

| DoD item | Met? |
|---|---|
| Code reviewed + local CI-equivalent green | Yes — builder and Hastings evidence; remote merge CI pending |
| Tenant isolation | Yes — 9/9 mandatory suite |
| Unit/integration | Yes — 36 API tests |
| Events/projections | Yes — required synchronous audit events; no projection in scope |
| RBAC server-side | Yes — all current protected routes |
| Observability | Yes for scoped denial logging/audit; no new telemetry surface required |
| A11y | N/A — no UI changed |
| Docs updated | Yes |
| Staging/local verify | Yes — local verify exit 0; no staging change in scope |
| Product acceptance | Yes — Stage 1–3 objectives met |
| Constitution compliant | Yes, subject to pending CTO merge approval |

## 16. Lessons Learned

- Central permission data plus route-level enforcement makes grant review straightforward.
- Authorization and tenancy are complementary boundaries, not substitutes.
- Checking the repository engine constraint before verification avoids misleading failures.
- Stage handoffs need explicit scope and evidence summaries when the builder seat changes.

## 17. Recommended Next Sprint

**Sprint ID:** 04  
**Primary objective:** Durable outbox/publisher, as carried from the Sprint 2 retrospective  
**Prerequisites / ADR blockers:** Sprint 3 merge, closure, readiness, PM/CTO authorization, and ADR 0003 queue decision  
**Must read before start:** this memory, Sprint 3 retrospective/scorecard, ADR 0009, ADR 0003, Engineering Laws, and the readiness checklist  

## 18. Law 001 Closure Checklist

| Requirement | Met? |
|---|---|
| Sprint objectives completed | Yes |
| Acceptance criteria satisfied | Yes |
| Definition of Done verified | Yes for pre-merge scope |
| CI passing | Local CI-equivalent yes; remote pre-merge run pending |
| Unit tests passing | Yes |
| Integration tests passing | Yes |
| Accessibility verification complete | Yes — no UI changed |
| Security review complete | Yes |
| Performance review complete | Yes |
| Documentation updated | Yes |
| ADRs updated | Yes |
| Technical debt documented | Yes |
| Risks documented | Yes |
| Blockers documented | Yes |
| Sprint memory completed | Yes — status remains OPEN |
| Pull Request reviewed | No — pending |
| Merge approved | No — CTO step pending |
| Retrospective published | Yes |
| Scorecard published | Yes |

## 19. Retrospective & Scorecard

- Retrospective: [`S03-retrospective.md`](../../engineering/retrospectives/S03-retrospective.md)
- Scorecard: [`S03-scorecard.md`](../../engineering/scorecards/S03-scorecard.md)
- Overall score: **8.4**

## 20. Next Sprint Authorization

| Gate | Met? |
|---|---|
| This sprint COMPLETE | No |
| PM authorizes Sprint 4 | No |
| CTO authorizes Sprint 4 | No |

**STOP — do not implement Sprint 4 until Sprint 3 is merged, closed, and the next-sprint gates pass.**
