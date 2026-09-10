---
name: playwright
description: Comprehensive Playwright testing patterns and best practices for home-app (deriv-com/home-app)
version: 2.0.0
last_updated: 2026-04-16
---

# Playwright Best Practices & Skills Guide

This skill provides comprehensive patterns and reference material for writing high-quality Playwright tests in the `home-app` project. Content is split into focused resource files for efficient loading.

## When to Use This Skill

**Use this skill when:**

- Writing new Playwright tests for any feature
- Creating or updating Page Object Models
- Implementing test fixtures and utilities
- Debugging failing tests or flaky behavior
- Setting up test infrastructure and configuration
- Reviewing test code for quality and best practices

**Don't use this skill when:**

- Writing unit tests (use Jest/Vitest patterns instead)
- Making standalone API calls outside Playwright test context — use resource 07 (qa-script-runner) and 08 (mailisk) inside tests; standalone API skills are not vendored in this repo.

---

## Resource Index

Load only the resources relevant to your current task. Each file is self-contained.

| #   | Resource                                                       | Description                                                                              | Load when...                                                                              |
| --- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 01  | [project-structure](resources/01-project-structure.md)         | Folder layout, config, architecture principles                                           | Setting up or navigating the project                                                      |
| 02  | [page-object-model](resources/02-page-object-model.md)         | POM patterns, locator strategies, cross-domain POMs                                      | Creating or updating page objects                                                         |
| 03  | [test-writing](resources/03-test-writing.md)                   | Assertions, test org, auto-waiting, error handling, failure resolution                   | Writing or debugging tests                                                                |
| 04  | [advanced-patterns](resources/04-advanced-patterns.md)         | MCP setup, security, CI/CD, anti-patterns, clean code, quality metrics                   | Reviewing code quality or advanced topics                                                 |
| 05  | [mobile-testing](resources/05-mobile-testing.md)               | Mobile viewport detection, responsive locators, overlay guards                           | Writing mobile-responsive tests                                                           |
| 06  | [data-factory](resources/06-data-factory.md)                   | Email generation, user profiles, test data                                               | Generating test data with DataFactory                                                     |
| 07  | [qa-script-runner](resources/07-qa-script-runner.md)           | Account creation, wallet topup, POI/POA changes                                          | Creating staging accounts in tests                                                        |
| 08  | [mailisk](resources/08-mailisk.md)                             | Email retrieval, OTP extraction                                                          | Handling email/OTP verification in tests                                                  |
| 09  | [social-account-runner](resources/09-social-account-runner.md) | Social/OAuth account management                                                          | Testing social login flows                                                                |
| 10  | [feature-flags](resources/10-feature-flags.md)                 | Feature flag utilities                                                                   | Working with feature flags in tests                                                       |
| 11  | [navigation-and-pages](resources/11-navigation-and-pages.md)   | NavigationUtils, page load verification, transfer patterns                               | Navigating between pages or debugging load issues                                         |
| 12  | [env-encryption](resources/12-env-encryption.md)               | Encrypting/decrypting `.env.*` files with OpenSSL, CI setup, CI security rules, pitfalls | Managing env file encryption, setting up CI decrypt step, or reviewing CI secret handling |
| 13  | [husky-git-hooks](resources/13-husky-git-hooks.md)             | Git hooks, pre-push checks, phases, AI push constraints                                  | Pushing code, understanding hook failures, CI bypass                                      |
| 14  | [ci-cd-workflow-sync](resources/14-ci-cd-workflow-sync.md)     | Engine/caller sync, planner.json, shared scripts                                         | Editing GitHub Actions workflows or shared scripts                                        |

---

## Decision Tree: What to Load

| I need to...                                         | Load these resources                            |
| ---------------------------------------------------- | ----------------------------------------------- |
| Write a new test                                     | 03 (test-writing)                               |
| Create a Page Object                                 | 01 (project-structure) + 02 (page-object-model) |
| Generate test data                                   | 06 (data-factory)                               |
| Create a staging account                             | 06 (data-factory) + 07 (qa-script-runner)       |
| Handle OTP verification                              | 08 (mailisk)                                    |
| Write a mobile test                                  | 05 (mobile-testing) + 03 (test-writing)         |
| Debug navigation issues                              | 11 (navigation-and-pages)                       |
| Test social login                                    | 09 (social-account-runner)                      |
| Review or audit code quality                         | 04 (advanced-patterns)                          |
| Encrypt/decrypt env files or set up CI decrypt       | 12 (env-encryption)                             |
| Review CI secret handling or GitHub Actions security | 12 (env-encryption)                             |
| Understand git hooks / push failures                 | 13 (husky-git-hooks)                            |
| Edit GitHub workflows                                | 14 (ci-cd-workflow-sync)                        |
| Full onboarding / all topics                         | All resources (01-14)                           |

