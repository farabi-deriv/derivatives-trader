---
name: qa-test-plan
description: Given a GitHub issue in deriv-com/derivatives-trader, research the issue + its fix PR and post a reusable, GitHub-native manual QA test-plan checklist as a comment. Use when the user asks for a "test plan", "test checklist", or "checklist for testing" for a QA-tracked issue. Do NOT use for Playwright/e2e test authoring — use flow-to-playwright-dtrader / gap-to-playwright / src-to-flow instead.
version: 1.1.0
last_updated: 2026-08-21
---

# QA Test Plan Generator

Produce a manual QA test plan as a GitHub comment for a tracked issue in `deriv-com/derivatives-trader`.

## When to use

The user gives a GitHub issue URL (or number) and asks for a **test plan** / **test checklist** / "checklist so we can mark it off while testing". These issues are typically labelled `bughunt`, type `Bug`, and sitting in the **"Options Trading Web App (In QA)"** project column.

## Prerequisites

- `gh` CLI authenticated to deriv-com/derivatives-trader (the GitHub MCP tools may return "Bad credentials"; `gh` is the reliable path).
- Read access to the repo to view issues, PRs, diffs, and comments.

## Workflow

Follow in order. Research before writing anything.

### 1. Read the issue

```bash
gh issue view <number> --repo deriv-com/derivatives-trader                 # title, body, labels, assignees, project
gh issue view <number> --repo deriv-com/derivatives-trader --comments      # screenshot + Slack context often live here
```

Capture: **what's broken**, the **expected result**, the reporter's **reproduction steps**, and the **scope** (mobile vs desktop, AppV1 vs AppV2, which component).

### 2. Find and read the fix PR

```bash
gh pr list --repo deriv-com/derivatives-trader --search "<number>" --state all
```

Also try keywords from the issue title. A PR whose branch/body matches the issue's symptom is the fix PR — confirm `Closes #<n>` in its body.

Read it fully — the diff is ground truth, the description is secondary:

```bash
gh pr view <number> --repo deriv-com/derivatives-trader           # description, root cause, scope notes
gh pr diff <number> --repo deriv-com/derivatives-trader            # the ACTUAL code change — read this carefully
gh pr view <number> --repo deriv-com/derivatives-trader --comments # bot review (severity table) + Cloudflare deploy
```

- Extract the **QA test link** from the `cloudflare-workers-and-pages` bot deploy comment: the **Branch Preview URL** (`https://<branch>.derivatives-trader.pages.dev`) and the **Preview URL**. Prefer the branch preview URL — **no build step needed**.
- If no PR is linked/found, ask the user which PR is the fix (or whether to write the plan from the issue alone, with no QA link section). Don't guess.

### 3. Map the issue to the documented flows (for solid, authoritative coverage)

This repo keeps a journey-spec system in `playwright/flows/`. It is the single best source for _solid_ regression coverage — these are plain-English, step-by-step flows with expected results and Desktop/Mobile platform breakdowns, kept in sync by the `_orchestrator.md` process. A plan built only from the issue+diff can miss real user journeys; the flows supply the authoritative ones.

Index first:

```bash
cat playwright/flows/_index.md          # module → flow table: id, priority, status, user state
```

Then load the matching module's flow + coverage + catalog:

```bash
cat playwright/flows/<module>/flow.md      # step tables: # | Step | Action | Expected Result | Platform
cat playwright/flows/<module>/coverage.md  # Section 1 (Desktop/Mobile ✅/❌), Section 2 (gaps), Section 3 (priority)
cat playwright/flows/<module>/catalog.md   # journey id → spec file + tags (@production/@smoke/@desktop/@mobile) for the e2e command
```

**Mapping the issue to a module/flow:**

- Match on the **component path** from the PR diff (e.g. `AppV2/Components/TradeParameters/Duration/` → `trade` module; `ChartMaximizeButton` + a Turbos barrier issue → `trade` module, Turbos flows 10.1–10.4).
- Match on **trade type / feature keyword** (barrier → Higher/Lower, Touch/No Touch, Turbos; duration → trade Duration; market picker → `market-selection`).
- Match on **user state** from the issue (authenticated/funded, mobile/desktop, market closed, EU account) against the flow's "User State" column in `_index.md`.
- Modules in this repo: `trade`, `positions`, `reports`, `notifications`, `auth`, `trade-automate`, `feed`, `market-selection`.

