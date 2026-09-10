---
name: qa-check-regression-failures
description: >-
    Triage staging E2E regression automation failures from AKO Slack posts: collect
    hard-failed Playwright tests from the GitHub Actions run / TestDino, re-run them
    locally against staging in desktop-then-mobile batches (no retries; expand serial
    specs to the whole file), and auto-reply in the Slack thread — tag QA when
    failures still reproduce, or note that they passed locally when all clear. Use
    when the user pastes an AKO regression thread (e.g. Staging E2E regression
    failed), invokes this skill with no link (pick the latest AKO regression in
    the channel and confirm the release version), asks to check regression
    automation failures, re-run CI failures locally, or investigate flaky vs real
    staging regression failures in #project_dtrader_charts_v2.
version: 1.8.1
last_updated: 2026-09-10
---

# Check Regression Failures (local re-run + Slack)

1. Collect **hard failures** from the AKO staging regression thread / GH Actions run.
2. Re-run each failure **once** locally against staging (`--retries=0`).
3. Auto-post a thread reply: still-failing → tag QA; all passed locally → say they passed (likely flaky).

## When to Use

- User pastes an AKO regression Slack link / thread (failed or triggered)
- User invokes this skill with **no** link — pick the latest AKO regression in the channel
- User asks to check / triage staging regression automation failures
- User asks whether CI failures are flaky vs real bugs

## Prerequisites

- `gh` CLI authenticated with access to `deriv-com/derivatives-trader`
- Slack MCP (`slack_read_thread`, `slack_send_message`)
- Local Playwright clone with staging env ready
- Prefer TestDino MCP for the failed-case list when available

Resolve **`LOCAL_REPO_PATH`** before any local command (prerequisite check, Step 3 checkout, Playwright runs):

1. If `PLAYWRIGHT_LOCAL_REPO_PATH` is set and `$PLAYWRIGHT_LOCAL_REPO_PATH/playwright/.env.staging` exists → use it.
2. Else if the agent cwd is inside a clone (`git rev-parse --show-toplevel` succeeds and that root has `playwright/.env.staging`) → use the git root.
3. Else **stop and ask the user** for the absolute path to their `derivatives-trader` clone; set `LOCAL_REPO_PATH` to that value.

```bash
gh auth status
LOCAL_REPO_PATH="${PLAYWRIGHT_LOCAL_REPO_PATH:-$(git rev-parse --show-toplevel 2>/dev/null)}"
test -n "$LOCAL_REPO_PATH" && test -f "$LOCAL_REPO_PATH/playwright/.env.staging"
```

## Constants

### Repo / local run

| Key                | Value                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| GitHub repo        | `deriv-com/derivatives-trader`                                                                        |
| Local repo path    | `LOCAL_REPO_PATH` — `PLAYWRIGHT_LOCAL_REPO_PATH`, else `git rev-parse --show-toplevel`, else ask user |
| Local `TEST_ENV`   | `staging`                                                                                             |
| Local retries      | **0** (always pass `--retries=0`; never re-run a failure)                                             |
| Projects           | `chromium`, `chromium-mobile` (map from CI job name)                                                  |
| Local JSON reports | `/tmp/rerun-<project>-<serial\|independent>.json`                                                     |

### Slack

| Key          | Value                       |
| ------------ | --------------------------- |
| Channel name | `project_dtrader_charts_v2` |
| Channel id   | `C096W3LNX32`               |
| QA usergroup | `S05D6NPU3V2`               |
| QA mention   | `<!subteam^S05D6NPU3V2>`    |
| AKO bot      | `U0ACTGCU2AJ`               |

### TestDino

| Key        | Value                              |
| ---------- | ---------------------------------- |
| Org id     | `org_69fc32be4a820df27cf28aa2`     |
| Project    | `derivatives-trader`               |
| Project id | `project_6a2fcc19cffd67f873f4b77b` |

---

## Workflow

