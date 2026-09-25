---
name: diagnose-healer-close
description: >-
    Label why closed (unmerged) Playwright Auto Healer PRs were rejected — buckets
    for prompt/skill fixes. Use when diagnosing healer PR closes or "why was
    healer PR #N closed?".
argument-hint: 'pr=<number|url|all> [repo=deriv-com/home-app]'
---

# Diagnose closed healer PRs

Closed without merge **is** the human label: wrong fix or not needed. This skill recovers **why**, so healer prompt/skill changes have a target. Do not open healer-agent PRs from this run.

## When to use

- "Why was healer PR #N closed?"
- "Label closed healer PRs"
- "What should we fix in the healer?" after looking at `/agent`

Do **not** use for writing tests, running the healer, or weekly CI.

## Source of PR list

**Fetch from GitHub yourself.** `gh search` / `gh pr view` is the inventory. You need `gh` for diff and comments anyway; do not call the dashboard API.

If the user **pastes** numbers or URLs from the `/agent` dashboard page, use those as scope — that is a convenience, not a fetch.

## Rubric

Read `skills/fix-testdino-test-case/SKILL.md` standing rules + Phase 4 STOP rules (screenshot required, `src/` hard intent, closed-unmerged **same error + same on-screen DOM** → STOP). Same spec/POM with a different control in the shot is not a duplicate. Judge the **healer PR** against those rules — that is what it should have obeyed.

## Buckets (exactly one per PR)

| Bucket                | When                                                                                                                                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `should_not_open`     | Failure not a valid obsolete-test (flake, infra, screenshot contradicts, env mismatch, product bug). Healer should have written `no-change.md`.                                                                               |
| `wrong_patch`         | Failure valid; diff is the wrong change (bad locator, weakened assert, wrong viewport, ignored screenshot).                                                                                                                   |
| `duplicate_rule_miss` | Earlier healer PR with the **same error and same on-screen DOM** was already **closed unmerged** (or still open). Skill says STOP; this PR still opened. Same files with a different control in this shot is not this bucket. |
| `unneeded_other`      | Known issue match, already fixed on main, duplicate of a **merged** human/healer PR, etc.                                                                                                                                     |

Every closed PR gets a bucket, including one-offs. Do not skip n=1. If there is no suitable bucket, you may invent one yourself.

## Evidence stack (do not skip)

Do **not** trust the PR body, it is the reasoning provided by the healer agent, use it as a tip on why the PR was created, and use it with other data to diagnose. Prefer this order — regression `playwright-test-results-*` GH artifacts are **optional** and often **expired**; do not treat missing them as “unverifiable.”

| Priority | Source                                                                                | What it proves                                                                                                        |
| -------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------ |
| 1        | **Heal job log** (Daily Playwright Auto Healing → `Heal: <error title>`)              | Agent tool calls (`[→ Read                                                                                            | Bash | …]`), reasoning, whether it claimed to view a screenshot, STOP/`no-change` decisions |
| 2        | **TestDino** run-scoped case (MCP `get_testcase_details` with `testrun_id` + case id) | Ground-truth error, call log, **signed screenshot / error-context** URLs (still available when GH artifacts are gone) |
| 3        | PR **diff** + human **close comments**                                                | What landed in the PR; reviewer rejection text                                                                        |
| 4        | Same-title healer PR history + current `src/`/POM spot-check                          | `duplicate_rule_miss` / `unneeded_other`; hard intent only when needed                                                |
| —        | GH Actions `playwright-test-results-*` download                                       | Optional backup only. Often expired within days. **Do not** require this to diagnose.                                 |

### How to open the heal job log

From the PR body’s **`## Links`** → **Healer job (this group)**, or reconstruct:

```sh
# List heal jobs on a Daily Playwright Auto Healing run
gh api repos/deriv-com/home-app/actions/runs/<healingRunId>/jobs \
  --jq '.jobs[] | {id,name,conclusion}'

# Full log for one Heal: job (contains agent narrative + [→ tool] calls)
gh run view <healingRunId> --repo deriv-com/home-app --log --job <jobId>
```

