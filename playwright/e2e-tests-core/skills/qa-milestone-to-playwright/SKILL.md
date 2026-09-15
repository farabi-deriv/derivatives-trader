---
name: qa-milestone-to-playwright
description: >-
    Scan all issues in a release GitHub milestone, triage Playwright coverage gaps
    against playwright/flows/, and automate every feasible gap in one pass (flow docs +
    specs + coverage updates). Use when the user gives a milestone URL/number/title,
    asks to close Playwright gaps for a release, or invokes qa-milestone-to-playwright.
version: 1.2.1
last_updated: 2026-09-15
---

# QA Milestone → Playwright (triage + automate)

End-to-end workflow for a release milestone:

1. **Fetch every issue** linked to the milestone (all labels, all states).
2. **Triage** each issue against `playwright/flows/` and existing specs.
3. **Automate** every gap that is feasible — update flow docs when needed, write specs, refresh `coverage.md`, run tests locally.
4. **Report** counts, skips, and links in chat (drafted via a temp markdown file, then deleted).

This skill **orchestrates** existing skills — do not reimplement their rules inline:

| Child skill                  | When to load                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `playwright`                 | Always — POM, fixtures, env, navigation                                                                                        |
| `src-to-flow-dtrader`        | New user journey not in any `flow.md`, or module flow docs are stale for the changed area                                      |
| `flow-to-playwright-dtrader` | Gap has (or just gained) a `flow.md` / `catalog.md` entry                                                                      |
| `qa-test-plan`               | Issue research pattern only (issue + fix PR + diff + flow mapping) — **do not** post manual QA checklists unless the user asks |

## When to use

- User gives a milestone URL like `https://github.com/deriv-com/derivatives-trader/milestone/11`
- User names a release milestone (`production_VYYYYMMDD_N`) or milestone number
- User asks to "scan the milestone for Playwright gaps" / "automate release regression coverage"
- After a release ships and you want e2e backfill for every milestone card

**Do NOT use for:**

- A **single** issue test plan → `qa-test-plan`
- Fixing a **failing** CI spec → `playwright` + `fix-testdino-test-case` if TestDino-linked
- AKO staging regression triage → `qa-check-regression-failures`
- Issues **outside** a milestone scope the user named

## Prerequisites

- `gh` CLI authenticated to `deriv-com/derivatives-trader`
- Local clone with `playwright/.env.staging` (same `LOCAL_REPO_PATH` resolution as `qa-check-regression-failures`)
- Clean git working tree before creating the milestone branch (no uncommitted changes — stop and ask if dirty)
- Load **`playwright`** + **`flow-to-playwright-dtrader`** before writing any test code

```bash
gh auth status
LOCAL_REPO_PATH="${PLAYWRIGHT_LOCAL_REPO_PATH:-$(git rev-parse --show-toplevel)}"
test -f "$LOCAL_REPO_PATH/playwright/.env.staging"
```

## Constants

| Key            | Value                                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------------- |
| GitHub repo    | `deriv-com/derivatives-trader`                                                                                       |
| Flow index     | `playwright/flows/_index.md`                                                                                         |
| Temp report    | `/tmp/qa-milestone-to-playwright-<milestone-title>.md` (delete in Step 6)                                            |
| Branch pattern | `<prefix>/milestone-<N>-playwright` (e.g. `bala/milestone-11-playwright`)                                            |
| Modules        | `trade`, `positions`, `reports`, `notifications`, `auth`, `trade-automate`, `feed`, `market-selection`, `pageerrors` |

---

## Workflow overview

```
Step 0   Resolve milestone
Step 0b  Create/checkout milestone branch (from latest master)
Step 1   Fetch all milestone issues
Step 2   Triage each issue → classification bucket
Step 3   Publish triage report (chat; draft in /tmp, keep until Step 6)
         └─ optional: user review checkpoint before Step 4 (§3c)
Step 4   Automate feasible gaps (loop)
Step 5   Run Playwright for new/changed specs
Step 6   Final summary in chat; delete temp report
```

Run Steps 0–0b before any triage. Run Steps 0–3 for **every** milestone issue before starting Step 4.

---

## Step 0 — Resolve the milestone

Accept any of:

- Milestone URL → extract number from `/milestone/<N>`
- Milestone number alone (`11`)
- Release title (`production_V20260811_0`)