**What to fold into the plan from the flows:**

- The relevant flow's **step table** → a "Related user journey (from `playwright/flows/...`)" section that turns the documented steps into manual checkboxes. Example for the Turbos barrier issue: Flow 10.1 "buy Up → verify in positions" steps where Barrier visibility is part of the expected result.
- The flow's **Expected Result** column → concrete pass criteria for each step (e.g. "Barrier visible" appears as an expected result on the contract-details verification step — use it as a checkbox).
- **Coverage gaps** from `coverage.md` Section 1 (the ✅/❌ matrix) and Section 2/3 → for each mapped flow, state whether it's `automated` (e2e exists) or a `documented` gap (manual-only). If the issue's platform column is ❌, say so explicitly — **e2e coverage is lacking on that platform, so manual QA is the only backstop**.
- **Platform split** (Both/Desktop/Mobile) → the issue says "mobile web view", so pull the Mobile-column expected results specifically; still spot-check Desktop for out-of-scope regressions.
- **Spec file + tags from `catalog.md`** → for the automated-test section, give the runnable command, not just the flow number. Example: `npx playwright test playwright/tests/trade/turbos/verify-turbos.spec.ts --grep "@mobile"` for a Turbos mobile issue. Tags (`@production`, `@smoke`, `@desktop`, `@mobile`) let QA scope the run to the issue's platform without re-running the whole suite.

**When the flows don't map:** some bugs are pure component polish (e.g. calendar whitespace #1076, chevron removal #1068) with no dedicated flow. In that case skip the flow section and say so — "No documented flow covers this — component-level visual fix; plan derived from the diff only". Don't force a flow mapping where none fits.

### 4. Build the plan from the diff + flows

Write the plan around **what the diff actually changes**, enriched by the mapped flow when one fits. **Keep plans short** — QA should finish in one focused pass, not a full regression suite.

**Size targets (hard limits for the posted comment):**

| Change type                                         | Max checkboxes | Examples                                         |
| --------------------------------------------------- | -------------- | ------------------------------------------------ |
| **Small** (visual/polish, single component)         | **12–18**      | chevron removal, calendar whitespace, blur tweak |
| **Medium** (one control/journey, mobile or desktop) | **18–28**      | duration picker, barrier sheet, market picker    |
| **Large** (trade path, multi-platform, money/state) | **28–35**      | purchase flow, balance, contract lifecycle       |

If you exceed the limit, **cut 🟡/🟢 items first**, then merge sections — never drop 🔴/🟠.

**What to derive (priority order):**

1. Issue repro steps → **Confirm fix** (🔴) — 3–5 checkboxes max.
2. PR diff → **Primary verification** (🔴) — the one thing that must look/behave differently.
3. Diff **preserves** → **Regression** (🟠) — 2–4 checkboxes for tap-to-open, save/commit, sibling viewport — only what the diff could have broken.
4. Mapped flow (if any) → **Journey spot-check** (🟠) — **3–5 steps max** from the flow table, not the whole journey. Link flow id; don't copy every step.
5. PR **out-of-scope** → one short subsection (2 checkboxes) **only when the PR names an untouched sibling**.
6. Bot review nits → one optional `- [ ]` under **Follow-ups (non-blocking)**.

**Do NOT auto-include** cross-browser matrices, edge-case laundry lists, or negative/defensive sections unless the diff or issue explicitly warrants them (see optional modules below).

### 5. Structure — focused skeleton

**Always include (core plan):**

