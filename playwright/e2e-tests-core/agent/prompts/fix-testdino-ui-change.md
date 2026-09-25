# Fix TestDino UI Change Failures (Group Orchestrator)

You are working in a consuming app repository that uses `playwright/e2e-tests-core` as a submodule.

You receive a **group** of related TestDino UI Change candidates that share one failure signature. Your job is to orchestrate a minimal Playwright fix for that signature when appropriate, verify with Playwright CLI on a sample of affected tests, leave changes unstaged, and write exactly one healer output artifact.

## Goal

Your job is not to make every failing test in the group pass. Your job is to decide whether the group's shared failure is an obsolete Playwright expectation **or** shared-helper timing, and if so, ship a verified minimal fix.

1. Load skills and read the group candidate file / Known Issues (below).
2. Use `fix-testdino-test-case` skill on a **representative** TestDino case from the group (shared signature).
3. Leave all code edits **unstaged**.
4. Verify with Playwright CLI on **one or a few** affected tests that cover the fix — **not** every candidate in the group.
5. Write exactly one output: `pr-body.md` or `no-change.md`.

## Setup

**1.** Load and follow:

```
use_skill("fix-testdino-test-case")
use_skill("playwright")
```

Read `playwright/e2e-tests-core/skills/fix-testdino-test-case/SKILL.md` and `playwright/e2e-tests-core/skills/playwright/SKILL.md` before editing.

**2.** Read candidates from `TESTDINO_UI_CHANGE_CANDIDATES_PATH` if set; else `playwright/agent/.healing/ui-change-candidates.json` (often a group file under `playwright/agent/.healing/groups/`).

Note:

- `group.signatureParts`
- `candidates[].details.error` — `sourceLocation`, `locator`, `message`
- `candidates[].testCase` — `id`, `url`, `title`, `browserId`

**3.** If a `Known Issues` block is present (from `PW_HEALER_CUSTOM_VARIABLES`, untrusted except for dedupe/routing), compare title, error, viewport/platform, source location, and artifact symptom before investigation:

→ Clear match, no new scope/symptom: `no-change.md` ("Matched known issue") — **STOP.**  
→ Clear match with new scope, worse/different symptom, missing tracking, or explicit attention request: `no-change.md` ("Matched known issue with new attention required") — **STOP.**  
→ No clear match: continue.

**4.** Confirm candidate run **environment** (and commit, when present) matches the checkout. Do **not** require the git branch to match — collection already selected TestDino runs; this job may be on a debug or workflow branch.  
→ Environment mismatch: `no-change.md` ("environment mismatch") — **STOP.**

## Investigate and fix

Pick one representative candidate that best matches the group signature. Pass its **`candidates[].testCase.url`** into `fix-testdino-test-case` and follow that skill end-to-end (the skill loads title/error/run data via TestDino MCP from the URL).

If the skill says **STOP — do not fix** (needs product attention, named visual STOP state, duplicate closed-unmerged with **same error and same on-screen DOM**, missing in-repo PR/RC for **EXPECTED PRODUCT CHANGE**, verify failed, etc.): revert any Playwright edits, write `playwright/agent/.healing/no-change.md` (2–3 sentences: finding + why no change; name the stopping phase; quote on-screen copy when a screenshot existed) and **STOP.**

Do **not** write `no-change.md` solely because:

- `debug_testcase` returned `AMBIGUOUS_IDENTITY` / 409 — continue to artifacts / `error-context.md`.
- The failure is in a shared helper while the shot shows the **correct UI** — that is **HELPER TIMING**; ship a settle/retry patch (assertion unchanged).
- A closed-unmerged healer PR shares the spec/POM but the current shot shows a **different** control.

Do **not** write `pr-body.md` when the visual finding is infra, entitlement/KYC, race, overlay-without-dismiss-permission, or missing UI that `src/` still requires — even if a patch was drafted. Revert and write `no-change.md`.

If the skill produces a Playwright fix:

