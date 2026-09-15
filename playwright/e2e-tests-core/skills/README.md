# Agent Skills Catalog

**Last Updated**: September 15, 2026
**Total Skills**: 9

This directory contains agent skills vendored for **derivatives-trader** Playwright / QA workflows. Edit files here directly — this repo does not use a live `e2e-tests-core` git submodule (see `playwright/e2e-tests-core/README.md`).

---

## Skills Overview

| Skill                                                                     | Description                                                                                | Primary Use Case                                                 |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| [playwright](./playwright/SKILL.md)                                       | Core testing skill: POM, fixtures, DataFactory, QA Script Runner, Mailisk, NavigationUtils | Writing tests, page objects, test data, account setup, email/OTP |
| [flow-to-playwright-dtrader](./flow-to-playwright-dtrader/SKILL.md)       | Converts `flow.md` / `catalog.md` / `coverage.md` into Playwright test files               | Implementing coverage gaps as tests                              |
| [src-to-flow-dtrader](./src-to-flow-dtrader/SKILL.md)                     | Analyses `packages/` source and generates flow docs for a feature                          | Documenting app flows from DTrader monorepo source               |
| [qa-bug-report](./qa-bug-report/SKILL.md)                                 | Format/update GitHub bughunt issues; create issues from Slack threads                      | `/qa-bug-report`, Slack → GitHub                                 |
| [qa-announce-ready-for-staging](./qa-announce-ready-for-staging/SKILL.md) | Announce project #17 "Ready for Staging" cards in Slack; request milestone                 | Staging-ready issues, project board view #2                      |
| [qa-check-regression-failures](./qa-check-regression-failures/SKILL.md)   | Triage AKO staging regression failures; re-run locally; reply in Slack thread              | Staging E2E regression failed, flaky vs real                     |
| [qa-pr-review](./qa-pr-review/SKILL.md)                                   | Sends a formatted PR review request to the QA Slack channel                                | Requesting PR reviews from the team                              |
| [qa-test-plan](./qa-test-plan/SKILL.md)                                   | Post a manual QA test-plan checklist on a GitHub issue                                     | Test plan / checklist for a QA-tracked issue                     |
| [qa-milestone-to-playwright](./qa-milestone-to-playwright/SKILL.md)       | Triage all milestone issues for Playwright gaps; automate feasible ones in one pass        | Release milestone URL/number                                     |

**Not vendored here:** standalone API skills (`qa-script-runner-api`, `qa-mailisk-api`), and home-app-only flow skills (`src-to-flow`, `flow-to-playwright`, etc.). The former `gap-to-playwright` skill is superseded by **`qa-milestone-to-playwright`** (milestone scope) plus **`flow-to-playwright-dtrader`** (single gap). Account creation and Mailisk/OTP outside tests are covered inside the **playwright** skill (resources 07 and 08). GitHub issues from test failures: `playwright/flows/_github-issues.md`.

---

## Skill Architecture

The **playwright** skill is the comprehensive reference for Playwright test development in this repo:

- Test structure and organization
- Page Object patterns and locator strategies
- **DataFactory** — test data generation
- **QA Script Runner** — account creation, wallet topup, POI/POA (staging, inside tests)
- **Mailisk** — email retrieval and OTP extraction (inside tests)
- **NavigationUtils** — API settlement after page state changes

Other skills in this folder are **workflow skills** (QA Slack/GitHub, flow docs, regression triage) — load them via triggers in `playwright/AGENTS.md` or when the task matches the decision tree below.

```
┌─────────────────────────────────────────────────────┐
│              PLAYWRIGHT TEST CONTEXT                 │
│                                                      │
│  playwright/SKILL.md (Core Skill)                    │
│      ├─→ DataFactory — test data generation          │
│      ├─→ QA Script Runner — account setup (staging)  │
│      ├─→ Mailisk — email/OTP retrieval               │
│      └─→ NavigationUtils — API settlement            │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│              QA / DOCS WORKFLOWS                     │
│  qa-* skills, flow-to-playwright-dtrader,            │
│  src-to-flow-dtrader (see Skills Overview)          │
└─────────────────────────────────────────────────────┘
```

---

## Decision Tree: Which Skill Do I Need?

| I need to…                                              | Use                                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------------------- |
| Write a new test                                        | [playwright](./playwright/SKILL.md)                                       |
| Generate test data (emails, names, addresses)           | [playwright](./playwright/SKILL.md) — DataFactory (resource 06)           |
| Create a test account (staging, inside a test)          | [playwright](./playwright/SKILL.md) — QA Script Runner (resource 07)      |
| Retrieve an OTP or verification email (inside a test)   | [playwright](./playwright/SKILL.md) — Mailisk (resource 08)               |
| Wait for API data to settle after navigation            | [playwright](./playwright/SKILL.md) — NavigationUtils (resource 11)       |
| Document flows from `packages/` source (DTrader)        | [src-to-flow-dtrader](./src-to-flow-dtrader/SKILL.md)                     |
| Convert flow docs into Playwright test files            | [flow-to-playwright-dtrader](./flow-to-playwright-dtrader/SKILL.md)       |
| Create GitHub issues for Playwright test failures       | `playwright/flows/_github-issues.md` workflow / manual                    |
| Format a bughunt issue or create one from Slack         | [qa-bug-report](./qa-bug-report/SKILL.md)                                 |
| Manual QA test plan for a GitHub issue                  | [qa-test-plan](./qa-test-plan/SKILL.md)                                   |
| Announce Ready for Staging cards / request milestone    | [qa-announce-ready-for-staging](./qa-announce-ready-for-staging/SKILL.md) |
| Triage AKO staging regression / re-run failures locally | [qa-check-regression-failures](./qa-check-regression-failures/SKILL.md)   |
| Request a PR review on Slack                            | [qa-pr-review](./qa-pr-review/SKILL.md)                                   |
| Scan a release milestone for Playwright gaps + automate | [qa-milestone-to-playwright](./qa-milestone-to-playwright/SKILL.md)       |

---

## Audit History

| Date       | Action             | Details                                                                                                                                                                                        |
| ---------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-02-19 | Initial Audit      | Audited all skills against Claude best practices                                                                                                                                               |
| 2026-02-19 | Catalog Created    | Created this master index for skill discovery                                                                                                                                                  |
| 2026-02-24 | Standalone Skills  | Added qa-script-runner-api and qa-mailisk-api skills (upstream; not vendored in derivatives-trader)                                                                                            |
| 2026-02-27 | Consolidation      | Merged data_factory, qa_script_runner, mailisk into playwright skill                                                                                                                           |
| 2026-04-17 | New Skill          | Added flow-to-playwright skill                                                                                                                                                                 |
| 2026-04-21 | New Skill          | Added src-to-flow skill                                                                                                                                                                        |
| 2026-05-04 | New Skill          | Added qa-pr-review skill                                                                                                                                                                       |
| 2026-09-10 | derivatives-trader | Vendored qa-bug-report, qa-announce-ready-for-staging, qa-check-regression-failures; removed qa-mailisk-api and gap-to-playwright; README aligned to DTrader skill names and vendored set only |
| 2026-09-15 | derivatives-trader | Added qa-milestone-to-playwright — triage all release milestone issues and automate Playwright gaps                                                                                            |

**Last Audit**: September 15, 2026

---

**Maintained by**: QA Automation Team
