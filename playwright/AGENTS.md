# Agent Instructions — Playwright (derivatives-trader)

**Last Updated**: 2026-09-10
**Scope**: `playwright/` directory — applies to all AI agents working in this folder

> Playwright-specific rules stacking on top of the root `CLAUDE.md`.
> **Source of truth:** `playwright/AGENTS.md`. `CLAUDE.md` symlinks here for Claude Code.

---

## [CRITICAL] Skills — Auto-Loading

Load the matching skill immediately when the trigger is detected — before reading files, exploring the app, or writing any code.

| Trigger                                                                                    | Skill                                        |
| ------------------------------------------------------------------------------------------ | -------------------------------------------- |
| "playwright" mentioned (any casing, any context)                                           | `use_skill("playwright")`                    |
| Implementing gaps from `coverage.md`, or generating tests from `flow.md` / `catalog.md`    | `use_skill("flow-to-playwright-dtrader")`    |
| Analysing source in `packages/` to generate flow docs                                      | `use_skill("src-to-flow-dtrader")`           |
| Format/update a GitHub bughunt issue, create an issue from Slack, `/qa-bug-report`         | `use_skill("qa-bug-report")`                 |
| Manual QA test plan for a GitHub issue                                                     | `use_skill("qa-test-plan")`                  |
| Sending a PR review request                                                                | `use_skill("qa-pr-review")`                  |
| Ready for Staging issues → Slack milestone announcement (project #17)                      | `use_skill("qa-announce-ready-for-staging")` |
| AKO staging regression failure / re-run CI failures locally / `#project_dtrader_charts_v2` | `use_skill("qa-check-regression-failures")`  |

---

## Skills Directory

**Source of truth:** `playwright/e2e-tests-core/skills/<name>/SKILL.md`

**Claude Code:** `.claude/skills/<name>` → `playwright/e2e-tests-core/skills/<name>` (symlinks)

**Cursor:** `.cursor/skills/<name>` → `playwright/e2e-tests-core/skills/<name>` (symlinks)

When a skill is referenced, read the corresponding `SKILL.md` before proceeding:

| Skill name                      | Path                                                                      |
| ------------------------------- | ------------------------------------------------------------------------- |
| `playwright`                    | `playwright/e2e-tests-core/skills/playwright/SKILL.md`                    |
| `flow-to-playwright-dtrader`    | `playwright/e2e-tests-core/skills/flow-to-playwright-dtrader/SKILL.md`    |
| `src-to-flow-dtrader`           | `playwright/e2e-tests-core/skills/src-to-flow-dtrader/SKILL.md`           |
| `qa-test-plan`                  | `playwright/e2e-tests-core/skills/qa-test-plan/SKILL.md`                  |
| `qa-bug-report`                 | `playwright/e2e-tests-core/skills/qa-bug-report/SKILL.md`                 |
| `qa-pr-review`                  | `playwright/e2e-tests-core/skills/qa-pr-review/SKILL.md`                  |
| `qa-announce-ready-for-staging` | `playwright/e2e-tests-core/skills/qa-announce-ready-for-staging/SKILL.md` |
| `qa-check-regression-failures`  | `playwright/e2e-tests-core/skills/qa-check-regression-failures/SKILL.md`  |

---

## [CRITICAL] Project Structure

- All Playwright files live under `playwright/` — **NEVER** at the project root
- **Tests**: `playwright/tests/[feature]/[name].spec.ts`
- **Pages**: `playwright/pages/[Name]Page.ts`
- **Utils**: `playwright/utils/` — import from `../utils` (barrel export via `index.ts`)
- **Fixtures**: `playwright/fixtures/fixtures.ts` — **always import `test` from here, NEVER from `@playwright/test`**
- **Flows (docs)**: `playwright/flows/[feature]/` — catalog, coverage, spec per feature
- **Config**: `playwright.config.ts` at project root
- **Output**: `playwright/test-results/` (gitignored)
- **Env files**: `playwright/.env.staging` and `playwright/.env.production` (gitignored)

### [CRITICAL] Test Folder Naming — Must Mirror App Route Structure

When creating a **new test folder** under `playwright/tests/`, the folder name **MUST mirror the corresponding feature area** in the app.

| Feature area                  | `playwright/tests/` folder                                              |
| ----------------------------- | ----------------------------------------------------------------------- |
| Login / authentication        | `playwright/tests/auth/`                                                |
| Trade form + contract details | `playwright/tests/trade/`                                               |
| Live price feed               | `playwright/tests/feed/`                                                |
| Open positions                | `playwright/tests/positions/`                                           |
| Reports (P&L, statement)      | `playwright/tests/reports/`                                             |
| Notifications                 | `playwright/tests/notifications/`                                       |
| Automated trading (Automate)  | `playwright/tests/trade-automate/` · `playwright/flows/trade-automate/` |

**Rule**: Before creating a new folder, confirm the matching feature module exists in `packages/trader/src/` or `packages/core/src/`. Never invent a folder name with no app counterpart.

---

## [CRITICAL] Auth Flow

derivatives-trader uses the **Deriv OAuth / login page flow**:

1. Navigate to `process.env.LOGIN_URL` — Deriv login page
2. Enter email and password
3. Redirects back to the trading app

**For full login in tests**: use `loginPage.login()` — handles credentials from env vars.
**Credentials**: set `TEST_EMAIL` and `TEST_PASSWORD` in `playwright/.env.staging`.

---

## [CRITICAL] Locators

- Use fallback chains: `data-testid` → `getByRole()` → `getByLabel()` → `getByPlaceholder()` → CSS
- Define locators as **getter methods** in Page Objects — **never inline in tests**
- Never use brittle nth-child or deeply nested CSS selectors
- Use `.or()` chains to cover both desktop and mobile layouts

### ❌ Anti-pattern — inline locators in test files

```typescript
// ❌ WRONG — locator defined inline in test, not via POM
await page.getByTestId('dt_trade_container').first().click();
```

```typescript
// ✅ CORRECT — locator defined as getter in the Page Object, used via POM in the test
await tradePage.tradeContainer.first().click();
```

**Rule**: If a `page.getByTestId(...)`, `page.locator(...)`, or `page.getByRole(...)` call appears directly in a test file, it is a violation. Move it to the appropriate Page Object getter.

---

## [CRITICAL] Assertions

- Every assertion **MUST** include a descriptive message:
    ```typescript
    await expect(element, 'Trade container should be visible after login').toBeVisible();
    ```
- **Never** write bare assertions without a message — they are forbidden
- Use semantic assertion methods (`toBeVisible`, `toHaveText`, `toHaveURL`, etc.)

---

## [CRITICAL] Credentials & Security

- **Never hardcode credentials or fallback values** — use `process.env` and fail-fast
- If `TEST_EMAIL` or `TEST_PASSWORD` is missing, throw a descriptive error
- Never use `eval()`, `Function()`, or `innerHTML` with user-controlled data
- All test emails **must** use `@webapps.mailisk.net` domain by default
- **Playwright env files live in `playwright/`** — NOT at the project root:
    - `playwright/.env.staging` — staging credentials (gitignored)
    - `playwright/.env.production` — production credentials (gitignored)
- Run: `TEST_ENV=staging npx playwright test` (defaults to staging)

---

## [CRITICAL] Env File Encryption & Decryption

Plaintext env files are **gitignored**. Encrypted `.enc` versions are committed so CI can decrypt them.

**Script** (lives in `playwright/e2e-tests-core/scripts/`):

- `env-cipher.sh <encrypt|decrypt> <staging|production>` — encrypts `playwright/.env.<env>` → `playwright/.env.<env>.enc` or decrypts the reverse

**Local usage:**

```bash
ENV_ENCRYPTION_KEY="your-key" ./playwright/e2e-tests-core/scripts/env-cipher.sh encrypt staging
ENV_ENCRYPTION_KEY="your-key" ./playwright/e2e-tests-core/scripts/env-cipher.sh decrypt staging
```

**CI (GitHub Actions):** set `ENV_ENCRYPTION_KEY` as a repository secret:

```yaml
- name: Decrypt Playwright env files
  env:
      ENV_ENCRYPTION_KEY: ${{ secrets.ENV_ENCRYPTION_KEY }}
  run: ./playwright/e2e-tests-core/scripts/env-cipher.sh decrypt staging
```

**CI sharding:** smoke and regression runs use **4** shards per platform (`--shard=1/4` … `--shard=4/4`), including preview runs. Single-spec runs stay at one shard. Each shard uploads a `blob-{platform}-{shard}-{run_attempt}` artifact; a **per-platform `report` job** merges blobs, publishes the TestDino GitHub summary, and uploads HTML. Test jobs set `TESTDINO_STREAM=1` and `TESTDINO_CI_RUN_ID={run_id}-{attempt}-{platform}` so all shards of a platform group into one live TestDino run. Slack: each report job **collects** one `_result-{platform}.json`; the **`notify` job** sends a single aggregated message (per-platform failure threads when multiple browsers ran). Local runs do not shard by default — pass `--shard=1/4` when experimenting.

**Critical pitfalls:**

- ❌ Never encrypt using OpenSSL's own interactive prompt
- ❌ Never commit plaintext `playwright/.env.*` files
- ❌ Never encrypt the `.enc` file (double-encryption corrupts it)

---

## [CRITICAL] Fixtures & Page Objects

- Always use global fixtures from `playwright/fixtures/fixtures.ts` — never manually instantiate page objects in tests
- Page Object files must group methods by exactly **three** sections in this order: **Locators → Actions → Verifications**
    - **LOCATORS** — all getter properties and parameterized locator methods (top)
    - **ACTIONS** — navigation, clicks, fills, and any other user interactions (middle)
    - **VERIFICATIONS** — all `verify*` / assertion-only methods (bottom)
- To add a new page object: create in `playwright/pages/`, register in `playwright/fixtures/fixtures.ts`, then use via fixture

## [CRITICAL] One Page Object Per Route — Never Mix Page Locators

- **Every distinct route/feature gets its own Page Object** — locators for the trade form belong in `TradePage`, not `LoginPage`
- Never add locators from page B into the Page Object of page A just because the test navigates there from A
- When a test navigates to a new route and asserts on that route's content, destructure the matching page fixture in the test signature

---

## [CRITICAL] Page Object First Approach

- **Always create or update a Page Object before writing a test** — never put locators or interactions directly in test files
- Every UI interaction in a test must go through a Page Object method or getter
- If a page object does not exist for the page under test, create it first in `playwright/pages/` and register it in `playwright/fixtures/fixtures.ts` before writing the test

**Checklist before writing any test interaction:**

1. Does the Page Object already expose a getter for this element? → use it
2. If not → add the getter to the Page Object, then reference it in the test
3. Never bypass step 1 and 2 by writing the locator inline in the test

---

## [CRITICAL] Always Explore Pages with Playwright MCP Before Creating Page Objects

**Never assume the structure, flow, or locators of any page.** Before writing or updating a Page Object, you MUST:

1. **Use Playwright MCP to navigate to the page** and take a live snapshot to see the actual DOM structure, roles, and accessible names.
2. **Explore the full user flow** — many flows span multiple screens.
3. **Ask the user for context** when a page is behind authentication or requires setup data.
4. **Document what you find** — note the actual button labels, input placeholders, test IDs, and URL patterns before writing any locator.
5. **Never guess locators** — if you cannot navigate to the page, ask the user for a screenshot or DOM snapshot.

---

## [CRITICAL] Test Tags

Every `test.describe()` MUST have at least one `@feature-area` tag using the **official tag API**:

```typescript
// ✅ CORRECT
test.describe("Trade Form", { tag: ["@trade", "@smoke", "@desktop"] }, () => { ... });

// ❌ WRONG — never put tags in titles
test.describe("Trade Form @trade @smoke", () => { ... });
```

**Feature-area tags**: `@auth`, `@trade`, `@feed`, `@positions`, `@reports`, `@notifications`

**Execution tags**: `@smoke` (critical path), `@regression` (full suite), `@production` (safe on prod)

**Viewport tags** (required by CI): `@desktop`, `@mobile`

---

## [CRITICAL] Test Quality

- Test names must start with **`VERIFY`** (uppercase): `'VERIFY trade form loads after login'` — never `'should ...'`
- Tests must be **fully independent** — no test should depend on another test's state
- **Never use `waitForTimeout()`** — use `expect(...).toBeVisible()` or `waitForLoadState()`
- **Never set `timeout` in `test.describe.configure()`** — use `mode` only: `test.describe.configure({ mode: "serial" })`
- **Every new test must be verified as passing** before the task is considered complete

---

## [CRITICAL] Environment Variable Validation — Always Use `beforeAll`, Never Top-Level Throws

- **Never throw at the top level of a spec file** to validate environment variables
- **Always move env var validation into `test.beforeAll()`** inside `test.describe()`

```typescript
// ✅ CORRECT
test.describe('Trade', { tag: ['@trade'] }, () => {
    let BASE_URL: string = undefined!;

    test.beforeAll(() => {
        const url = process.env.BASE_URL;
        if (!url) throw new Error('BASE_URL not set in playwright/.env.staging');
        BASE_URL = url;
    });
});
```

---

## [CRITICAL] Autonomous Failure Resolution & Justification

When a test fails, act as a **Quality Engineer**:

1. **Investigation First**: Use Playwright MCP to inspect the DOM. Compare actual UI vs. test intent.
2. **Logic Gate**:
    - UI contradicts requirements → **Application Bug** — fix the app
    - UI changed intentionally → **Test Maintenance** — update locators
    - Timeout/network error → **Infrastructure/Flake** — stabilize the test
3. **Mandatory Justification**: Every fix must be preceded by a `🔍 FAILURE ANALYSIS` block.
4. **No Forbidden Shortcuts**: No deletion, commenting out, or weakening assertions to make tests pass.

---

## [CRITICAL] Page Load Verification — Always Confirm New Page Is Loaded

After **every** page state change (navigation, form submit, tab switch):

```typescript
// ✅ For Deriv API-driven pages — wait for WebSocket/XHR to settle
await NavigationUtils.waitForDerivApiSettled(page);

// ✅ For trading terminal pages — assert a landmark element
await expect(tradePage.tradeContainer, 'Trade container should load').toBeVisible();
```

**Never** rely on URL change alone — always confirm with a positive element assertion.

---

## [CRITICAL] Navigation

- Use UI element clicks for in-app navigation — **NEVER** hardcode URL paths
- `page.goto()` is acceptable only for the **initial entry point** (login page, app root)
- Always navigate by clicking the actual UI element that a real user would click

---

## [CRITICAL] Test Data (DataFactory)

- Always use `DataFactory` from `../utils` (barrel via `e2e-tests-core/utils`)
- Prefer `generateEmailWithPrefix('context')` over `generateEmail()` for traceability
- **Store generated data in variables** — never call `DataFactory` twice for the same value
- **Email local part must NEVER exceed 64 characters** (RFC 5321 hard limit)

---

## [CRITICAL] Change Impact — Full Reference Check

- **Any change** (utility, page object, function signature, import path) **MUST be propagated to all references** before the task is complete
- Search the entire `playwright/` directory for every usage of the changed symbol and update them all
- After updating, verify `npx tsc --noEmit -p playwright/tsconfig.json` passes

---

## [CRITICAL] Mobile Responsive Strategy

- Use `chromium-mobile` project (Pixel 5, 500×850) — already configured in `playwright.config.ts`
- **Single describe block per spec** — runs under both desktop and mobile projects automatically
- Detect in tests: `testInfo.project.name.includes("mobile")`
- Detect in POMs: `(this.page.viewportSize()?.width ?? 1024) < 1024`
- Use `.or()` chains to cover both layouts
- Never add `(Desktop)` / `(Mobile)` suffixes to test names — the project prefix handles this

---

## [CRITICAL] Scope — Never Modify Files Outside `playwright/`

- **Never modify any file outside the `playwright/` folder** (e.g., `packages/`, `src/`, root config files)
- If a `data-testid` needs to be added to a source component, **STOP — ask the user for confirmation first**
- Tests must adapt to the app's existing DOM — use the locator fallback chain rather than modifying the app

---

## [CRITICAL] TypeScript Best Practices

- Always use **strict TypeScript** — no `any` types unless absolutely unavoidable with a comment
- Use **explicit return types** on all functions and methods
- Use `readonly` for Page Object `page` properties
- Prefer `const` over `let`; never use `var`
- Use **optional chaining** (`?.`) and **nullish coalescing** (`??`)
- Never use non-null assertion (`!`) without a comment explaining why it is safe

---

## [CRITICAL] JSDoc & Code Comments

- All **classes** must have a JSDoc comment with a usage `@example`
- All **public methods** must have JSDoc with `@param` and `@returns`
- Comments must explain **why**, not just **what**

---

## [Should] Utilities

- Only add utilities that are **actually used** — no speculative functions
- A utility belongs in `playwright/utils/` only if it is used in 2+ places

---

## Project Structure

```
playwright/
├── AGENTS.md                # Source of truth — Playwright rules for all agents
├── CLAUDE.md                # Symlink → AGENTS.md (Claude Code)
├── fixtures/
│   └── fixtures.ts          # Global Playwright fixtures — always import from here
├── pages/                   # Page Objects — one file per page/flow
│   ├── LoginPage.ts
│   └── TradePage.ts
├── tests/                   # Test specs organised by feature area
├── flows/                   # Journey documentation (catalog, coverage, spec per feature)
│   └── _conventions/        # Naming and tag conventions
├── utils/
│   ├── index.ts             # Barrel export — import all utils from here
│   ├── testData.ts          # TestData helper (document/image paths)
│   └── (all utils re-exported from e2e-tests-core/utils — DataFactory, NavigationUtils,
│       MailiskUtils, createAccountV1, createAccountV2, topupAccount, changePoiPoaStatus,
│       enableFeatureFlags, disableFeatureFlags, getFeatureFlags, CoinGeckoUtils)
├── test-data/
│   ├── documents/           # PDF / doc files for upload tests
│   └── images/              # Image files for upload tests
├── e2e-tests-core/          # Vendored shared QA utilities (see e2e-tests-core/README.md)
│   └── scripts/
│       └── env-cipher.sh    # Encrypt/decrypt playwright/.env.* ↔ .env.*.enc
├── test-results/            # Screenshots, traces, HTML report, JSON (gitignored)
├── playwright-report/       # HTML report output (gitignored)
├── tsconfig.json            # Playwright-specific TypeScript config
├── .env.staging             # Staging credentials (gitignored — commit .enc)
├── .env.staging.enc         # Encrypted staging credentials (committed)
├── .env.production          # Production credentials (gitignored — commit .enc)
└── .env.production.enc      # Encrypted production credentials (committed)
```

---

## Key Conventions

| Convention               | Rule                                                                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Default email domain     | `@webapps.mailisk.net`                                                                                                             |
| Env var for Mailisk      | `MAILISK_API_KEY`                                                                                                                  |
| Login env vars           | `TEST_EMAIL`, `TEST_PASSWORD`, `LOGIN_URL`                                                                                         |
| Run env                  | `TEST_ENV=staging` (default) or `TEST_ENV=production`                                                                              |
| Base URL                 | `BASE_URL` env var or `https://staging-dtrader.deriv.com`                                                                          |
| PR preview (local)       | `TEST_ENV=staging BASE_URL=https://…pages.dev/ npx playwright test …` — staging credentials, preview frontend                      |
| PR preview (CI)          | Playwright workflow `preview_url` input — decrypts `.env.staging`, sets `BASE_URL` override (not valid with `test_env=production`) |
| CI sharding              | Default 4 shards/platform (smoke + regression) · Spec file: 1 — per-platform HTML in `playwright-report-{platform}-*`              |
| Login flow               | Single-step OAuth via Deriv login page → redirect to app                                                                           |
| Full login shortcut      | `loginPage.login()` — reads `TEST_EMAIL` / `TEST_PASSWORD`                                                                         |
| Mobile detection in POM  | `(this.page.viewportSize()?.width ?? 1024) < 1024`                                                                                 |
| Mobile detection in test | `testInfo.project.name.includes("mobile")`                                                                                         |