---

## Project-Specific Notes

> home-app uses `playwright/tests/` (not `tests/`) and `playwright/fixtures/fixtures.ts` as the fixture entry point.
> All output goes to `playwright/test-results/`. Env files live in `playwright/.env.staging` / `playwright/.env.production`.
> Login is **2-step** via Ory Kratos: `LoginPage` (email) → `EnterPasswordPage` (password) → `HomePage`.
> **`basePath`** is **`/dashboard`** — use full paths (or a `baseURL` that includes it) when asserting URLs. Deposit/withdraw/payment-agent and portfolio wallet UI **`data-testid`** values are listed in **`docs/web-conversion-skills/23-playwright-test-ids.md`** (e.g. `withdraw-pa-caption-limits`, `withdraw-pa-input-agent-id-status-*`; **`/withdraw/verify`** — `withdraw-verify-input-otp`, `withdraw-verify-btn-otp-help`, `withdraw-verify-dialog-otp-help`). **Transfer review modal:** the cross-currency secondary line under “You’ll receive” uses **`transfer-sheet-review-text-received-from`**; **`TransferPage.reviewReceivedFromEquivalent`** targets it (legacy alias **`reviewReceivedUsd`** still points at the same locator). **Transfer trading icons:** Quill SVGs expose **`account-icon-quill-*`** test IDs (see **`23-playwright-test-ids.md`** § Transfer). **Home total balance text:** formatted with two decimals + thousands commas — assert **`dashboard-text-total-balance`** accordingly (**`10-portfolio-wallets.md`**).
> **Quill outline `Textfield` vs `TabOrderOutlineTextfield`:** Onboarding personal details/address and profile personal details/home address wrap outline text fields with **`TabOrderOutlineTextfield`** so the `<input>` exists when empty — **`fill()`** / **`getByRole('textbox')`** work without dispatching a click on Quill’s internal `label.quill-label-lCn7V`. Other screens may still need the inner-label **`dispatchEvent('click')`** pattern; see **`flow-to-playwright`** skill and **`docs/web-conversion-skills/05-ui-design-system.md`**.
> **Home — My trading accounts:** **`dashboard-btn-deposit-{loginId}`** appears when **`isFirstDepositComplete`** is false (`src/lib/onboarding-prompt.ts`). **`HomePage.verifyRealMT5CardTradeTransferDetails`** / **`verifyRealCardTradeTransferOnly`** branch on **Transfer vs Deposit** after Trade (Cashier deposit vs transfer panel). **`cardDepositButton`** scopes to the card with **`[data-testid^="dashboard-btn-deposit-"]`** — do not use English **`hasText: 'Deposit'`** on card buttons for i18n runs. **More drawer:** **`getByTestId('more-drawer-heading-section-partnership')`** / **`download_apps`**; row buttons **`moreDrawerPartAffiliate`**, **`moreDrawerPartApi`**, **`moreDrawerDlDerivApp`**; **`verifyMorePageForReal`** / **`verifyMorePageForDemo`**. Stacked Deriv app modal: **`more-drawer-modal-deriv-app`** (**`23-playwright-test-ids.md`**).

---

## Related Skills

- [flow-to-playwright-dtrader](../flow-to-playwright-dtrader/SKILL.md) — implement coverage gaps as Playwright tests
- [src-to-flow-dtrader](../src-to-flow-dtrader/SKILL.md) — document flows from `packages/` source
- [qa-bug-report](../qa-bug-report/SKILL.md) — format or create GitHub bug reports
- See `playwright/flows/_github-issues.md` for the GitHub-issue-from-failure workflow (no dedicated skill in this repo)

## References

- [Playwright Official Docs](https://playwright.dev/docs/intro)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright Test API](https://playwright.dev/docs/api/class-test)