Match the job name to the failure title (`Heal: Error: …` / `Heal: TimeoutError: …`). Search the log for `[→ `, screenshot / `error-context`, `STOP`, `no-change`, classification wording. That is what the agent actually did — not what the PR body claims.

### TestDino (when linked)

- Prefer URLs / ids from **`## Links`** or the body. Pass **`testrun_id`** with the case id so you get the **failing run**, not “latest” (latest may be an unrelated env miss).
- Download/view the signed **screenshot** and **error-context** from the MCP `evidence` URLs. If the healer claimed it viewed a screenshot and the log or shot contradicts that, say so in `why`.

## Steps

1. **Scope.** If the user passed PR numbers/URLs, use those. Else list closed-unmerged healer PRs:

```sh
gh search prs --repo deriv-com/home-app --limit 50 --json number,title,url,closedAt \
  -- "Playwright Auto Healer Fix:"
```

For each number: `gh pr view N --repo deriv-com/home-app --json mergedAt,state,title,url`. Drop `mergedAt`. Confirm title starts with `Playwright Auto Healer Fix:` or branch `claude/playwright-healing-`.

2. **Per PR, gather evidence:**

```sh
gh pr view N --repo deriv-com/home-app --json title,body,files,closedAt,url,headRefName,comments
gh pr diff N --repo deriv-com/home-app
```

Then, in order from the **Evidence stack**:

- Heal job log for that group (`## Links` or `gh run view --log --job`).
- TestDino run-scoped case + **open the screenshot** when a URL/id exists. Legacy PRs may lack `## Links` — reconstruct from body `test_run_*` / case path segments, or TestDino MCP by title + counter. Do not invent `testdino.com/testcase/<id>` from a bare id.
- Same-title healer history: `gh search prs --repo deriv-com/home-app -- "Playwright Auto Healer Fix:" <distinct error substring>`
- Spot-check `src/` / POM only when needed to confirm `wrong_patch` vs `should_not_open`.

If the heal log and TestDino are both missing, say **evidence: PR-only** in `why` — still bucket from diff + comments; do not invent screenshot findings.

3. **Pick the bucket.** Prefer `duplicate_rule_miss` when a **prior closed-unmerged** healer PR has the **same error and same on-screen DOM** and this PR is not a materially different approach. Same POM hunk with a different control in this shot is not this bucket.

4. **Output** one table, then counts by bucket. Do not file a healer-agent PR.

```md
| PR  | Title (stripped) | Bucket                                                                  | Why (one line) | Healer lever                                 |
| --- | ---------------- | ----------------------------------------------------------------------- | -------------- | -------------------------------------------- |
| #N  | …                | should_not_open \| wrong_patch \| duplicate_rule_miss \| unneeded_other | …              | prompt / skill STOP / GitHub closed-PR check |
```

**Why** must cite evidence (heal-log tool/claim, screenshot vs assert, prior #M closed, `src/` still has X). No "probably" without a cite. Prefer citing the heal log when judging whether the agent inspected a screenshot.

**Healer lever** is the smallest change that would have produced `no-change.md` or a different patch — not a full redesign.

5. **Roll-up** (this is what you use to improve the agent):

```md
| Bucket | Count | Example PRs |
```

Same `why` on many PRs → one healer change. `duplicate_rule_miss` → the closed-unmerged STOP is not firing (make the GitHub check mechanical). Do not ignore one-offs in the table; they still count.

## Examples

- Coin-picker closed 3× with the same title after earlier closes → `duplicate_rule_miss` (+ `should_not_open` when screenshot/heal log shows rate-unavailable / Deposit paused). Lever: enforce prior closed-unmerged search before `pr-body.md`. Same POM with a **different** on-screen control (e.g. `dialog "Market selection"` vs `.quill-action-sheet--root`) is not this bucket.
- CFDs nav failure; heal log claims entitlement fix but TestDino/shot shows **Something went wrong** / skeleton nav → `should_not_open` (infra). Lever: screenshot gate before edit; do not strip shared `login()` asserts from a body-only story.
- One-off wrong locator on a unique title → still label it `wrong_patch`. Do not drop it.