1. **Title** — issue #, fix PR #, In QA, change type + size tier (Small/Medium/Large).
2. **Summary** — broken → root cause → fix → **Scope** (platform, files, out of scope). ≤ 6 lines.
3. **QA preview link** — Cloudflare Branch Preview URL from PR deploy comment only.
4. **Must pass to sign off** — 3–5 bullets (not a long Entry/Exit matrix). Example:
    - [ ] Original repro no longer occurs on **{issue platform}**
    - [ ] Primary fix verified (section below)
    - [ ] No 🔴 regression on the affected control/journey
    - [ ] Screenshot attached if visual
5. **Setup** — preview URL, platform/viewport from issue, demo or real account if relevant. **Merge** old "Environment" + "Steps to reach" into ≤ 4 checkboxes.
6. **Confirm fix (🔴)** — from issue repro; pass/fail criteria tied to Expected Result.
7. **Primary verification (🔴)** — diff-specific; 2–5 checkboxes with real selectors/CSS/labels from the diff.
8. **Regression (🟠)** — preserved behaviour only; 2–4 checkboxes.
9. **Automated test (e2e)** — one block: runnable `npx playwright test …` if coverage exists; otherwise "manual-only — no e2e on {platform}". No unit tests.
10. **Notes for tester** — mandatory `>` blockquote: top 2 risks + what to skip if short on time.

**Include only when triggered (optional modules — pick 0–2, never all):**

| Module                       | When to include                                                                 | Max checkboxes                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Journey spot-check (🟠)**  | Flow maps in `playwright/flows/`                                                | 3–5                                                                                                                                     |
| **Out-of-scope (🟡)**        | PR lists untouched desktop/mobile sibling                                       | 2                                                                                                                                       |
| **Accessibility (🟠/🔴)**    | Diff touches opacity/blur, tap target, icon removal, calendar grid, focus, ARIA | 3–5 targeted checks — **not** a generic WCAG laundry list                                                                               |
| **Platform spot-check (🟡)** | Issue says "both" or fix is shared component                                    | 2–3: issue platform + **one** other (e.g. desktop if issue is mobile) — **not** Chrome Android + Safari iOS + Samsung + narrow + rotate |
| **Edge / defensive (🟢)**    | Only if issue mentions flaky state (rapid tap, background, RTL, theme)          | 2–3 relevant items                                                                                                                      |

**Removed from default skeleton** (fold into optional modules or Notes for tester):

- Separate **Entry criteria** / **Exit criteria** sections → collapsed into **Must pass to sign off**
- Standalone **Cross-device / cross-browser** section
- Standalone **Edge cases** + **Negative / defensive** sections
- Full flow step table pasted as checkboxes

### 5a. Risk tagging

Tag section headers with **one** badge. Only 🔴 and 🟠 sections get multi-item checklists; 🟡/🟢 sections are ≤ 2 items or a single prose line ("Optional: …").

| Tag         | Meaning                       | Checklist budget    |
| ----------- | ----------------------------- | ------------------- |
| 🔴 Critical | Fix + original repro          | 3–8 items           |
| 🟠 High     | Regression / journey          | 2–5 items           |
| 🟡 Medium   | Out-of-scope, second platform | 0–2 items           |
| 🟢 Low      | Optional polish               | prose only, or omit |

**Primary fix verification** is always 🔴. **Accessibility** is 🔴 only when contrast/tap-target/focus changed; otherwise omit the module.

### 5b. Entry / Exit criteria (collapsed)

Do **not** post separate Entry/Exit sections with 4+ checkboxes each. Fold into **Must pass to sign off** (structure item 4):

- Entry implied: preview loads, tester on correct platform.
- Exit: all 🔴/🟠 pass, acceptance criterion met, move out of In QA.

If CI/e2e gate matters for this fix, add **one** checkbox: "PR CI green on affected platform".

### 5c. Accessibility (a11y) — conditional module

**Not always present.** Include the a11y module only when the diff touches one of:

- Opacity / blur / transparency → contrast on light + dark background (1–2 checkboxes)
- Icon removed / tap target changed → 44×44px + keyboard focus (1–2 checkboxes)
- Calendar / grid → keyboard nav (1 checkbox)
- New/changed interactive control → label/focus (1 checkbox)

Skip a11y entirely for backend-only or copy-only PRs with no UI interaction change.

