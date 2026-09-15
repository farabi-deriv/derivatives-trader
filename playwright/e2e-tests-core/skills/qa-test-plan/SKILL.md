---
name: qa-test-plan
description: Given a GitHub issue in deriv-com/derivatives-trader, research the issue + its fix PR and post a reusable, GitHub-native manual QA test-plan checklist as a comment. Use when the user asks for a "test plan", "test checklist", or "checklist for testing" for a QA-tracked issue. Do NOT use for Playwright/e2e test authoring — use qa-milestone-to-playwright / flow-to-playwright-dtrader / src-to-flow-dtrader instead.
version: 1.2.0
last_updated: 2026-09-11
---

# QA Test Plan Generator

Produce a manual QA test plan as a GitHub comment for a tracked issue in `deriv-com/derivatives-trader`.

## When to use

The user gives a GitHub issue URL (or number) and asks for a **test plan** / **test checklist** / "checklist for testing". These issues are typically labelled `bughunt`, type `Bug`, and sitting in the **"Options Trading Web App (In QA)"** project column.

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

Also capture **parent / residual links**: phrases like `residual of #N`, `sub-issue of #N`, `regression from #N`, `related: #N`, `parent: #N`. If present, the plan **must** include the parent's pass criteria **plus** the new edge — never the parent repro alone.

### 2. Find and read the fix PR

```bash
gh pr list --repo deriv-com/derivatives-trader --search "<number>" --state all
```

Also try keywords from the issue title. Check **issue comments** for `PR: #N` (stacked cleanup PRs often link here because `Closes` may not register until the PR targets `master`). A PR whose branch/body matches the issue's symptom is the fix PR — confirm `Closes #<n>` in its body when present.

Read it fully — the diff is ground truth, the description is secondary:

```bash
gh pr view <number> --repo deriv-com/derivatives-trader           # description, root cause, scope notes
gh pr diff <number> --repo deriv-com/derivatives-trader            # the ACTUAL code change — read this carefully
gh pr view <number> --repo deriv-com/derivatives-trader --comments # bot review (severity table) + Cloudflare deploy
```

- Extract the **QA test link** from the `cloudflare-workers-and-pages` bot deploy comment (login may be `cloudflare-workers-and-pages` or `cloudflare-workers-and-pages[bot]`): the **Branch Preview URL** (`https://<branch>.derivatives-trader.pages.dev`) and the **Preview URL**. Prefer the branch preview URL — **no build step needed**.
- If no PR is linked/found, ask the user which PR is the fix (or whether to write the plan from the issue alone, with no QA link section). Don't guess.

### 2b. Related-bug search (anti-leakage — mandatory)

Before mapping flows or drafting checkboxes, search for **sibling / residual** bugs in the same area (past ~6–8 weeks is enough):

```bash
# Use 2–4 concrete keywords from the issue title + changed component (not the issue number alone)
gh issue list --repo deriv-com/derivatives-trader --state all --limit 30 \
  --search "is:issue created:>=YYYY-MM-DD <keyword1> <keyword2>"
```

Examples of good keywords: `ActionSheet Save`, `daily-only`, `date_expiry`, `Allow equals`, `help centre`, `dark GIF`, `tab switch stake`, `barrier switch`.

**Fold results into the plan:**

- Open or recently closed bugs on the **same control / shared pattern** → add to **Anti-leakage (🟠)** or **Regression (🟠)** (max budget below) — do not ignore them because they are "out of scope of this PR".
- Explicit residuals of this issue's parent → elevate into **Confirm fix (🔴)** (parent criteria + new edge).
- Unrelated noise → omit.

If the search returns nothing useful, say so in one Notes line ("No open siblings found for …") — do not invent siblings.

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
- Modules in this repo: `trade`, `positions`, `reports`, `notifications`, `auth`, `automation`, `feed`, `market-selection`.

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

If you exceed the limit, **cut in this order:** 🟢 → generic Journey spot-check → 🟡 → **never** cut 🔴, **never** cut a triggered **Anti-leakage (🟠)** module.

**What to derive (priority order):**

1. Issue repro steps → **Confirm fix** (🔴) — 3–5 checkboxes max. If residual/regression of `#N`, include parent pass criteria + new edge.
2. PR diff → **Primary verification** (🔴) — the one thing that must look/behave differently.
3. **Anti-leakage (🟠)** — **0–1 module** from §5d when a trigger matches (3–5 checkboxes). Prefer this over a generic journey spot-check when budget is tight.
4. Diff **preserves** → **Regression** (🟠) — 2–4 checkboxes for tap-to-open, save/commit, sibling viewport — only what the diff could have broken.
5. Mapped flow (if any) → **Journey spot-check** (🟠) — **3–5 steps max** from the flow table, not the whole journey. Link flow id; don't copy every step. **Skip or shrink** if §5d already covers the risky transitions.
6. PR **out-of-scope** → one short subsection (2 checkboxes) **only when the PR names an untouched sibling**.
7. Bot review nits → one optional `- [ ]` under **Follow-ups (non-blocking)**.