Fetch metadata:

```bash
# By number (preferred when URL given)
gh api repos/deriv-com/derivatives-trader/milestones/<N> \
  --jq '{number, title, description, open_issues, closed_issues, state, html_url}'

# By title (fallback)
gh api "repos/deriv-com/derivatives-trader/milestones?state=all&per_page=100" \
  --jq '.[] | select(.title=="production_V20260811_0")'
```

Record: **milestone number**, **title** (`production_V…`), **URL**, **open + closed issue counts**.

If lookup fails, stop and ask the user for a valid milestone number or title.

---

## Step 0b — Create a dedicated milestone branch

All triage, flow-doc, and spec work for this run happens on a **fresh branch** — never on `master` / `main`.

### Branch name

```text
<prefix>/milestone-<N>-playwright
```

Examples: `bala/milestone-11-playwright`, `jishi/milestone-27-playwright`

**`<prefix>`** — first path segment of the current branch when it contains `/` (e.g. `bala/milestoneToPW` → `bala`). When on `master`/`main`/detached HEAD, use `gh api user -q .login`.

**`<N>`** — milestone number from Step 0.

If the user supplies an explicit branch name, use that instead.

If the user says to **use the current branch** (e.g. an in-progress feature branch), skip branch creation — record `git branch --show-current` as **`BRANCH`** and proceed, provided the tree is clean.

### Checkout flow

```bash
cd "$LOCAL_REPO_PATH"

# Stop if the tree is dirty — do not stash or discard without asking
test -z "$(git status --porcelain)" || { echo "Working tree dirty — commit or stash first"; exit 1; }

MILESTONE_NUMBER=11   # from Step 0
PREFIX="$(git branch --show-current | cut -d/ -f1)"
if [ "$(git branch --show-current)" = "master" ] || [ "$(git branch --show-current)" = "main" ] || [ -z "$PREFIX" ]; then
  PREFIX="$(gh api user -q .login)"
fi
BRANCH="${PREFIX}/milestone-${MILESTONE_NUMBER}-playwright"

git fetch origin master
BASE="$(git merge-base HEAD origin/master 2>/dev/null || echo origin/master)"

if git show-ref --verify --quiet "refs/heads/${BRANCH}"; then
  git checkout "$BRANCH"
  git rebase origin/master   # prefer up-to-date base; stop and report if rebase conflicts
elif [ "$(git branch --show-current)" = "$BRANCH" ]; then
  : # already on the target branch
else
  git checkout -b "$BRANCH" origin/master
fi
```

Record **`BRANCH`** for the triage report and final summary.

**Rules:**

- **Never** write specs or flow docs on `master` / `main`.
- If **`${BRANCH}` already exists**, check it out and rebase onto `origin/master` — do not silently overwrite unrelated WIP; stop on conflicts.
- If the user is already on **`${BRANCH}`** with a clean tree, skip creation.
- **Do not** commit or push unless the user asks (same as all skills).

---

## Step 1 — Fetch all milestone issues

Pull **every** issue on the milestone — no label filter, both open and closed:

```bash
gh api "repos/deriv-com/derivatives-trader/issues?milestone=<N>&state=all&per_page=100" \
  --jq '.[] | {number, title, state, labels: [.labels[].name]}'
```

Paginate when `per_page=100` is not enough:

```bash
gh api "repos/deriv-com/derivatives-trader/issues?milestone=<N>&state=all&per_page=100&page=2"
```

Alternative (when title is easier than number):

```bash
gh issue list -R deriv-com/derivatives-trader \
  --milestone "production_V20260811_0" --state all --limit 200 \
  --json number,title,labels,state
```

Build an ordered work list (sort by issue number ascending). Skip pull requests if the API returns any (`pull_request` key present).

---

## Step 2 — Triage each issue

For **each** milestone issue, research before classifying. Reuse the `qa-test-plan` research steps (abbreviated here):

### 2a. Read the issue

```bash
gh issue view <N> -R deriv-com/derivatives-trader
gh issue view <N> -R deriv-com/derivatives-trader --comments
```

Capture: symptom, expected result, repro steps, platform (desktop/mobile/both), component hints, parent/residual links (`residual of #M`, etc.).

### 2b. Find the fix PR

