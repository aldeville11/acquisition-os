# Sprint 3 Plan — AuthZ + Audit

**Status:** **PENDING APPROVAL** — planning only; **do not implement**  
**Sprint:** 03 — authz-audit  
**Governance:** [ENGINEERING_LAWS.md](./ENGINEERING_LAWS.md)  
**Pre-sprint gate:** `npm run governance:pre-sprint -- 3` — **NOT PASS** (intentionally incomplete until this plan is approved and PM · CTO authorize)  
**Authoritative timebox:** Engineering Execution Plan **S3 AuthZ + Audit** (over Architecture sprint numbering)

> **STOP:** Do not implement until this plan is approved (CTO · Product Manager · Backend Lead · Security Engineer).  
> Sprint planning ≠ implementation authorization ≠ `governance:pre-sprint` PASS.  
> Repository: `aldeville11/acquisition-os` · Working branch for this plan: `cursor/sprint-3-planning-114e`

---

## Confirmation (planning intake)

| Check | Result |
|---|---|
| Repository | **`acquisition-os`** (`https://github.com/aldeville11/acquisition-os`) — not Hostpitality |
| Base branch | `main` (Sprint 2 COMPLETE + hardening) |
| Planning branch | `cursor/sprint-3-planning-114e` |
| Sprint 2 status | **COMPLETE** — memory, retrospective, scorecard, INDEX; `governance:close -- 2` **PASS** (32/32) |
| CI on `main` | Green — Acquisition OS CI success on latest `main` push |
| Repo hardening | Done (CI, templates, CODEOWNERS, SECURITY, Dependabot, env:check, …) |
| Sprint 3 implementation | **Not started** — no AuthZ matrix live; `assertPermission` still throws `RBAC_NOT_READY`; no AuditEvent module; no `S03` memory; INDEX next-read forbids implement without plan + pre-sprint |
| Isolation suite | Mandatory forever (S2); S3 expands authz/cross-tenant cases |

---

## Required reads completed (planning)

