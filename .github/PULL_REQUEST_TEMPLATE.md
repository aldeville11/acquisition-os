## Summary
<!-- What changed and why. Link issues/ADRs. -->

## Type of change
- [ ] Feature (in-sprint only)
- [ ] Bug fix
- [ ] Chore / docs / CI
- [ ] ADR / governance
- [ ] Hotfix

## Governance
- [ ] In scope for the **current approved sprint** (or chore with no product scope)
- [ ] Sprint N COMPLETE before starting N+1 (`governance:pre-sprint` PASS if implementing)
- [ ] No out-of-scope features (see Engineering Laws)
- [ ] Technical debt documented if introduced
- [ ] ADR updated/added if architectural

## Tenant isolation (if touching tenancy/data)
- [ ] No cross-tenant queries
- [ ] Isolation suite still green (`npm run test:isolation -w @acquisition-os/api`)

## Test plan
- [ ] `npm run env:check`
- [ ] `npm run verify`
- [ ] `npm run test:isolation -w @acquisition-os/api` (mandatory)
- [ ] Manual checks (list):

## Risk / rollback
<!-- How to revert; production impact -->