### 6. Format rules

- Every actionable item is a **GitHub checkbox**: `- [ ]`.
- Use **bold** for field/control names the tester will look for.
- Reference real values from the diff (test IDs, CSS deltas, component paths) — but **prefer fewer, sharper checks** over exhaustive lists.
- Tag 🔴/🟠 section headers with risk badges; optional modules may use 🟡/🟢 or no badge.
- Keep it skimmable: **≤ 10 `###` sections** in the posted comment for Small/Medium plans.
- **Notes for tester** is mandatory (`>` blockquote) and must say **what to deprioritize** if time-boxed.

### 7. Post the comment

```bash
gh issue comment <number> --repo deriv-com/derivatives-trader --body-file /tmp/issue_<number>_comment.md
```

Return the comment URL to the user. If revising a comment you already posted, **edit in place** via the API rather than posting a duplicate:

```bash
gh api -X PATCH /repos/deriv-com/derivatives-trader/issues/comments/<comment_id> -F body=@/tmp/issue_<number>_comment.md --jq '.html_url'
```

## Pitfalls to avoid

- **Don't write "Build the QA branch"** — the PR is deployed to Cloudflare Pages. Pull the preview URL from the PR's deploy comment and use it.
- **Don't write the plan from the issue body alone** — read the PR diff. The issue describes the symptom; the PR diff is the ground truth for what to test. The issue's "expected result" is sometimes vaguer than what the fix actually delivers.
- **Don't invent the QA link** — it must come from the `cloudflare-workers-and-pages` bot comment on the PR.
- **Don't omit the out-of-scope section** — regressions most often come from an untouched sibling component (e.g. the desktop version of the same control). Confirm it's unchanged.
- **Don't paste a generic template** — adapt every section to the actual diff, but **stay within the size tier** (§4). A calendar fix does not need cross-browser + edge cases + full Turbos journey.
- **Don't force a flow mapping where none fits** — pure component-polish bugs have no dedicated flow; say so and keep the plan Small tier.
- **Don't copy the whole flow step table** — link the flow id and spot-check 3–5 steps that exercise the changed control.
- **Don't always include a11y, cross-browser, edge cases, and negative testing** — use optional modules (§5) only when the diff/issue triggers them.
- **Don't duplicate sign-off** — one **Must pass to sign off** block replaces separate Entry, Exit, and Sign-off sections.
- **The automated-test section is Playwright e2e only — not unit tests.** Give the runnable command (spec file + `--grep` tag) and the coverage status; don't list the PR's Jest/Vitest cases. A QA reviewer reading the issue needs to know which e2e to kick off, not which unit assertions the dev added.
- **Always state coverage status explicitly, even when it's good news.** If the affected flow's platform column is ✅, say "e2e covers the happy path — manual QA focuses on the visual fix + edge cases". If it's ❌, say "no e2e on this platform — manual QA is the only backstop, treat the regression section as mandatory". Silent omission reads as "covered" when it isn't.
- **When e2e coverage is lacking for the fix, suggest a follow-up.** If the issue's symptom (e.g. negative barrier overlap) isn't asserted in any flow, propose adding it — point at the `gap-to-playwright` skill (for a manual-gap-found flow) or `src-to-flow-dtrader` (if it's a new user journey), and mark it as an out-of-this-PR follow-up so it doesn't block sign-off. **But never propose a follow-up for an `N/A` surface** (e.g. SmartCharts canvas) — it's not automatable by design; say "no e2e applies — manual-only" and point only at the indirect flows that touch it. Don't fabricate a runnable e2e command for a surface that has none.

## Examples of good "Notes for tester" lines

- _"The two things most likely to break are (1) an empty icon slot/gap where the chevron was, and (2) tap-to-open regressing if the `onClick` handler was disturbed."_
- _"If the barrier is still fully hidden, the blur change wasn't enough and the fix may need a layout/z-index follow-up (out of scope of this PR)."_
- _"Prioritize the month-navigation height-stability and day-tile-shape sections — if the selection pill turns into an oval on short months, that's the `align-content: flex-start` override being lost."_