### Step 1: Resolve the Slack thread + CI run URL

Input may be:

- A Slack permalink (`…/archives/C096W3LNX32/p…`)
- Channel + message context
- A GitHub Actions run URL alone
- **No link** (user invoked the skill / asked to check regression) → **latest AKO regression in the channel**

**No link — latest in channel**

1. `slack_read_channel` on `C096W3LNX32` (newest first). Find the latest AKO (`U0ACTGCU2AJ`) thread whose parent asks to perform staging regression and includes a release version like `` `production_V20260903_0` ``. Prefer a thread that already has `:x: *Staging E2E regression failed*` (if the newest regression ask has not failed yet, use that ask anyway).
2. Read the full thread (`slack_read_thread`).
3. **Stop and ask the user to confirm the release version** before Step 2. Exact shape:

```text
Latest AKO regression in #project_dtrader_charts_v2 is release `production_V20260903_0` (milestone / run if known). Proceed with this one?
```

Use the real version string from the parent (backticks). Do **not** collect failures, run Playwright, or post anything to Slack until they confirm (yes / that version / “proceed”). If they say no, ask for a permalink or the correct `production_V…` and find that thread instead. After they confirm, post the **checking** thread reply (below) before TestDino / local runs.

**Permalink or run URL**

From a Slack URL `pXXXXXXXXXXXXXXXXX` → `message_ts` = insert `.` before the last 6 digits  
(e.g. `p1788428107523989` → `1788428107.523989`).

Read the thread with `slack_read_thread` (`channel_id=C096W3LNX32`, parent `message_ts`). Still **confirm the release version** the same way before Step 2 (skip the confirm only if the user already named that `production_V…` in the same message, or pasted that thread’s permalink).

Extract:

- Parent `message_ts` (for the reply)
- Release version (`production_VYYYYMMDD_N`) / milestone (from parent)
- CI run URL from AKO lines like:
    - `:test_tube: *Staging E2E regression triggered*`
    - `:x: *Staging E2E regression failed*`
- Run id from `/actions/runs/<id>`

If the user only gave a run URL, still find the matching AKO failure thread in `C096W3LNX32` (search / recent history) so the reply lands in-thread. If no thread is found, stop and tell the user — do not post a new top-level channel message.

#### Checking ping (before TestDino / local runs)

Right after the release is confirmed (and you have parent `message_ts` + run URL), tell the channel thread that triage has started so others do not duplicate the work.

`slack_read_thread` first. If a reply already contains `Bot is checking these staging E2E failures locally`, skip — do not send another.

Otherwise `slack_send_message`:

- `channel_id`: `C096W3LNX32`
- `thread_ts`: parent message ts
- `reply_broadcast`: `false`
- `unfurl_app_links`: `false`

```text
Bot is checking these staging E2E failures locally against staging.

CI run: <https://github.com/deriv-com/derivatives-trader/actions/runs/<id>>
```

Rules:

- Do **not** mention `<!subteam^S05D6NPU3V2>` on this message (QA ping is only Step 4).
- Do **not** wait for GitHub `completed` to send this — post even if AKO / GH still shows running.
- Then continue with the GitHub poll / Step 2.

If you abort later (CI `cancelled`, empty hard-fail list, dirty git, tests never started), post one short thread follow-up that you stopped, so the checking ping is not left hanging. Still **no** QA mention on that abort note.

#### CI done = GitHub, not Slack

AKO often stays on “still running” after the workflow has already finished. **Do not** wait on Slack copy, and **do not** collect TestDino / parse fail lists from a run that is still `in_progress`.

```bash
gh run view <id> -R deriv-com/derivatives-trader --json status,conclusion,headSha,jobs
```