| Document | Status |
|---|---|
| Engineering Laws | Reviewed on disk |
| Engineering Constitution | Reviewed on disk |
| Sprint 2 Plan / Release Summary / Coverage | Reviewed |
| Sprint 2 Memory · Retrospective · Scorecard | Reviewed |
| Sprint 1 Memory (AuditEvent / #21 carry-forward) | Reviewed |
| AUTH.md · TENANCY.md · SECURITY.md | Reviewed |
| Open ADRs (0001–0008 index) | Reviewed — no AuthZ/Audit ADR yet |
| Technical debt #19–#22 | Reviewed — prioritized below |
| Product Constitution (RBAC intent / matrix) | **Not persisted under `docs/`** — interim transcript + frozen role keys in code; **persisting / ADR for matrix is an S3 dependency** |
| Engineering Architecture / Execution Plan S3 row | **Not persisted under `docs/`** — interim transcript + S1–S2 docs; Execution Plan naming wins over Architecture §10 spine bundling |

### Conflict note (no invention)

Architecture historically bundled AuthN + tenancy + RBAC + outbox. **Execution Plan** splits: S1 AuthN · S2 Tenancy · **S3 AuthZ + Audit** · S4 outbox. This plan follows the Execution Plan. CSRF (#19), auth rate limits (#20), session idle/revoke-all (#22 remainder), and outbox workers remain **out of scope** unless explicitly promoted by ADR + re-approval.

---

## 1. Objectives

1. Enforce **server-side RBAC** from the Product Constitution capability matrix using **deny-by-default** evaluation (replace `RbacNotReadyError` fail-closed stub with real deny/allow).  
2. Bind authorization to **AuthContext** populated from active Membership (`role`, `organizationId`, `workspaceId`, `locationScope`) — never trust client-supplied role/org as authority.  
3. Gate existing authenticated admin surfaces (Identity invite stub, Tenancy CRUD) with explicit **permission checks**; unauthenticated remains denied; insufficient privilege returns fail-closed **403** (not silent success).  
4. Deliver durable **AuditEvent** persistence and writers for security-relevant actions (at minimum: login success/failure, permission denials, tenancy admin mutations, membership assign) — **separate from** Sprint 2 `domain_events`.  
5. Expand the **Tenant Isolation Test Suite** with AuthZ cases (wrong role / cross-tenant capability attempts) while keeping the suite mandatory in CI.  
6. Unit + integration tests, documentation (`AUTH.md` / new audit notes), ADR for AuditEvent (+ matrix if needed), Sprint 3 memory packet — **no UI redesign**.  
7. Version bump to **0.3.0** only when Sprint 3 is CLOSED COMPLETE under Law 001.

---

## 2. Acceptance Criteria

| ID | Criterion | Source |
|---|---|---|
| AC-1 | `assertPermission(actor, permission)` evaluates the Constitution matrix: **allow** when role grants capability in tenant context; otherwise **deny** (throw/403). `RBAC_NOT_READY` is removed from production path | EP S3 · `rbac.ts` |
| AC-2 | Deny-by-default: unknown permission keys, missing membership/role, inactive user, or missing tenant context ⇒ **deny** | Constitution · Security |
| AC-3 | Constitution v1 **role keys** remain frozen vocabulary (`owner` … `administrator`); membership reject non-Constitution roles (already S2) | `CONSTITUTION_ROLE_KEYS` |
| AC-4 | Tenancy admin APIs require appropriate permissions (org/location/workspace/membership mutations and reads as mapped); authenticated-but-unauthorized ⇒ **403** | TENANCY.md · Security |
| AC-5 | Invite stub / Identity privileged paths use `assertPermission` (e.g. `users.invite`) instead of not-ready | AUTH.md · probe |
| AC-6 | `location_scope`: when non-empty, location-scoped actions are denied outside scope; empty scope ⇒ all workspace locations (ADR 0005) | ADR 0005 |
| AC-7 | Hard **Organization** isolation remains: AuthZ never grants cross-org access; isolation suite still mandatory + expanded | S2 suite · EP |
| AC-8 | **AuditEvent** records exist for: successful login, failed login, permission denial (sample path), and at least one tenancy mutation + membership assign | #21 · EP S3 |
| AC-9 | Audit store is **not** the `domain_events` table; domain events continue as S2 integration facts (outbox still S4) | Architecture clarity |
| AC-10 | `GET /api/v1/auth/rbac/probe` reflects live RBAC (ready / allowed or denied) — no longer 501 not-ready | routes probe |
| AC-11 | No CSRF/#19, no rate limit/#20, no session idle/revoke-all/#22, no outbox/workers, no UI redesign, no customer Lead/Pipeline features | Explicit out of scope |
| AC-12 | Docs + tests + `governance:close -- 3` before COMPLETE; version notes point at 0.3.0 | VERSIONING · Law 001 |

**Demo (implied by AC):** As `owner` (or mapped admin role) perform a permitted tenancy mutation; as `read_only` (or mapped) receive **403** on the same mutation; inspect AuditEvent rows for login + denial + mutation.

---

## 3. Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Product Constitution matrix not on disk → invented permissions | H | H | Persist matrix under `docs/` **or** accept ADR 0009 (AuthZ matrix + AuditEvent) before coding enforcement; PM sign-off on capability list |
| Over-granting `owner` / `administrator` | M | H | Deny-by-default tests; Security review checklist |
| Conflating `domain_events` with AuditEvent | M | H | Separate table/module; ADR non-goal for domain_events reuse |
| Breaking bootstrap (create org before membership) | M | H | Document bootstrap exception narrowly (e.g. first-org create) **only if Constitution allows**; otherwise keep authenticated seed/admin path with explicit permission |
| Treating AuthContext `role` string as UI-only leftover | M | M | Enforce only via `assertPermission`; never duplicate ad-hoc role checks in routes |
| Multi-membership AuthContext = “latest active” (S2 debt) | M | M | Document; do not invent workspace switcher; AuthZ uses current AuthContext only |
| Scope creep into #19/#20/#22 or S4 outbox | M | H | AC-11; reject PRs that expand scope without ADR |

---

## 4. Dependencies

| Dependency | Status |
|---|---|
| Sprint 2 COMPLETE | **Done** |
| Repo hardening + CI green on `main` | **Done** (CI verified) |
| Branch protection applied in GitHub UI | Owner action — recommended before merge of S3 implementation; planning may proceed |
| Explicit **approval of this plan** | **Pending** |
| `governance:pre-sprint -- 3` PASS | **Blocked** until plan approved + checklist complete + PM/CTO authorize |
| ADR for AuthZ matrix + AuditEvent model (proposed **0009**) | **Required before/at implementation start** — Accept with plan or first implementation PR |
| ADR 0002 / 0005 / 0008 | Accepted — foundations |
| Constitution / Architecture / EP files under `docs/` | Still missing — carry-forward debt; S3 must not invent product rules |

**Not dependencies for S3:** ADR 0003 queue, ADR 0004 framework change, ADR 0006 encryption, issues #19 #20 #22.

---

## 5. Definition of Done

- [ ] Code reviewed; Acquisition OS CI green (`npm run verify` + isolation suite)  
- [ ] RBAC matrix documented (docs and/or Accepted ADR) and enforced server-side  
- [ ] Deny-by-default covered by unit tests (unknown permission, wrong role, cross-tenant)  
- [ ] Tenancy + Identity privileged routes permission-gated  
- [ ] AuditEvent module persisted + writers for AC-8 events  
- [ ] Isolation suite expanded (AuthZ cases) and still mandatory in CI  
- [ ] Probe no longer returns RBAC not-ready  
- [ ] Observability: structured logs on authz denials / audit write failures  
- [ ] A11y: N/A if no UI change  
- [ ] Docs: AUTH.md + audit notes; ADR index; debt links mirrored in this repo if practical  
- [ ] Product accepts AC-1…AC-12  
- [ ] Security review signed (Security Engineer)  
- [ ] Sprint memory + retrospective + scorecard  
- [ ] `npm run governance:close -- 3` PASS before COMPLETE  
- [ ] Package version **0.3.0** only after COMPLETE  
- [ ] No Sprint 4 authorization unless S3 COMPLETE  

---

## 6. Proposed technical outline (not implementation)

*Informational for reviewers — code lands only after approval + pre-sprint PASS.*

| Area | Approach |
|---|---|
| Module | Extend `apps/api/src/identity/rbac.ts`; add `apps/api/src/audit/**` (or `platform/audit`) |
| Matrix | Pure function `can(role, permission, context)`; data from frozen Constitution matrix doc/ADR |
| Middleware | Thin helper used by routes: load AuthContext → `assertPermission` → handler |
| Tenancy | Keep `TenantContext` / org isolation; add permission keys per route family |
| Schema | New `audit_events` table (SQL migration on ADR 0008 store); columns TBD in ADR 0009 (actor, org, action, outcome, resource, request metadata, created_at) |
| Probe | Update `/auth/rbac/probe` to exercise live check |
| Frontend | **No redesign** — shell unchanged |
| Tests | Unit matrix + integration deny/allow + isolation suite expansion |

### Suggested permission key families (draft — final list = Constitution/ADR)

Examples for reviewers (must be replaced by authoritative matrix):

- `users.invite`  
- `organizations.create` / `organizations.read`  
- `locations.create` / `locations.read`  
- `workspaces.create` / `workspaces.read`  
- `memberships.assign` / `memberships.read`  

Role→capability mapping is **not** invented here; it ships only with Product Constitution persistence or Accepted ADR 0009.

---

## 7. Explicit out of scope

- CSRF double-submit (#19)  
- Auth rate limiting (#20)  
- Session idle timeout / revoke-all remainder (#22)  
- Full outbox publisher/workers (Sprint 4)  
- UI redesign / Settings Users·Roles·Audit product screens (Gate A names the module; S3 is **API/platform AuditEvent**, not Audit UI)  
- Customer-facing features (Leads, Pipeline, Calls, …)  
- SSO / OIDC (ADR 0002 P1)  
- HQ multi-workspace franchise rollup (ADR 0005 P1+)  
- Changing web framework (ADR 0004)  

---

## 8. Technical debt prioritization (this sprint)

| Item | In S3? | Notes |
|---|---|---|
| #21 AuditEvent | **Yes** | Core deliverable |
| RBAC enforcement (planned deferred) | **Yes** | Core deliverable |
| Persist Constitution/Architecture/EP under `docs/` | **Recommended** | Unblocks matrix authority; at minimum matrix ADR |
| Multi-membership AuthContext selection | No | Document only |
| #19 CSRF / #20 rate limit / #22 session | No | Remain open post-S3 |
| Async outbox | No | Sprint 4 |

---

## 9. Approval signatures (implementation gate)

| Role | Decision | Date |
|---|---|---|
| Product Manager | ⏳ Pending | |
| Backend Lead | ⏳ Pending | |
| Security Engineer | ⏳ Pending | |
| CTO | ⏳ Pending | |

**Implementation not authorized** until all required signatures are ✅ and `npm run governance:pre-sprint -- 3` exits 0.

---

## 10. After approval

1. Complete `docs/engineering/checklists/sprints/S03-pre-sprint.md` (PM · CTO authorize).  
2. Run `npm run governance:pre-sprint -- 3` — require PASS.  
3. Accept ADR 0009 (AuthZ matrix + AuditEvent model) if not accepted with this plan.  
4. Implement Sprint 3 **only** per this plan.  
5. At completion: tests, isolation expansion, docs, memory, retro, scorecard, `governance:close -- 3`.  
6. Do **not** start Sprint 4 until S3 COMPLETE + readiness.

---

## 11. Planning artifacts in this change set

| Path | Purpose |
|---|---|
| `docs/engineering/SPRINT_3_PLAN.md` | This plan (pending approval) |
| `docs/engineering/checklists/sprints/S03-pre-sprint.md` | Scaffold only — unchecked authorization items |
| `docs/engineering/checklists/sprints/S03-close.md` | Scaffold only |

No product/API implementation files are included.