```bash
gh issue view <N> -R deriv-com/derivatives-trader \
  --json closedByPullRequestsReferences,title,body
gh pr list -R deriv-com/derivatives-trader --search "<N>" --state all --limit 5
```

Read the merged fix when available:

```bash
gh pr view <PR> -R deriv-com/derivatives-trader
gh pr diff <PR> -R deriv-com/derivatives-trader
```

If **no fix PR** exists, classify as **`blocked-no-pr`** — document in the report; do not invent automation.

### 2c. Map to module + flows

1. Read `playwright/flows/_index.md`
2. Load matching `playwright/flows/<module>/coverage.md`, `flow.md`, `catalog.md`

**Module mapping** (same rules as `qa-test-plan`):

- PR diff path → module (e.g. `AppV2/Components/TradeParameters/Duration/` → `trade`)
- Feature keywords → module (barrier, stake, automate, feed, positions, reports, …)
- `trade-automate` when diff touches `AutomationPanel/`, automate routes, strategy sheets

Search existing specs **and POM buy flows** for overlap before proposing a new spec:

```bash
rg -l "<keyword-from-title>" playwright/tests/ --glob '*.spec.ts'
rg "<component-or-testid-from-diff>" playwright/tests/ packages/ --glob '*.{ts,tsx}' -l
rg "buy.*AndVerify|selectTicksDuration|verifyDesktop" playwright/pages/ playwright/tests/ --glob '*.{ts,tsx}'
```

**Fold-first rule:** If an existing numbered flow already runs the user journey (e.g. Digits Over/Under buy with `selectTicksDuration`, Multipliers DC with `buyUpAndVerifyWithDC`), classify as **`covered`** or **`gap-extend`** — add the regression assertion to that POM path + flow Expected Result. Do **not** open a narrow milestone-only spec that repeats the same navigation.

### 2d. Classify into exactly one bucket

| Bucket                     | Code               | Automate in Step 4? | Criteria                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------- | ------------------ | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Already covered            | `covered`          | No                  | An existing spec's assertions exercise the fixed behaviour on the issue's platform(s). Cite spec path + test title.                                                                                                                                                                                                                                                                          |
| Gap — extend existing flow | `gap-extend`       | **Yes**             | The fix only **tightens** an existing numbered flow's pass criteria — update that flow's **Expected Result** column and extend the **existing** spec and/or POM helper the flow already calls (e.g. add `verifyDesktopDealCancellationCancelOnOpenCard()` inside `buyUpAndVerifyWithDC`). **No new flow id**, no new spec file unless the regression is a distinct surface (see pageerrors). |
| Gap — new flow             | `gap-new-flow`     | **Yes**             | Regression or journey **not** exercised by any existing flow row or buy helper — add **`## Flow N`** in `flow.md`, then a dedicated spec. Run `src-to-flow-dtrader` first only when the module's flow docs are missing or stale.                                                                                                                                                             |
| Manual-only / N/A          | `manual-only`      | No                  | SmartCharts canvas, pure visual spacing/polish, third-party, copy-only, TrackJS-only, or `_index.md` marks surface `N/A`. State why.                                                                                                                                                                                                                                                         |
| Blocked                    | `blocked-no-pr`    | No                  | No merged/open fix PR; cannot assert a fix that is not in the tree.                                                                                                                                                                                                                                                                                                                          |
| Blocked                    | `blocked-no-repro` | No                  | Issue body too vague to derive assertions; list what is missing.                                                                                                                                                                                                                                                                                                                             |

**Prefer `covered`** when a spec already fails on the bug scenario or explicitly asserts the fixed UI state — cite the spec + flow id. Do not duplicate coverage.