**Do NOT auto-include** cross-browser matrices, edge-case laundry lists, or negative/defensive sections unless the diff or issue explicitly warrants them (see optional modules below). Anti-leakage modules are **trigger-gated**, not a full matrix every time.

### 5. Structure — focused skeleton

**Always include (core plan):**

1. **Title** — issue #, fix PR #, In QA, change type + size tier (Small/Medium/Large).
2. **Summary** — broken → root cause → fix → **Scope** (platform, files, out of scope). ≤ 6 lines. Mention parent residual (`of #N`) when applicable.
3. **QA preview link** — Cloudflare Branch Preview URL from PR deploy comment only.
4. **Must pass to sign off** — 3–5 bullets (not a long Entry/Exit matrix). Example:
    - [ ] Original repro no longer occurs on **{issue platform}**
    - [ ] Primary fix verified (section below)
    - [ ] Triggered anti-leakage checks pass (if §5d applied)
    - [ ] No 🔴 regression on the affected control/journey
    - [ ] Screenshot attached if visual
5. **Setup** — preview URL, platform/viewport from issue, demo or real account if relevant. **Merge** old "Environment" + "Steps to reach" into ≤ 4 checkboxes.
6. **Confirm fix (🔴)** — from issue repro; pass/fail criteria tied to Expected Result.
7. **Primary verification (🔴)** — diff-specific; 2–5 checkboxes with real selectors/CSS/labels from the diff.
8. **Anti-leakage (🟠)** — only when §5d triggers; otherwise omit the section entirely.
9. **Regression (🟠)** — preserved behaviour only; 2–4 checkboxes.
10. **Automated test (e2e)** — one block: runnable `npx playwright test …` if coverage exists; otherwise "manual-only — no e2e on {platform}". No unit tests.
11. **Notes for tester** — mandatory `>` blockquote: top 2 risks + what to skip if short on time + any sibling-bug watchlist from §2b.

**Include only when triggered (optional modules — pick 0–2 from this table, never all; §5d is separate and may add one more 🟠 block):**

| Module                       | When to include                                                                 | Max checkboxes                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Journey spot-check (🟠)**  | Flow maps in `playwright/flows/` **and** §5d did not already cover the risk     | 3–5                                                                                                                                     |
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

| Tag         | Meaning                                 | Checklist budget    |
| ----------- | --------------------------------------- | ------------------- |
| 🔴 Critical | Fix + original repro                    | 3–8 items           |
| 🟠 High     | Regression / journey / **anti-leakage** | 2–5 items           |
| 🟡 Medium   | Out-of-scope, second platform           | 0–2 items           |
| 🟢 Low      | Optional polish                         | prose only, or omit |

**Primary fix verification** is always 🔴. **Accessibility** is 🔴 only when contrast/tap-target/focus changed; otherwise omit the module.

### 5b. Entry / Exit criteria (collapsed)

Do **not** post separate Entry/Exit sections with 4+ checkboxes each. Fold into **Must pass to sign off** (structure item 4):

- Entry implied: preview loads, tester on correct platform.
- Exit: all 🔴/🟠 pass (including triggered anti-leakage), acceptance criterion met, move out of In QA.

If CI/e2e gate matters for this fix, add **one** checkbox: "PR CI green on affected platform".

### 5c. Accessibility (a11y) — conditional module

**Not always present.** Include the a11y module only when the diff touches one of:

- Opacity / blur / transparency → contrast on light + dark background (1–2 checkboxes)
- Icon removed / tap target changed → 44×44px + keyboard focus (1–2 checkboxes)
- Calendar / grid → keyboard nav (1 checkbox)
- New/changed interactive control → label/focus (1 checkbox)

Skip a11y entirely for backend-only or copy-only PRs with no UI interaction change.

### 5d. Anti-leakage modules (P0 — trigger-gated)

Past-month bug clusters show most "leakage" is signing off the **named repro** while missing **siblings, switches, first WS request, geo/theme, or async gates**. Apply **at most one** module below (or two only if both triggers are strong and budget allows — prefer merging into one § Anti-leakage block). **3–5 checkboxes max** for the whole block.

