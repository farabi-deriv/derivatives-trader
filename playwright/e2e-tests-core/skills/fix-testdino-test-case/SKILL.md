---
name: fix-testdino-test-case
description: Diagnose and fix a failing TestDino Playwright test case from its TestDino URL. Uses TestDino MCP to load case data, CI artifacts, and Playwright CLI verification.
version: 1.3.0
last_updated: 2026-09-23
---

# Fix TestDino Test Case

## When to Use This Skill

Use when:

- Fixing failing TestDino Playwright test case identified by its **TestDino test case URL**
- The failure may be an obsolete locator/text/route expectation vs current `src/`, or shared-helper timing (correct UI, settle/retry only)

Do **not** use for:

- Group/matrix healing orchestration, Known Issues routing, or writing healer artifacts (`pr-body.md`, `no-change.md`)
- Non-TestDino failures or general test authoring without a TestDino case

Callers that need healer outputs (leave unstaged, write `pr-body.md`, etc.) must supply those instructions separately.

## Always Load the `playwright` Skill

Before reading source or writing tests:

```
use_skill("fix-testdino-test-case")
use_skill("playwright")
```

## Goal

Decide whether a valid failing TestDino case has an **obsolete Playwright expectation** or a **Playwright helper-timing** failure. Job is not “make the test pass at any cost.”

1. Resolve the TestDino URL via MCP and prove the failure is valid (Phases 1–3), including mandatory visual artifact inspection. Persistence tools that 409 / cannot resolve identity do **not** abort — go to artifacts with caution (Phase 2).
2. Classify using current `src/` as hard product intent (Phase 4). For in-repo locator/text/route drift, need `src/` **and** a timeline-aligned product PR or release/RC — a screenshot alone is not enough. **HELPER TIMING** (shared helper, correct UI on screen, retry/settle only) is a separate shippable class and does **not** need a product PR. Flow docs stay soft except overlay dismiss (below). External (non-repo) locators use persistent artifacts.
3. Fix Playwright for obsolete locator/text/route expectations **or** HELPER TIMING that preserve coverage intent (Phases 5–6).
4. Verify with Playwright CLI (Phase 7). Iterate or abandon only when the failure is still the **original** signature; unrelated/downstream failures still count as a verified fix.

When any phase says **STOP — do not fix**, abandon the Playwright edit (revert bad edits) and end. Do not weaken coverage to force a pass. HELPER TIMING is not a STOP class.

### Standing rules

- **Hard intent:** current product behavior under `src/` (and persistent artifacts for **external** surfaces not owned by this repo).
- **In-repo locator drift:** if the failing locator/text/route is implemented in this repo (`src/`, app-owned testids, in-app copy), do **not** classify **EXPECTED PRODUCT CHANGE** from a screenshot (or error-context) alone. Require current `src/` showing the new locator/text/route **and** a timeline-aligned product PR or release/RC that landed that change. Soft flow docs cannot substitute for that pair. This pair is **not** required for **HELPER TIMING** (Phase 4).
- **External locators:** cashier iframes, third-party widgets, and other UI **not** implemented in this repo may use persistent artifacts without a product PR/RC in this repo.
- **Soft corroboration:** flow docs under `playwright/flows/` (`flow.md`, `catalog.md`, `coverage.md`). They never override `src/`. Never edit flow docs. Exception: an overlay/dialog that **covers** the target may be dismissed in the test only when a proven dismiss/seen storage key already exists in Playwright **or** the matching flow doc documents that dismiss as part of the journey.
- **Visuals:** Screenshots prove what happened, not that a change is intentional. Assertion messages are clues only — do not infer UI state from the assertion name alone. The Phase 3.2 finding must quote **on-screen copy**, not the assertion message.
- **Coverage:** Never remove, skip, weaken, optionalize, or invert assertions (no `if visible then assert`, fallback-only flows, `.or()` of a weaker state, or removed checks). Do not justify removing coverage by citing another spec unless the assertion is truly duplicate and unrelated to the current flow.
- **Missing UI is not dropped coverage:** Never assume a flag/entitlement/region/setup/test-account was off. If the control is missing even on a fully loaded page while `src/` still requires it, that is a likely **product bug** (NEEDS ATTENTION) — keep the assertion. Do **not** flip call-site flags (e.g. `hasCfdsNav=false`) to make a missing control pass.
- **Replace, don’t `.or()`:** when an assertion’s locator or expected text/state changes, **replace** the old assertion with the new one. Do not keep both via `.or()`, `or()`, or “visible or unavailable/error heading.”
- **All callers must support the change:** before changing, removing, or retargeting an assertion — including one inside a shared POM method, locator getter, or helper — grep every test/call site that uses it. Ship the change only if **every caller** still supports it (same country/region/catalog/account/viewport, or separate evidence for each distinct context). One failing spec’s screenshot or a11y snapshot does **not** prove other callers. If any caller would still need the old assertion, do **not** change the shared helper — **STOP**, or make a caller-specific override that leaves other callers unchanged. This applies to **external** locators too: `src/` not owning the UI does not skip the caller search.
- **Viewport:** Prove intent for the affected viewport only; never generalize desktop ↔ mobile. Before touching a viewport branch, confirm both desktop and mobile layouts exist. Only patch a shared helper or remove a viewport branch when evidence proves the new behavior for every viewport that change affects.
- **Timeline:** Any PR, release/RC, or commit used as strong corroboration must match the failure timeline from Phase 2. Stale flow docs that disagree with `src/` are a soft conflict — do not abandon solely for that, and do not rewrite the docs.