**Prefer `gap-extend` over `gap-new-flow`** when the repro is a single assertion on a journey an existing buy/verify helper already runs (#899 card Cancel on open positions card → extend Flow 9.7 POM, not a new positions spec).

**Cross-module placement:** Put the assertion in the flow/POM that **already reproduces the journey**, even when triage mapped the issue to another module (e.g. positions-tagged #899 → trade Flow 9.7).

**Prefer `manual-only`** over weak automation when the pass criterion is subjective visual polish (whitespace, blur, GIF appearance) with no stable DOM assertion.

**Do not** classify as `gap-*` when the fix is backend-only with no testable UI delta.

### 2e. Triage row (record per issue)

Fill one row per issue for Step 3:

| Field           | Example                                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| Issue           | `#1011`                                                                                                          |
| Title           | Digits trade type — Ticks and Duration action sheet issues                                                       |
| State           | closed                                                                                                           |
| Fix PR          | `#1234` or `—`                                                                                                   |
| Module          | `trade`                                                                                                          |
| Bucket          | `gap-new-flow`                                                                                                   |
| Existing spec   | `—`                                                                                                              |
| Proposed action | Extend Flow 6.1 Expected Result + `buyOverAndVerify` POM — or new **Flow N** + spec only when no buy path exists |
| Platform        | mobile + desktop                                                                                                 |

---

## Step 3 — Publish triage report

### 3a. Draft report in a temp file

Write the full report to a **temp file outside the repo** — do not commit it:

```bash
REPORT="/tmp/qa-milestone-to-playwright-${MILESTONE_TITLE}.md"
# Example: /tmp/qa-milestone-to-playwright-production_V20260811_0.md
```

Use this skeleton in `$REPORT`:

```markdown
# Milestone Playwright triage — production_V20260811_0

**Milestone:** https://github.com/deriv-com/derivatives-trader/milestone/11
**Date:** YYYY-MM-DD
**Branch:** bala/milestone-11-playwright

## Summary

| Bucket           | Count |
| ---------------- | ----- |
| covered          | N     |
| gap-extend       | N     |
| gap-new-flow     | N     |
| manual-only      | N     |
| blocked-no-pr    | N     |
| blocked-no-repro | N     |

## Issues

| Issue | Bucket       | Module | Fix PR | Action |
| ----- | ------------ | ------ | ------ | ------ |
| #1011 | gap-new-flow | trade  | #1234  | …      |

## Automation plan

(Bulleted list of specs to create/update — only `gap-extend` and `gap-new-flow` rows)

## Skipped (manual / blocked)

(One line per issue with reason)
```

### 3b. Return summary in chat

Before Step 4, paste the report contents (or the Summary + Automation plan sections) into chat. Keep the temp file until Step 6 if you want to append automation results before the final paste.

Show the user:

- Milestone title + URL
- Counts per bucket
- List of issues **to automate** (issue numbers + one-line action)
- List of **skipped** issues with reasons

Then **proceed to Step 4 immediately** — this skill combines triage + automate by default.

### 3c. Optional review checkpoint (user-initiated)

Pause after Step 3 and **wait for the user** only when they ask for it up front, e.g.:

- "triage only" / "triage first"
- "review before automate"
- "show me the plan before writing specs"

When the checkpoint is active:

1. Post the triage report and **stop** — do not start Step 4.
2. Let the user prune or reclassify rows (e.g. fold #1011 to `covered`, fold #899 to `gap-extend`, split pageerrors out of trade smoke).
3. Resume Step 4 only after they confirm (e.g. "go ahead", "automate the plan", or per-issue approvals).

When **not** requested, do not wait for per-issue approval — proceed straight to Step 4.

If **zero** automatable gaps, stop after Step 3 with "nothing to implement".

---

## Step 4 — Automate feasible gaps

Process **`gap-extend`** issues first (cheapest — assertion-only), then **`gap-new-flow`**.

For each automatable issue:

### 4a. Flow documentation

**Two paths only — extend vs new flow:**

| Situation                                                  | Bucket         | Flow doc change                                                                                 |
| ---------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------- |
| Fix tightens an **existing** numbered flow's pass criteria | `gap-extend`   | Update that flow's **Expected Result** column (+ existing spec assertions). **No new flow id.** |
| Fix is a **regression or journey not in any flow row**     | `gap-new-flow` | Add a **new flow** in `flow.md` — see shapes below.                                             |

**`gap-new-flow` — always land as a numbered `Flow N` (not `G{n}` in coverage):**

| Phase                   | Where                                                           | Id       |
| ----------------------- | --------------------------------------------------------------- | -------- |
| Triage (Step 3)         | Proposed action may say "new Flow N"                            | —        |
| `flow.md`               | `## Flow N` with full step table (after the last numbered flow) | `Flow N` |
| `coverage.md` Section 1 | `Flow N` row — mark `✅` after spec lands                       | `Flow N` |
| Spec header             | `@id flow-N`                                                    | `flow-N` |

> **`G{n}` is triage-only** — like former G1 → Flow 17.1 and G2 → Flow 16. Do **not** leave automated journeys labelled `G{n}` in Section 1. Section 2 gaps are **unautomated** backlog only; remove rows once promoted.

**`gap-extend` steps:**

1. Open the matching numbered flow in `playwright/flows/<module>/flow.md`
2. Update **Expected Result** (and related steps if the repro path changed)
3. Extend the **existing** spec named in `catalog.md` for that flow
4. Cite the issue inline where the criterion changed (e.g. `issue #1011` in the Expected Result note)

**`gap-new-flow` steps:**

1. Open `playwright/flows/<module>/flow.md` (or run **`src-to-flow-dtrader`** when the module has no/stale docs)
2. Pick the next **`Flow N`** after the last row in `coverage.md` Section 1
3. Add **`## Flow N`** with a full step table; cite the issue: `> Covers regression for #1011.`
4. Update `playwright/flows/<module>/coverage.md`:
    - Section 1: new **`Flow N`** row — mark `✅` after spec lands
    - Section 2: only **unautomated** backlog (remove row once promoted)
    - Section 3: priority row until automated (then clear)
5. Update `catalog.md` with spec path + tags
6. Update `_index.md` when the flow moves to `automated`

Follow `playwright/flows/_conventions/coverage-template.md` and `flow-template.md`.

### 4b. Implement the spec

Load **`flow-to-playwright-dtrader`** + **`playwright`** and implement:

- File name: `verify-<short-description>.spec.ts` under `playwright/tests/<module>/`
- Header block must include `@name`, `@id`, `@flow`, `@coverage`
- Add `@id flow-N` (next free flow number in the module — never `gap-g{n}` for trade-style numbered modules)
- Tags: `@desktop` / `@mobile` per issue platform; add `@production` only when `catalog.md` / `coverage.md` explicitly assign it for that journey
- Link regression to the fix: assertion text should fail on pre-fix behaviour when possible

**Issue-specific guidance:**

- **ActionSheet / Save / validation** — assert `is_save_disabled`, dirty state, and sibling sheets (see `qa-test-plan` §5d triggers)
- **Duration / proposal** — cold load **and** trade-type switch; first proposal must succeed
- **Purchase / stake / balance** — follow purchase-button gotcha: Buy stays enabled; stake editor owns balance hint
- **`trade-automate`** — follow matrix rules in `flow-to-playwright-dtrader` annex (demo/real child IDs, `run*AndVerify`)
- **Uncaught JS / `pageerror` regressions** — **`gap-new-flow`** in the **`pageerrors`** module: spec at `playwright/tests/pageerrors/verify-<name>.spec.ts`, flow docs at `playwright/flows/pageerrors/` (next `Flow N`). Tags: **`@pageerrors`** + platform tags only (`@desktop` / `@mobile`) — do **not** add `@trade`, `@regression`, or `@staging` unless `catalog.md` already assigns them. Do **not** mix `page.on('pageerror')` into `@smoke @production` trade specs (e.g. trade Flow 1) — keep a dedicated pageerrors spec even when the repro URL is the trade page.

Extend an **existing** spec only for **`gap-extend`**. For **`gap-new-flow`**, create a dedicated spec unless the regression is a one-line assertion inside an existing POM buy helper (then **`gap-extend`**, no new file).

### 4c. Per-issue mini-checklist

Before moving to the next issue:

- [ ] **`gap-extend`:** existing flow Expected Result updated; existing spec extended
- [ ] **`gap-new-flow`:** new **`Flow N`** section in `flow.md` with step table (not `G{n}` in Section 1)
- [ ] `coverage.md` rows updated
- [ ] `catalog.md` updated
- [ ] Spec implements pass criteria from the fix PR diff; `@id` is `flow-N`
- [ ] No inline `page.getByTestId` in spec bodies (POM only)
- [ ] `_index.md` updated when a new flow is automated

---

## Step 5 — Run Playwright locally

From repo root, run **every** spec file you created **or** extended via POM fold-in (desktop first, then mobile if tagged):

```bash
cd "$LOCAL_REPO_PATH/playwright"
TEST_ENV=staging npx playwright test tests/<module>/verify-<name>.spec.ts --project=chromium
TEST_ENV=staging npx playwright test tests/<module>/verify-<name>.spec.ts --project=chromium-mobile
```

Use `--retries=0` while iterating. Fix failures before proceeding.

If staging is unavailable, report which specs were written but not verified.

**Do not** run the full `@production` suite as part of this skill unless the user asks.

---

## Step 6 — Final summary

Return in chat:

1. Updated results table: issue → bucket → spec file (or skip reason)
2. **Branch:** `<prefix>/milestone-<N>-playwright` used for this run
3. Local test results (pass/fail/not-run)
4. Suggested commit message:

```
test(playwright): backfill milestone production_V… e2e gaps

- Add/extend specs for #1011, #901, …
- Update flow/coverage docs for trade, …
- Skip manual-only: #1012 (visual spacing), …
```

Then delete the temp report:

```bash
rm -f "/tmp/qa-milestone-to-playwright-${MILESTONE_TITLE}.md"
```

Do not post GitHub issue comments as part of this skill. Do not leave report files under `playwright/` or commit them.

---

## Classification examples (milestone 11 — actual outcomes)

| Issue                                      | Bucket             | Outcome                                                                                                                                                    |
| ------------------------------------------ | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1012 Automate strategies sheet whitespace | `manual-only`      | Skipped — subjective visual spacing                                                                                                                        |
| #1010 (related polish)                     | `manual-only`      | Skipped — visual/polish                                                                                                                                    |
| #1011 Digits ticks/duration action sheet   | **`covered`**      | Flow 6.1/6.2 already runs `selectTicksDuration` + buy — note in Over/Under Expected Result; **no new spec**                                                |
| #901 `delay_amount` TypeError on load      | **`gap-new-flow`** | **pageerrors Flow 1** + `verify-no-delay-amount-error-on-load.spec.ts` — **not** folded into trade Flow 1 smoke                                            |
| #899 Cancel button missing on Multipliers  | **`gap-extend`**   | Assertion folded into trade Flow 9.7/9.8 via `verifyDesktopDealCancellationCancelOnOpenCard()` in `buy*AndVerifyWithDC` — **no** standalone positions spec |
| #895 Invalid URL popup content             | **`gap-new-flow`** | **trade Flow 18** + `verify-invalid-url-modal.spec.ts` — promoted to numbered Flow N, not `G{n}` in Section 1                                              |

These are illustrative — always read the fix PR diff and search buy helpers before classifying.

---

## Pitfalls

- **Do not filter by label** — the user asked for **all** milestone issues.
- **Do not skip triage** — Step 4 only runs after every issue has a bucket.
- **Do not duplicate specs** — search `playwright/tests/`, `catalog.md`, and POM `buy*AndVerify*` helpers before adding Flow N or a new file. Milestone 11 dropped redundant specs for #1011 (covered) and #899 (folded into 9.7).
- **Do not automate SmartCharts canvas** — chart pixel/theme checks are manual-only (`N/A`).
- **Do not post manual QA test plans** — that is `qa-test-plan`, not this skill.
- **Do not guess fix PRs** — use `blocked-no-pr` when unknown.
- **Do not weaken assertions** — if the issue is visual-only, classify `manual-only` instead of a flaky snapshot.
- **Do not post GitHub issue comments** — report only in chat.
- **Do not leave automated rows as `G{n}` in Section 1** — promote to **`Flow N`** in coverage (see Step 4a). Section 2 `G{n}` is unautomated backlog only.
- **Do not split pageerror checks into trade smoke** — `@production` load smoke and `page.on('pageerror')` belong in separate modules/specs.
- **Do not work on `master` / `main`** — Step 0b must create or checkout `<prefix>/milestone-<N>-playwright` before triage.
- **Do not commit or push** unless the user asks — branch creation only isolates the work.
- **`gh milestone view` may not exist** — use `gh api repos/…/milestones/<N>` and `gh issue list --milestone "<title>"`.

---

## Related

- `qa-test-plan` — manual QA checklist for a single issue
- `qa-check-regression-failures` — failure → milestone correlation (reverse direction)
- `src-to-flow-dtrader` — source → flow docs
- `flow-to-playwright-dtrader` — flow docs → specs
- `playwright/flows/_index.md` — module status tracker
- `playwright/flows/_github-issues.md` — filing issues from test failures (inverse workflow)