- `status` is the source of truth (`queued` / `in_progress` / `completed`).
- Poll about every 60s while `status != completed`. Tell the user you are waiting on GitHub (mention if Slack still says running).
- Proceed to Step 2 only when `status` is `completed`.
- Need Chromium + Chromium Mobile jobs terminal (`success`, `failure`, or `cancelled`). A skipped Slack Notification job is fine.
- If `conclusion` is `cancelled`, stop — do not re-run or send the Step 4 QA ping. Do send the abort follow-up if the checking ping already went out.
- Save `headSha` for Step 3 checkout.

### Step 2: Collect hard failures only

Prefer **TestDino** (`project_6a2fcc19cffd67f873f4b77b`) — this is the source of truth for hard-failure **counts**:

1. `list_testruns` — do **not** filter `by_environment=staging` (CI often reports `environment: unmapped`). Match `metadata.pipeline.id` to the GitHub Actions run id. Expect one TestDino run per platform job (e.g. chromium + chromium-mobile).
2. `list_testcase` — `by_testrun_id=<ids>`, `by_status=failed` (paginate until complete). Trust TestDino’s `failed` count (e.g. 7+13=20), **not** Playwright’s list-reporter `N failed` line (can be higher). Use TestDino `platform` (`chromium` / `chromium-mobile`) as the project. Spec path is often `trade/.../foo.spec.ts` in `title_path` — prefix `playwright/tests/` if missing.
3. **Do not** include `flaky` (passed on CI retry) or `passed` / `skipped`.

Keep the CI hard-fail set as `(project, spec, title)` — Step 4 labels local serial siblings that were **not** in this set.

Fallback if TestDino is unavailable: `gh run view <id> -R deriv-com/derivatives-trader` + `--log-failed`, and keep only tests whose **final** result is failed (exclude cases that failed then passed on `retry #1`). Prefer the TestDino `Results … N failed` box in the same log over the Playwright `N failed` list when they disagree.

For each hard failure capture:

| Field         | Source                                            |
| ------------- | ------------------------------------------------- |
| Spec path     | e.g. `playwright/tests/.../foo.spec.ts`           |
| Title         | Playwright test title                             |
| Project       | `chromium` or `chromium-mobile` from job/platform |
| Error snippet | optional short assert/timeout line                |

Dedupe by `(project, spec, title)`.

If the hard-failure list is **empty**: tell the user (likely all flaky recovered in CI). **Do not** send the Step 4 QA ping. If the checking ping already went out, post the abort follow-up (e.g. no hard failures in CI / all recovered as flaky). Stop.

### Step 3: Re-run locally (once each, no retries)

Working directory: `$LOCAL_REPO_PATH` (resolve in Prerequisites before Step 3)

#### Pin the clone to the CI SHA

Re-run the **same commit** as the Actions run (`headSha` from Step 1). A local branch that moved overnight makes “flake” vs “reproduced” meaningless.

1. `git status --porcelain` in `$LOCAL_REPO_PATH`. If dirty, **stop** and ask the user — do not stash, commit, or checkout.
2. Record current `HEAD` and branch: `git rev-parse --abbrev-ref HEAD` and `git rev-parse HEAD`.
3. `git fetch origin <headSha>` (or `git fetch origin`) then `git checkout <headSha>` (detached is fine).
4. After all local batches finish (and after Slack / chat report), `git checkout` the recorded branch or SHA so the clone is not left detached unless the user was already on that commit.

#### Desktop then mobile

**Do not run Desktop and Mobile at the same time.** Parallel Chromium + Chromium-mobile overloads the machine (CPU/RAM, OS permission popups). Batch by project, in this order:

1. **Desktop first** — `--project=chromium` until that process exits.
2. **Mobile second** — `--project=chromium-mobile` only after desktop has fully finished.

Open each failed spec before running. If it contains `test.describe.configure({ mode: 'serial' })`, the tests in that file are a **related sequence** (shared account/`beforeAll`, later cases depend on earlier ones). A title-only `--grep` would skip siblings — do not do that.

Split the project’s failures into two groups, still **desktop then mobile**:

1. **Serial specs** — run the **whole file**, no `--grep`. Example: CI failed only `VERIFY Buy "Touch" Contract and Close (Demo Account)` → still run all four Touch/No Touch tests in `verify-touch-no-touch.spec.ts`.
2. **Independent specs** (no `serial`) — keep `--grep` to the failed title(s) only.

`--grep` applies to every file in that invocation, so **do not mix** serial files and grepped independent files in the same command. Two commands per project is fine: serial files first, then independent.

#### JSON report is the local result source of truth

Do **not** classify pass/fail/skip from the line reporter (`N failed`, `did not run` with no titles). Write a Playwright JSON report per batch and read `suites` → tests (`status`: `expected` / `unexpected` / `flaky` / `skipped` / `timedOut`).

```bash
# 1) serial sequences — entire files
CI=1 TEST_ENV=staging PLAYWRIGHT_JSON_OUTPUT_NAME=/tmp/rerun-chromium-serial.json \
  npx playwright test \
  playwright/tests/trade/touch-no-touch/verify-touch-no-touch.spec.ts \
  --project=chromium --retries=0 --workers=3 \
  --reporter=line --reporter=json

# 2) independent failures — title grep only
CI=1 TEST_ENV=staging PLAYWRIGHT_JSON_OUTPUT_NAME=/tmp/rerun-chromium-independent.json \
  npx playwright test \
  playwright/tests/market-selection/verify-market-search.spec.ts \
  --project=chromium \
  --grep "<escaped-title>" \
  --retries=0 --workers=3 \
  --reporter=line --reporter=json
```

If `PLAYWRIGHT_JSON_OUTPUT_NAME` is empty after the run, re-run that batch with `--reporter=json` only and redirect stdout to the same `/tmp/rerun-*.json` path.

`--workers=3` is parallelism **across files** in that command. Serial files still run their tests **in order inside the file**.

Do **not** launch 20 separate one-test processes. Skip a project if it has no hard failures.

Do **not** Slack post until this project’s serial run **and** independent run have both finished (or been skipped because empty). Then do mobile the same way.

Rules:

- **One attempt only** — never retry a local failure; never omit `--retries=0`.
- `CI=1` keeps the run headless; `--retries=0` overrides CI’s default retry count.
- Independent tests: exact title in `--grep` (escape regex-special characters).
- Serial files: no title `--grep`; Playwright serial mode still skips later tests if an earlier one fails — that is expected. Those skipped titles **must** come from the JSON report (not from guessing).
- Unset `TESTDINO_TOKEN` so local triage does not publish to TestDino.
- Do **not** log or paste secrets from `playwright/.env.staging`.

Classify each local test (from JSON):

- **Passed locally** → likely CI flake (omit from Slack)
- **Failed / timedOut locally** → still failing; candidate real bug
- **Skipped** in a serial file after an earlier failure → include on Slack (see Step 4 labels)

### Step 4: Auto-post Slack after local re-runs

After desktop **and** mobile Step 3 are done (including serial whole-file runs), post **one** outcome reply in the thread. Always `slack_read_thread` first for idempotency.

Shared send params for both outcomes:

- `channel_id`: `C096W3LNX32`
- `thread_ts`: parent message ts from Step 1
- `reply_broadcast`: `false`
- `unfurl_app_links`: `false`

#### A) Local failures remain

**Idempotency:** if any reply already contains this run’s Actions URL **and** (`<!subteam^S05D6NPU3V2>` or “still reproduce locally”), **do not** send again — return the existing permalink in chat.

**If one or more tests still fail or were serial-skipped locally** → immediately `slack_send_message` (no draft, no wait for confirmation).

**Required message shape** — group by Playwright job. Skip a heading if that job has no local failures/skips to report:

```text
<!subteam^S05D6NPU3V2> these failures still reproduce locally against staging — could be a potential bug. Please check:

Chromium
- `<spec-path>` — <test title>
- `<spec-path>` — <test title> (local serial sibling; not in CI fail list)
- `<spec-path>` — <test title> (skipped after earlier serial failure)

Chromium-mobile
- `<spec-path>` — <test title>

CI run: <https://github.com/deriv-com/derivatives-trader/actions/runs/<id>>
```

Rules:

- Always include `<!subteam^S05D6NPU3V2>`.
- Headings: `Chromium` then `Chromium-mobile` (desktop first). Omit a section if empty.
- List tests that **failed/timedOut locally**, plus serial **skipped** tests caused by an earlier failure in the same file. Omit local passes.
- Label vs the Step 2 CI set:
    - CI title that failed locally → bullet is just `` `spec` — title `` (no extra note).
    - Failed locally but **not** in the CI hard-fail set (typical whole-file serial extra, e.g. CI failed Demo and local failed Real) → append ` (local serial sibling; not in CI fail list)`.
    - JSON `skipped` after an earlier serial failure → append ` (skipped after earlier serial failure)`.
- Do **not** number the headings. Do **not** repeat the project name on each bullet — the heading is the job.
- Keep bullets short; no secrets, traces, or huge stack dumps.
- After posting, return the Slack permalink to the user plus a brief local pass/fail summary (CI count vs local reproduced vs local serial extras vs flakes).

#### B) Every local re-run passed

**Idempotency:** if any reply already contains this run’s Actions URL **and** (`passed locally against staging` or `:white_check_mark:` with that run URL), **do not** send again — return the existing permalink in chat.

**If every local re-run passed** (no local fails/timeouts and no serial skips-to-report) → immediately `slack_send_message` (no draft). **Do not** mention `<!subteam^S05D6NPU3V2>`.

```text
:white_check_mark: All CI hard failures passed locally against staging — likely flaky.

CI run: <https://github.com/deriv-com/derivatives-trader/actions/runs/<id>>
```

Also report the flake summary in chat and return the Slack permalink.

#### Could not run

**If local runs could not start** (missing env, install errors, wrong cwd, dirty git, checkout failed) → fix/report in chat. If the checking ping already went out, post the abort follow-up. **Do not** post a misleading “still reproduce” or “passed locally” message.

---

## Notes / pitfalls

- AKO thread pattern: parent regression ask → triggered run → `:x: *Staging E2E regression failed*` with the same run URL.
- Invoking with no paste: latest AKO regression in `C096W3LNX32`, then confirm `production_V…` before the checking ping, local run, or QA post.
- **GitHub `gh run view` status**, not AKO “still running”, decides when CI is done.
- Chromium desktop and mobile are separate CI jobs / often separate TestDino runs for one GH `run_id` — collect both.
- Local re-run order is **desktop then mobile**, never both projects in parallel (resource pressure / OS popups).
- Checkout the Actions `headSha` before tests; restore the previous HEAD afterward.
- Serial specs (`mode: 'serial'`) must re-run the **whole file**, not a single `--grep` title. Classify those results from JSON, including skipped siblings.
- Slack-label serial extras and skips so QA can tell them apart from the original CI titles.
- Do not post Slack from a title-only `--grep` pass if serial files were supposed to run as sequences.
- After version confirm, post the in-thread checking ping (no QA mention) so others know triage is in progress; skip if that copy is already in the thread.
- After local runs: either the QA “still reproduce” ping **or** the “passed locally / likely flaky” note — never both for the same run.
- Do not post a second outcome reply if this run URL is already in the thread with the matching outcome copy.
- Resolve `LOCAL_REPO_PATH` before local runs (`PLAYWRIGHT_LOCAL_REPO_PATH` → git root → ask user). Never hardcode a personal machine path in commands.
- Never post credentials, decrypted env contents, or OTP/email payloads.

## Related

- `qa-announce-ready-for-staging` — milestone announce before regression starts
- `qa-bug-report` — turn a confirmed local failure into a QA bug report (only when asked)