### Evidence timeline (mandatory for PR/release/commit corroboration)

Before treating a product PR, release, or commit as strong evidence, compare its date to the Phase 2 failure timeline:

1. From matching TestDino history, note when the signature **started failing** (last pass → first persistent fail, or earliest persistent fail if no prior pass).
2. A candidate PR/release/commit is timeline-aligned only if it landed near that start (merged/released/deployed shortly before or at the break) **and** matching runs did not keep passing afterward.
3. Reject lookalike evidence that is too old or too new relative to the break.
4. Timeline-mismatched PRs may stay investigative-only but cannot alone justify **EXPECTED PRODUCT CHANGE** or a Playwright patch.
5. The same rule applies to git commits cited as root cause.

---

## Input

**Required from the caller:** a TestDino **test case URL** (e.g. `https://app.testdino.com/testcase/<id>` or the project's equivalent TestDino case link).

Optional caller hints (never trusted over MCP): `projectId` if not already in the environment / known for this repo (`TESTDINO_PROJECT_ID` when set).

---

## PHASE 1 — Setup: resolve the TestDino URL

**1.1** Load `playwright` skill (see above).

**1.2** Parse the test case id from the URL (path segment after `/testcase/` or the last path id). Reject unsafe ids (empty, `..`, path separators) → **STOP — do not fix**.

**1.3** If the following is not yet supplied, call TestDino MCP `get_testcase_details` with `projectId` + `testcase_id` from the URL. From the response, record at least:

- title / full title
- error message, locator, source location / file
- browser / viewport / project when present
- run id, branch, environment, commit when present
- `workflowRunId` / CI linkage when present (else resolve later via `get_run_details`)

→ Tool unavailable/error or empty case → **STOP — do not fix**.

**1.4** Confirm run **environment** (and commit, when present) from MCP matches the checkout. Do **not** stop because the git branch differs — the healer job may run on a debug or workflow branch while failures were collected from `TESTDINO_BRANCH`.  
→ Environment mismatch → **STOP — do not fix**.

Do not read product source until Phase 2 produces GO or STOP.

---

## PHASE 2 — Confirm Failure Persistence

### 2.1 — Call `debug_testcase`

Call with `projectId` and `testcase_name` = the title from Phase 1. Pass `suite_file_path` when MCP/details provide a clear spec path (disambiguates duplicate titles).  
→ Tool unavailable, HTTP 409, `AMBIGUOUS_IDENTITY`, or other identity error: do **not** STOP. Record persistence as **AMBIGUOUS** and **GO to Phase 3 with caution** when Phase 1 already has title / error / locator. STOP only when Phase 1 is also empty so there is nothing to inspect.
→ A quoted `error-context.md` / screenshot that already shows new copy or a different locator is enough to continue; do not require TestDino history to confirm copy/locator drift.

### 2.2 — Cluster history by error signature

Title search may mix specs. Cluster by **locator + source location + key error line** from Phase 1. Keep entries matching this case’s signature; no extra MCP call needed.

### 2.3 — Future-pass flake check (mandatory, before persistence classify)

Using the ordered history from `debug_testcase`, look for **later runs after this failing case** (higher run counter / newer timestamp) for the **same spec** (same `suite_file_path` / spec path when known; otherwise same title + same viewport/project when path is missing).

→ Any such later run **passed** → treat as **FLAKY** immediately → **STOP — do not fix** (transient). Do not continue to Phase 3.

A later pass of the same spec is enough even if the error signature cluster is thin — the product expectation is no longer a stable/persistent fail.

### 2.4 — Classify the timeline

Only if 2.3 did not stop:

| Classification | Condition                                                                      | Action                                                                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FLAKY**      | Later matching runs passed again                                               | **STOP — do not fix** (transient)                                                                                                                                           |
| **PERSISTENT** | All later matching runs fail with the same signature, or clear pass→fail break | **GO to Phase 3 — full confidence**                                                                                                                                         |
| **AMBIGUOUS**  | No later runs, too few points, or mixed pattern                                | **GO to Phase 3 — with caution.** Phase 5 still needs a quoted visual finding. **EXPECTED PRODUCT CHANGE** (in-repo) also needs `src/` + PR/RC. **HELPER TIMING** does not. |

---

## PHASE 3 — Understand the Failure From Artifacts

### 3.1 — Download artifacts

TestDino MCP/public API no longer return downloadable files (`blobKey` only). Fetch from the **GitHub Actions** run linked on the case. List uploaded artifacts; do not hardcode names. Use current repo (`GITHUB_REPOSITORY`); do not invent `--repo` unless `gh` requires it.

1. From Phase 1 MCP data: `testcase_id`, title, run id, `workflowRunId`.
2. If `workflowRunId` missing, call `get_run_details` with TestDino `run.id`.
3. List artifacts (allowlisted `gh api` only — not MCP blobs, `WebFetch`, or `curl`):

```sh
gh api "repos/${GITHUB_REPOSITORY}/actions/runs/<workflowRunId>/artifacts" --jq '.artifacts[] | {name, id, expired, size_in_bytes}'
```

4. Select the best Playwright results/report match for the failing viewport; prefer unexpired. **No match, expired, or download fails (size / timeout):** do **not** STOP if `error-context.md` (or an a11y dump) is already on the case from Phase 1 MCP / the group candidate file — use that and continue to 3.2. STOP only when there is no screenshot **and** no error-context / error detail at all.
5. Sanitize the testcase id for a path segment: keep only `[A-Za-z0-9._-]`. When a downloadable artifact exists:

```sh
mkdir -p "playwright/agent/.healing/artifacts/<safe_testcase_id>"
gh run download <workflowRunId> \
  -n "<chosen-artifact-name>" \
  -D "playwright/agent/.healing/artifacts/<safe_testcase_id>"
```

6. Find result dirs for this title (and retries). Read `error-context.md`, then `test-failed*.png`. Video/trace only if needed.

### 3.2 — Visual verification (mandatory)

Inspect screenshots + `error-context.md` before diagnosing. Answer from the image(s):

1. Target really missing, or present under different label/layout/scroll/tab/locator?
2. Text/state really wrong, or assertion/locator stale?
3. Still loading? (spinner, skeleton, blank, partial paint)
4. Blocked? (modal, banner, nudge, overlay, Turnstile, toast)
5. Wrong page/state? (URL, demo/real tab, account context, error page)
6. Correct viewport for the failing project?

Write a one-sentence visual finding that **quotes on-screen copy** from the screenshot or accessibility snapshot (not the assertion message), then a short hypothesis from the MCP error details. Do not proceed to Phase 4/5 without that quoted finding.

Named visual STOP states (match the shot/a11y, then **STOP — do not fix** even if `src/` still has the locator):

| If the shot/a11y shows…                                                                               | Class                     | Action                                                                                                                                                                |
| ----------------------------------------------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| “Something went wrong”, Try again, skeleton/empty nav slots, page not ready                           | infra / env               | **STOP**                                                                                                                                                              |
| “Deposit paused”, rate unavailable, temporarily unavailable                                           | market-data / infra       | **STOP**                                                                                                                                                              |
| “Complete verification”, outstanding financial assessment / KYC / entitlement gate                    | test-data / account drift | **STOP** — keep the assertion                                                                                                                                         |
| Overlay/dialog covering the target so the expected step never appears (e.g. review sheet never opens) | blocked                   | **STOP**, unless a proven dismiss/seen storage key already exists in Playwright **or** the matching flow doc documents dismissing that overlay as part of the journey |
| Still on onboarding, guide, or login when the assert is for the next page                             | race                      | **STOP**                                                                                                                                                              |

Other routing:

- Element present as the real control, locator wrong → possible Playwright locator fix (still needs Phase 4; in-repo locators also need PR/RC unless **HELPER TIMING**).
- Element stably absent/changed on a **fully loaded** page while `src/` still renders/requires it → keep coverage; **STOP — do not fix** (likely product bug, not “drop the assert” / flip a call-site flag).
- Dialog visible with a dismiss control (e.g. “Got it”, “Close”) → use an **existing** dismiss helper if one exists; do not skip the original assertion and call it a silent fallback.
- No screenshots and insufficient error detail → **STOP — do not fix**.
- No screenshots but error detail exists: proceed cautiously; do not classify **EXPECTED PRODUCT CHANGE** on release/PR evidence alone. Copy/locator quoted in `error-context.md` is enough to continue Phase 4.

---

## PHASE 4 — Classify Expected Change vs Actual Bug

Requires a Phase 3.2 visual finding sentence.

Answer:

1. What differs between the test expectation and artifacts/`src/`?
2. Does current `src/` still require that coverage (or clearly implement a new locator/text/route for the same step)?
3. Is the Playwright expectation obsolete, or is this a bug / data drift / unresolved intent?

**Classes:**

- **EXPECTED PRODUCT CHANGE:** the journey step still exists; locator/text/route drifted. For **in-repo** locators this requires `src/` showing the new control **and** a timeline-aligned product PR or release/RC. For **external** (non-repo) locators, persistent artifacts plus preserved coverage intent are enough. Removing a step is rare and still needs `src/` no longer implementing it **and** timeline-aligned PR/release.
- **HELPER TIMING:** the shot/a11y shows the **correct UI** (quoted on-screen copy matches the assertion intent) but a **shared Playwright helper** failed to settle (cursor stuck `grabbing`, wheel value differs across retries, one-browser synthetic pointer). All of the following must hold:
    1. Failure site is a shared helper (`playwright/utils/**` or equivalent POM helper), not an app-owned testid/copy in `src/`.
    2. Received values / cursor / drag state differ across retries **or** one browser, with other projects passing around the same time.
    3. No timeline-aligned `src/` change in the failure window (this is not product drift).
    4. The patch is retry / re-dispatch / chunked pointer / wait-for-the-existing-assert — **the assertion stays** (same matcher, same expected value/state).
    5. Caller-grep still applies (standing shared-helper rule).
       Forbidden for this class: `waitForTimeout`, raising the assertion timeout, `.or()` of a broken state, dropping or weakening the assert. JSON error pages, WAF, overlays, perf budgets, and backend-owned expected values are **not** HELPER TIMING.
- **NEEDS ATTENTION:** valid persistent failure without a Playwright-only obsolete expectation — including missing UI that `src/` still requires (likely product bug) → **STOP — do not fix**.
- **NO ACTION:** flaky _product_ expectation (later pass of the same spec in Phase 2.3), duplicate (closed-unmerged with **same error + same on-screen DOM**), mismatch, or insufficiently evidenced → **STOP — do not fix**.

AMBIGUOUS from Phase 2: no **EXPECTED PRODUCT CHANGE** on investigative-only or timeline-mismatched PRs, or on flow docs alone (except overlay dismiss documented in flow docs, as above). AMBIGUOUS does **not** block HELPER TIMING or copy/locator drift that Phase 3 already quoted.

### Evidence sources

**Product source `src/` (hard intent)** — compare failing UI/locators to current `src/`. For in-repo locator drift this is necessary but **not sufficient** without a timeline-aligned product PR or release/RC.

**Flow docs (soft)** — read-only. Soft disagreement with `src/` is not alone a stop or a patch reason. Never edit flow docs. Overlay dismiss: standing overlay-dismiss rule.

**GitHub releases / product PRs (required corroboration for in-repo locator drift)**

```sh
gh release list --limit 10
gh release view <tag>
gh pr list --base main --state merged --search "merged:>YYYY-MM-DD" --json number,title,mergedAt --limit 50
gh pr view <number> --json number,title,state,merged,files,body
gh pr diff <number> --patch
```

Treat a **merged/released** product PR or RC that **changed the UI** (new locator/text/route already in `src/`) as corroboration for **EXPECTED PRODUCT CHANGE** — that is the evidence in-repo locator drift needs.

Treat an **open** product PR (or unreleased fix) that **restores** the old UI / fixes a product bug as NEEDS ATTENTION → **STOP — do not fix**. Do not patch Playwright to match a still-broken or not-yet-shipped product.

A PR is **Strong** corroboration only when: diff covers the failed assertion/locator/text/route/state/viewport; aligns with current `src/`; **and Evidence timeline matches**.

**Prior Playwright fix PRs** (run **before** any edit):

`path:` is a **code-search** qualifier — issue/PR search silently returns `[]` for it, so never use it here. Search the **basename** of the failing spec and page object as free text, across **all** states (a rejected duplicate is `closed`, so `--state merged` or `--state open` alone will miss it):

```sh
gh pr list --state all --search '<PageObject> in:body,title' --limit 30
gh pr list --state all --search '<failing-spec-basename> in:body,title' --limit 30
gh pr list --state all --search 'Playwright Auto Healer Fix: <error or title substring>' --limit 20
```

Titles carry the failing symbol/currency/account, so two attempts at the same drift often share **no** title text — the page-object and spec-basename searches are what link them. A search that returns zero rows for a file you know has been edited before is a **broken query, not an absence**: re-run it as free text before concluding there is no prior PR.

Open/merged covering this failure → **STOP — do not fix**. Closed unmerged: **STOP — do not fix** only when the closed PR has the **same error message** (or clearly equivalent signature) **and** the **same on-screen DOM** (quoted copy / locator in that PR’s body or artifacts matches this shot). Same spec/POM path alone is **not** enough — a different control in the current shot (e.g. `dialog "Market selection"` vs `.quill-action-sheet--root`) is a new drift; proceed and cite how the DOM differs. The same hunk or the same weaker alternative is a duplicate, not a new approach. Only a **materially different** approach **or** a materially different on-screen DOM may proceed (cite how it differs).

**Caller impact / viewport / popups** — same as standing rules. Shared POM/helper: grep every caller; change the helper only when **every caller** still supports the new assertion (evidence per distinct country/region/catalog/viewport — not one spec’s screenshot). Do **not** strip helper asserts or flip call-site flags. Overlay/dialog: standing overlay-dismiss rule. If the shot shows a dismiss control, use an **existing** dismiss helper; do not skip the original assertion.

**External surfaces** — may patch when persistent artifacts show external UI changed, coverage intent preserved (same assertion **kind** — e.g. keep `toBeVisible()` on a validation message; retarget the locator, do not switch to HTML5 `toBeValid`/`not.toBeValid`), and no security/compliance bypass. Instability/session/security challenge → **STOP — do not fix**.

### Convergence

- **EXPECTED PRODUCT CHANGE** with clear `src/` support **and** (for in-repo locators) timeline-aligned PR/RC → Phase 5.
- **HELPER TIMING** with all five conditions above → Phase 5 (no product PR/RC required).
- **External** locator with persistent artifacts and preserved coverage intent → Phase 5.
- Otherwise → **STOP — do not fix**.

---

## PHASE 5 — Fix Only Expected Product Changes and Helper Timing

### 5.1 — Fixability

Confirm Phase 4 is **EXPECTED PRODUCT CHANGE** or **HELPER TIMING**, Phase 3.2 done (quoted on-screen copy), closed-unmerged search done (same error **and** same on-screen DOM), and the fix is Playwright-only without editing flow docs or removing coverage.

→ **STOP — do not fix** if: product/API/env bug; test-data / entitlement / KYC drift; missing UI that `src/` still requires; Turnstile/CAPTCHA; would require `playwright/flows/**` edits; or fix belongs in `e2e-tests-core`.
→ **STOP — do not fix** if the class is **EXPECTED PRODUCT CHANGE**, the locator is in-repo, and there is no timeline-aligned product PR or release/RC alongside `src/`.
→ **HELPER TIMING** does **not** need a product PR/RC. Still **STOP** if any HELPER TIMING condition in Phase 4 is missing, or if the patch would use `waitForTimeout`, raise the assertion timeout, or weaken the assert.

### 5.2 — Safety check

Any failure → **STOP** (revert bad edit):

1. Playwright test code only (not `src/`, CI, `playwright/flows/**`, submodule)?
2. All assertion coverage preserved (same polarity and kind; old assert **replaced**, not `.or()`-ed)?
3. Minimal (no drive-by refactor)? Prefer tightening a Playwright option (e.g. `toBeInViewport({ ratio })`) over replacing the matcher with a custom poll.
4. Viewport evidence covers every affected viewport?
5. Default **45000ms** timeout respected?
6. Quoted visual finding supports the fix (not loading/skeleton/blocked/wrong page/error shell)? In-repo **EXPECTED PRODUCT CHANGE**: `src/` matches. External: artifacts match. **HELPER TIMING:** quoted copy matches the assertion; a settle mismatch (cursor `grabbing`, wheel value) is allowed.
7. Shared POM/helper: every caller grepped, listed, and **supports this change** (evidence covers each caller’s country/region/catalog/viewport)? No stripped helper asserts, no call-site flag flipped because the control was missing?
8. If a helper was used wrong (To vs From, resolve vs literal), the **call/contract** is fixed — not a hardcoded label from one screenshot?
9. In-repo locator (**EXPECTED PRODUCT CHANGE**): timeline-aligned PR/RC cited? External: artifacts only? **HELPER TIMING:** product PR/RC not required; cite the quoted on-screen copy + retry/browser spread instead.

Forbidden transforms (examples — do not ship these):

- Invert polarity: `toBeVisible()` → `not.toBeVisible()` / `toHaveCount(0)` / `toBeHidden()`.
- Change assertion kind to force a pass: visible validation copy → HTML5 `toBeValid()` / `not.toBeValid()`. Retarget the error locator (e.g. inline Min/Max notice) and **keep** `toBeVisible()`.
- Drop or rewrite a URL/symbol assert because a market-unsupported dialog appeared. If an existing dismiss helper exists (or flow docs document dismiss), dismiss then keep symbol coverage; otherwise **STOP**.
- `.or()` a paused/unavailable/error heading onto a visibility assert for the original control.
- Strip a shared `login()` (or similar) nav/account assert, or set `hasCfdsNav=false`, because the shot showed no CFDs link — including on a fully loaded page. Missing control while `src/` still requires it is a product/infra bug, not a call-site flag change.
- Drop or retarget a shared helper assertion because one caller’s screenshot omitted an option that other callers of that helper still assert (e.g. a country-specific vendor catalog).
- HELPER TIMING that uses `page.waitForTimeout`, raises the expect timeout, or `.or()`s a broken state onto the original assert.

---

## PHASE 6 — Self-Review

Before verification:

- No `playwright/flows/**` edits; no coverage removed for conditional assumptions; quoted visual finding consistent with the fix.
- Any **changed or removed** assertion in a shared helper: every caller grepped; evidence shows **each** caller still supports the new expectation (in-repo EXPECTED PRODUCT CHANGE: `src/` + timeline-aligned PR/RC for all of them; HELPER TIMING: assertion **unchanged**, only settle/retry mechanics; external: artifacts/context per caller, not one screenshot). Else revert. Do not `.or()` the old and new checks.
- Not recreating a closed unmerged fix (same error **and** same on-screen DOM).
- In-repo locator drift (**EXPECTED PRODUCT CHANGE**) cites `src/` **and** timeline-aligned PR/RC; **HELPER TIMING** cites quoted on-screen copy + helper path (no product PR); external locators cite artifacts; flow docs only as overlay-dismiss permission.

---

## PHASE 7 — Verify with Playwright CLI

After a Playwright edit that would otherwise be considered done:

1. Identify the affected spec and test title for this TestDino case (from Phase 1 MCP data). (if many are affected, you may select a subset to test)
2. Run Playwright CLI (prefer local binary if present):

```sh
npx playwright test --grep '<escaped test title>' <spec-path>
# or: node_modules/.bin/playwright test --grep '...' <spec-path>
```

Use `TEST_ENV=staging` and the decrypted Playwright env already provided by the environment (Playwright loads `playwright/.env.*` itself). **Never read, open, print, or paste `playwright/.env*` file contents.** Prefer the failing project/viewport when known (e.g. `--project=chromium` / mobile project name from config).

3. Classify the CLI result against the **original** Phase 1 failure (title / locator / source location / key error line) — not against every assertion in the run:

| Result                          | Meaning                                                                                                                                                                                           | Action                                                                                                                                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pass**                        | Sample exited 0                                                                                                                                                                                   | Fix verified; caller may proceed with packaging / PR body.                                                                                                                                                                      |
| **Related fail**                | Same (or clearly equivalent) original signature still fails — same title + same locator/source/error family                                                                                       | Iterate the fix and re-run, or **STOP — do not fix** (revert). Do **not** claim success.                                                                                                                                        |
| **Unrelated / downstream fail** | Original signature is gone or clearly fixed, but the run fails later or on a different assertion/step/error (e.g. later line in the same file, different locator, setup/env after the fixed step) | Treat the **Playwright fix as verified**. Do **not** iterate to chase the unrelated failure and do **not** **STOP — do not fix** solely for that. Caller may write `pr-body.md`; note the unrelated failure briefly for humans. |
| **Ambiguous fail**              | Cannot tell if the failure is the original signature vs something else                                                                                                                            | Prefer one more careful read of the error; if still unclear, treat as **related** (iterate or **STOP — do not fix**). Do not claim success on ambiguity.                                                                        |
| **Cannot run CLI**              | Binary/env/command failure                                                                                                                                                                        | **STOP — do not fix** (do not claim a verified fix).                                                                                                                                                                            |

Never write healer output artifacts from this skill; never leave staging credentials in commits.

---

## TestDino MCP Tools — Reference

1. **`get_testcase_details`** — primary loader for a URL-derived `testcase_id` (`projectId` + `testcase_id`). Use this first to obtain title, error, locator, file location, and run linkage.
2. **`debug_testcase`** — persistence/history (`projectId` + `testcase_name` from step 1; optional `suite_file_path`).
3. **`get_run_details`** — when `workflowRunId` is missing from case details.
4. **`list_testcase`** — only if id/title resolution needs disambiguation.

**Do not download artifacts via TestDino** — use `gh api` / `gh run download` (Phase 3.1). MCP attachments are not a file download source.

---

## Guardrails

### Scope

- Edit only Playwright test code: tests, page objects, fixtures, helpers, Playwright config, app-local Playwright utilities.
- Never edit `playwright/flows/**`, product/`src/` code, CI/workflow files, secrets, or `playwright/e2e-tests-core`. Submodule-needed fix → **STOP — do not fix**.

### Coverage & data

- Never remove/skip/weaken/optionalize/invert assertions or helper contract steps to make a test pass.
- When replacing an obsolete locator/text, **update the existing assertion** — do not `.or()` the old and new.
- When changing a shared helper assertion, grep all callers and keep the helper unchanged unless every caller supports the new expectation.
- Test-data / flag / entitlement / KYC / region / wallet drift → **STOP — do not fix** (keep the assertion).
- Missing control on a loaded page while `src/` still requires it → **STOP — do not fix** (likely product bug, not “this account no longer needs that assert”).
- Product regression, API/env issues, Turnstile/CAPTCHA → **STOP — do not fix**.

### Evidence integrity

- Hard intent = `src/` (plus artifacts for external surfaces). In-repo locator drift (**EXPECTED PRODUCT CHANGE**) also needs a timeline-aligned product PR or release/RC. **HELPER TIMING** does not.
- Apply **Evidence timeline** to every PR/release/RC/commit used as strong corroboration.
- Never fabricate TestDino/PR/release/artifact links or results.
- “Not found / not visible” ≠ feature disabled or removed.
