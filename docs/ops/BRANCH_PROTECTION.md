# Branch protection recommendations — `main`

Apply in GitHub: **Settings → Rules → Rulesets** (or Branches → Branch protection).

## Required settings for `main`

| Setting | Value |
|---|---|
| Restrict deletions | On |
| Require a pull request before merging | On |
| Required approvals | **1** (raise to 2 when team > 1) |
| Dismiss stale reviews | On |
| Require review from Code Owners | On (after CODEOWNERS is valid) |
| Require status checks to pass | On |
| Required checks | `verify`, `governance-smoke` |
| Require branches to be up to date | On |
| Require conversation resolution | On |
| Block force pushes | On |
| Do not allow bypassing (except emergency admin) | On |

## Optional (enterprise)

- Require signed commits
- Restrict who can push to matching branches to maintainers only
- Lock branch after release tags for hotfixes-only workflow

## Apply checklist

- [ ] Ruleset created for `main`
- [ ] CI checks selected after first green Actions run
- [ ] CODEOWNERS path reviewed
- [ ] Admins tested merge flow with a dry-run PR

> This agent cannot enable branch protection without repository **admin** API rights. Owner must apply in the GitHub UI.