| Trigger (issue and/or PR diff)                                                           | Module name                 | Required checks (pick the fitting ones; max 5 total)                                                                                                                                                 |
| ---------------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared ActionSheet / header Save / dirty-state / `is_save_disabled` / wheel sheets       | **Sibling surfaces**        | Repeat the same Save/dirty/flicker/enable assertion on **≥2 other** sheets that share the pattern (e.g. Barrier, Growth rate, Strike, TP/SL) — not only the sheet in the title                       |
| Duration / expiry / `date_expiry` / proposal seed / daily-only / `processContractsForV2` | **First proposal + switch** | Cold load **and** market or trade-type **switch**; assert the **first** proposal/WS request succeeds (no recover-after-error); if daily-only, also a symbol with **min duration > 1d** when relevant |
| Tab trade params / `sessionStorage` / allow-equals / per-tab persistence                 | **Persistence matrix**      | Tab switch, soft refresh, one related toggle (e.g. Allow equals), one other field (barrier/digit/duration) still correct                                                                             |
| Theme / dark mode / GIF / chart settings theme                                           | **Theme both**              | Verify **light and dark**; every asset/path named in the PR (don't stop at one GIF)                                                                                                                  |
| Help / helpcentre / brand URL / region / geo chrome                                      | **Geo spot-check**          | ≥1 **non-EU** and **EU** (or VPN) expectation; do not sign off a single region                                                                                                                       |
| Buy / stake / balance / insufficient / purchase loading                                  | **Gate matrix**             | Stake above balance (client gate), logged-out Buy if in scope, Buy disabled or non-double-submit while loading                                                                                       |
| Toast / snackbar / `mapErrorMessage` / error banner                                      | **Error copy + stack**      | No raw snake_case (`date_expiry`); no **duplicate** toasts on rapid tab/market switch                                                                                                                |
| Chart / SmartCharts / stream / closed market / account switch chart                      | **Chart stress (manual)**   | Background tab resume, real↔demo or account switch, closed-market **initial** paint; state **e2e N/A** for canvas — do not invent chart Playwright follow-ups                                        |

**Sign-off anti-patterns (bans):**

- Do **not** sign off **cold-load only** when the bug is about **switching** markets, trade types, tabs, or accounts.
- Do **not** sign off only the sheet/control in the title when the PR changes a **shared** ActionSheet / header Save / validation pattern.
- Do **not** treat "proposal / UI eventually recovers" as pass if the **first** proposal failed.
- Do **not** sign off i18n / theme / help on a **single** language, theme, or region when the trigger above fired.
- Do **not** treat "e2e green" alone as chart sign-off when **Chart stress** triggered.

### 6. Format rules

- Every actionable item is a **GitHub checkbox**: `- [ ]`.
- Use **bold** for field/control names the tester will look for.
- Reference real values from the diff (test IDs, CSS deltas, component paths) — but **prefer fewer, sharper checks** over exhaustive lists.
- Tag 🔴/🟠 section headers with risk badges; optional modules may use 🟡/🟢 or no badge.
- Keep it skimmable: **≤ 10 `###` sections** in the posted comment for Small/Medium plans (Anti-leakage counts as one section).
- **Notes for tester** is mandatory (`>` blockquote) and must say **what to deprioritize** if time-boxed — but **never** tell the tester to skip a triggered §5d block.

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
- **Don't skip §2b related-bug search** — sibling tickets are how ActionSheet Save and daily-only expiry leaked after "green" QA.
- **Don't omit the out-of-scope section** when the PR names an untouched sibling — but prefer §5d sibling-surface checks when the pattern is shared.
- **Don't paste a generic template** — adapt every section to the actual diff, but **stay within the size tier** (§4). A calendar fix does not need cross-browser + edge cases + full Turbos journey.
- **Don't force a flow mapping where none fits** — pure component-polish bugs have no dedicated flow; say so and keep the plan Small tier.
- **Don't copy the whole flow step table** — link the flow id and spot-check 3–5 steps that exercise the changed control.
- **Don't always include a11y, cross-browser, edge cases, and negative testing** — use optional modules (§5) only when the diff/issue triggers them.
- **Don't duplicate sign-off** — one **Must pass to sign off** block replaces separate Entry, Exit, and Sign-off sections.
- **The automated-test section is Playwright e2e only — not unit tests.** Give the runnable command (spec file + `--grep` tag) and the coverage status; don't list the PR's Jest/Vitest cases. A QA reviewer reading the issue needs to know which e2e to kick off, not which unit assertions the dev added.
- **Always state coverage status explicitly, even when it's good news.** If the affected flow's platform column is ✅, say "e2e covers the happy path — manual QA focuses on the visual fix + edge cases". If it's ❌, say "no e2e on this platform — manual QA is the only backstop, treat the regression section as mandatory". Silent omission reads as "covered" when it isn't.
- **When e2e coverage is lacking for the fix, suggest a follow-up.** If the issue's symptom (e.g. negative barrier overlap) isn't asserted in any flow, propose adding it — point at `qa-milestone-to-playwright` (release backfill) or `flow-to-playwright-dtrader` (single gap) or `src-to-flow-dtrader` (new user journey), and mark it as an out-of-this-PR follow-up so it doesn't block sign-off. **But never propose a follow-up for an `N/A` surface** (e.g. SmartCharts canvas) — it's not automatable by design; say "no e2e applies — manual-only" and point only at the indirect flows that touch it. Don't fabricate a runnable e2e command for a surface that has none.

## Examples of good "Notes for tester" lines

- _"The two things most likely to break are (1) an empty icon slot/gap where the chevron was, and (2) tap-to-open regressing if the `onClick` handler was disturbed."_
- _"If the barrier is still fully hidden, the blur change wasn't enough and the fix may need a layout/z-index follow-up (out of scope of this PR)."_
- _"Prioritize the month-navigation height-stability and day-tile-shape sections — if the selection pill turns into an oval on short months, that's the `align-content: flex-start` override being lost."_
- _"Anti-leakage: do not skip the Barrier + Growth-rate Save checks — Stake alone looked green before #1193–#1195."_
- _"First proposal after switching to daily-only must succeed — a recover-on-second-request is a fail (see #1262 → #1294 → #1351)."_
