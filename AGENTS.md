# Customer Acquisition OS — Agent Rules

This monorepo is governed by the **Engineering Constitution** and **Engineering Laws**.

**Authoritative sprint governance:** [docs/engineering/ENGINEERING_LAWS.md](./docs/engineering/ENGINEERING_LAWS.md)

**Canonical repository:** https://github.com/aldeville11/acquisition-os  
Do not implement Acquisition OS features inside Hostpitality.

Before any implementation:

1. Read `ENGINEERING_LAWS.md` and `ENGINEERING_CONSTITUTION.md`
2. Follow the [Sprint Playbook](./docs/engineering/SPRINT_PLAYBOOK.md)
3. Read previous sprint memory + retrospective + scorecard
4. Review open ADRs and technical debt
5. Pass `npm run governance:pre-sprint -- <N>`
6. Confirm work is **in-sprint** — no Sprint 3+ product work until approved

**Do not begin Sprint N+1 while Sprint N is OPEN.**  
**Do not mark COMPLETE without `npm run governance:close -- <N>`.**  
**Tenant Isolation Suite is mandatory CI forever.**

If readiness fails: STOP, explain the blocker, and do not write feature code.

Quality overrides speed. Engineering Laws supersede conflicting implementation prompts unless amended by an approved ADR.