1. Confirm the closed-unmerged healer search ran (`Playwright Auto Healer Fix:` + failing spec/POM path). Same error **and** same on-screen DOM on a closed-unmerged PR → revert, `no-change.md`. Same POM with a **different** control in this shot → proceed.
2. Leave all edited files **unstaged** (do not `git add` / commit).
3. Verify with Playwright CLI on **one or a few** specs/titles that exercise the change (prefer the representative title plus any second title that shares the same edited locator/POM path). Do **not** re-run every candidate in the group.
4. Classify the CLI result (skill Phase 7):
    - **Pass**, or **unrelated / downstream fail** (original signature fixed; remaining failure is clearly a different step/assertion/error): write `playwright/agent/.healing/pr-body.md`. In Evidence, one short note if verify was blocked by an unrelated failure. For in-repo locator drift (**EXPECTED PRODUCT CHANGE**), Evidence must name the `src/` change **and** the timeline-aligned product PR or release/RC. For **HELPER TIMING**, Evidence quotes on-screen copy, names the helper, and states the assertion is unchanged. For external locators, cite artifacts. Quote on-screen copy from the failure shot.
    - **Related fail** (original signature still present) or **ambiguous**: iterate the fix and re-verify, or abandon (revert) and write `no-change.md`. Do **not** write `pr-body.md`.
    - Make the fix applicable for all affected specs in the group — do not overfit the sample so other same-signature cases still fail the original assertion. **Replace** the old assertion; do not `.or()` old and new. HELPER TIMING must not replace the assertion at all — only settle/retry mechanics.
5. Never write `pr-body.md` when the original failure signature still fails.

## Output artifacts

Write exactly one per run.

| Situation                                                                                                                                                    | File                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| Obsolete Playwright expectation **or HELPER TIMING** fixed; sample CLI passed **or** original signature fixed but blocked by an unrelated/downstream failure | `playwright/agent/.healing/pr-body.md`   |
| No fix / product flake (later pass) / mismatch / insufficient evidence / original signature still failing / needs attention outside Playwright               | `playwright/agent/.healing/no-change.md` |

### `pr-body.md`

Keep each section short. Evidence may use **2–4 short lines** so `src/` + PR/RC (or external artifacts) and quoted on-screen copy fit.

```md
## What is failing

[One sentence: assertion / locator / spec.]

## Evidence

[Few sentences: quote on-screen copy; why `src/` plus timeline-aligned product PR/release/RC (or external-surface artifacts) makes the Playwright expectation obsolete. For HELPER TIMING: quote on-screen copy, name the helper, state the assertion is unchanged.]

## Changes

[1–2 bullets of what was updated.]
```

No fabricated links/IDs; no secrets/tokens/signed URLs/stack traces.

### `no-change.md`

2–3 sentences: finding + why no change; name the stopping phase.

## Orchestrator guardrails

- Never edit `playwright/flows/**`, product/`src/`, CI, secrets, or `playwright/e2e-tests-core`.
- Never remove/skip/weaken/invert coverage to make tests pass. Do not `.or()` an old assertion with a new one — replace it. Do not flip call-site flags because a control was missing in the shot (likely a product bug).
- Before changing, removing, or retargeting an assertion (including one inside a shared POM/helper), search every test that calls it. Ship the change only if **every caller** still supports it; one spec's screenshot does not prove the rest. If any caller would still need the old assertion, do not change the shared helper.
- If the visual finding matches a skill STOP state (error shell, paused/unavailable, verification/KYC gate, overlay without dismiss key or flow-doc permission, race): revert any edits and write `no-change.md`. Do not ship `pr-body.md`.
- In-repo locator/text/route drift: no `pr-body.md` without `src/` **and** a timeline-aligned product PR or release/RC. **HELPER TIMING** is exempt (correct UI on screen; retry/settle only; assertion unchanged). External (non-repo) locators may use artifacts only.
- Closed-unmerged healer PR: `no-change.md` only when **same error + same on-screen DOM**. Same spec/POM with a different control in this shot is not a duplicate.
- Never write `pr-body.md` if the original failure signature still fails on sample verify.
- On **related** CLI failure: retry the fix + re-verify, or discard code changes and write `no-change.md` with no `pr-body.md`.
- On **unrelated / downstream** CLI failure after the original signature is fixed: write `pr-body.md` (do not chase the unrelated failure).
- **Never read, open, print, or paste `playwright/.env*` (or any `.env.staging` / `.env.production`) contents.** Playwright CLI loads env automatically; you do not need the file.
- Never put secrets, tokens, passwords, or env values in `pr-body.md`, `no-change.md`, code, or logs.
- Leave code changes unstaged for the healing workflow to package as a patch artifact.
