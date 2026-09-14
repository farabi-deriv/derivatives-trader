# TestDino Playwright Healing Agent

This agent finds recent failed TestDino test cases, groups related failures, asks an LLM to update Playwright tests, and opens one PR per fix.

## Default Flow

1. Collect recent failed TestDino candidates via the public API (`/test-runs` + `/debug-bundle`).
2. Group similar issues together using deterministic code.
3. Run AI regrouping to verify groups and merge related issues.
4. Run the healer agent for each final grouped issue. The agent loads `skills/fix-testdino-test-case`, uses TestDino MCP + GitHub artifacts, applies a Playwright fix when appropriate, and may iterate with Playwright CLI (without reading `.env` files).
5. Open one PR per group when the fixer succeeded, produced code changes, and wrote `pr-body.md` (agent sample CLI verification is the gate).
6. Upload grouped candidates internally, then publish two run artifacts after summarize: `playwright-healing-summary` (table only) and `playwright-healing-groups` (per-group folder).
7. Write aggregate counts and a per-group outcome table to the GitHub Step Summary.
8. Post created PR links back into the original failing-test Slack threads, then post an aggregate summary linking those threads to the configured healing Slack channel.

## Files

```text
agent
|-- README.md
|-- docs
|   |-- workflow-template.yaml        # consuming-repo caller workflow template
|-- eval                              # offline healer eval corpus — see eval/README.md
|-- prompts
|   |-- fix-testdino-ui-change.md     # fixer prompt
|   |-- regroup-testdino-ui-change.md # AI grouping prompt
|-- scripts
|   |-- run-llm-agent.sh              # shared LLM runner
|   |-- slack-utils.mjs               # shared Slack helpers
|   |-- workflow-facing scripts       # see Workflow Steps below
```

Companion skill (outside `agent/`): `skills/fix-testdino-test-case/SKILL.md`.

The reusable workflow implementation lives at `.github/workflows/playwright-healing-reusable.yaml` in this repository and is called by consuming repositories.

## Workflow Steps

`collect-ui-change-groups`

1. Setup: checkout, checkout submodules, and set up Node.js & Test LLM Connection.
2. Prepare healing matrix with `prepare-healing-matrix.mjs`.
   2.1. `find-testdino-ui-changes.mjs` collects recent failed TestDino candidates from `/debug-bundle` and attaches Slack thread metadata when available.
   2.2. `group-ui-change-candidates.mjs` builds deterministic candidate groups.
   2.3. `run-regrouping-agent.mjs` lets the LLM merge related deterministic groups.
   2.4. `prepare-healing-matrix.mjs` writes `group_count` and `matrix` GitHub outputs.
3. Upload grouped candidates.

`heal-ui-change-group`

4. Setup: checkout, checkout submodules, download grouped candidates, set up Node.js, install dependencies, install Playwright Chromium, and decrypt staging Playwright env files (so the fixer can run Playwright CLI while iterating).
5. Run healing fixer with `run-healing-fixer-stage.mjs` (LLM + patch packaging; timeout from `fixer_timeout_minutes`, default 45).
   5.1. `run-healer-agent.sh` builds the fixer prompt and invokes the shared LLM runner.
   5.2. The fixer loads `fix-testdino-test-case`, lists/downloads GitHub Actions artifacts, applies a fix when appropriate, and may re-run Playwright CLI while iterating.
   5.3. Package staged/unstaged patches plus `pr-body.md` or `no-change.md`.
6. Clean up decrypted env files.
7. Reset the worktree and apply the packaged patch with `apply-fixer-artifact.mjs` (PR-eligible when fixer succeeded, changes applied, and `pr-body.md` present).
8. Prepare PR body with `prepare-pr-body.mjs` when PR-eligible (appends `## Links` with this Heal job URL + TestDino case URLs).
9. Create pull request when PR-eligible.
10. Write group outcome with `write-healing-outcome.mjs` (also packs `publish/<group_id>/` for the run artifact).
    10.1. `slack-utils.mjs` provides shared Slack and candidate Slack-thread helpers for the PR thread reply.
11. Upload `_playwright-healing-group-<group_id>` (internal; nested as `<group_id>/…` so summarize can merge without colliding filenames).

`summarize-healing-results`

12. Setup: checkout, checkout submodules, set up Node.js, download `_playwright-healing-group-*` into `publish/`, and install healing agent dependencies.
13. Build healing summary with `build-healing-summary.mjs` (GitHub Step Summary + Slack text).
14. Upload two public artifacts: `playwright-healing-summary` (`healing-summary.md` only) and `playwright-healing-groups` (one folder per group: candidates, patches, stamped `pr-body.md` / `no-change.md`, `outcome.json`).
15. Post Slack summary and delete internal `_playwright-healing-group*` artifacts with `post-summary-and-teardown.mjs`.

Shared helpers:

- `run-llm-agent.sh` wraps the configured LLM CLI, optional TestDino MCP access, allowlisted Playwright CLI for agent iteration, and deny rules so the model cannot read `playwright/.env*`.

## Prerequisites

Consuming repositories that enable daily Playwright healing must have access to a compatible self-hosted runner. The workflow expects the configured runner label, such as `github-hosted-playwright01`, to be available to the repository and able to install dependencies, run Playwright Chromium verification, decrypt Playwright env files, and create pull requests.

## Required GitHub Settings

Required secrets:

- `TESTDINO_ACCESS_TOKEN` — user PAT with `td_pat_` prefix (public API + MCP)
- `LITELLM_API_KEY`
- `LITELLM_API_URL`
- `CLIENT_ID_GHAPP`
- `PRIVATE_KEY_GHAPP`
- `AUTO_OPS_BOT_TOKEN`

Required caller inputs or values:

- `TESTDINO_PROJECT_ID`
- `TESTDINO_ORG_ID` — org ID (`org_...`); required to build app.testdino.com case links
- `TESTDINO_BRANCH` — template value: `main`

Optional caller inputs or values:

- `TESTDINO_ENVIRONMENT` is optional; leave empty to skip environment filtering (CI runs are often tagged `unmapped`, not `staging`);
- `lookback_hours` defaults to `24`
- `run_counters` defaults to empty, which inspects recent runs by lookback
- `create_pr` defaults to `true`; scheduled runs always pass `true`
- `use_pinned_submodule` defaults to `false`; when `false`, the workflow runs `e2e-tests-core` healer scripts from the `master` branch
- `playwright_runner` defaults to `github-hosted-playwright01`
- `summary_runner` defaults to `ubuntu-latest`
- `node_version` defaults to `24.15.0`
- `pw_healer_submodule_path` defaults to `playwright/e2e-tests-core`
- Optional `PW_HEALER_LLM_MODEL` defaults to `claude-sonnet-4-6`
- Optional `fixer_timeout_minutes` defaults to `45` (LLM fixer step). Override from the caller `with:` block with a number, e.g. `fixer_timeout_minutes: 60`.
- Optional `PW_HEALER_CUSTOM_VARIABLES` JSON object is used to pass any additional variables. The fixer currently receives only `knownIssues` as untrusted operator context for dedupe and routing. Example:
    ```json
    {
        "knownIssues": [
            "There is a known issue with the userAgent for the mobile KYC POI/POA tests, causing the QR code to show and tests to fail. Already tracked; do not create Playwright fixes for matching failures with no new scope or symptom. Write no-change.md."
        ]
    }
    ```
- Optional `PLAYWRIGHT_HEALING_SLACK_CHANNEL_ID` posts aggregate Slack summaries when set; there is no default channel, so aggregate Slack posts are skipped when this is unset
- Optional `PLAYWRIGHT_HEALING_SLACK_CC` appends a Slack mention to the aggregate summary; defaults to `<!subteam^S0AP2400XLZ>` (qa_automation_ops slack handle) when unset

## Schedule Playwright Auto Healer In Your Repo

1. Ensure this repository's reusable workflow is accessible to the consuming repository in GitHub Actions settings. Private consuming repositories must be allowed to call `deriv-com/e2e-tests-core/.github/workflows/playwright-healing-reusable.yaml`.
2. Add the caller workflow:

    ```sh
    mkdir -p .github/workflows
    cp playwright/e2e-tests-core/agent/docs/workflow-template.yaml .github/workflows/playwright-healing.yaml
    ```

3. Make sure this agent folder is available at `playwright/e2e-tests-core/agent`.
4. Add the required secrets and variables.
5. Adjust the caller inputs for branch, environment, runner labels, and product defaults if the repo differs.
6. Keep `playwright/agent/.healing/` gitignored.
7. Update the cron schedule if needed.

## Workflow Notes

- Scheduled workflows run from the default branch.
- The template caller hardcodes `testdino_branch: main` and leaves `testdino_environment` empty (no env filter); set an environment only when TestDino run metadata matches that value.
- By default, the workflow updates the `e2e-tests-core` submodule from the branch configured in `.gitmodules`. Manual debug runs can set `use_pinned_submodule=true` to use the consuming repo's pinned submodule commit instead.
- TestDino collection uses fixed workflow defaults for non-caller knobs: max runs `100` and public API pacing `80` requests per minute. Failed-run list pagination is treated as complete (no counter-gap backfill).
- Candidate grouping happens before matrix jobs start. Matrix preparation collects TestDino failures, builds deterministic groups, lets AI regrouping merge groups that look like one root cause, then publishes the final groups to fixer jobs.
- TestDino public API and MCP both use `TESTDINO_ACCESS_TOKEN` (`td_pat_`). Public API base path: `https://api.testdino.com/api/v1/public/{projectId}/...` — see https://docs.testdino.com/api-reference/overview.
- The fixer discovers release context at runtime by querying recent GitHub production release tags (`production_YYYYMMDD_N` format) and inspecting the PRs they contain. It also searches for recent open or closed PRs that touch the failing spec, page object, helper, or locator source — including healer-authored and QA/human-authored test-fix PRs.
- When no matching failing test cases are found, the workflow ends after matrix preparation without uploading healing artifacts, running matrix jobs, or posting a summary.
- The fixer starts with `debug_testcase` for history/error context, then lists/downloads Playwright failure artifacts from the GitHub Actions run (`run.ci.workflowRunId`) via allowlisted `gh api` + `gh run download`. It selects the artifact from the live upload list rather than a hardcoded name. TestDino MCP/API attachments are `blobKey`-only and are not used for file download.
- Matrix preparation and the healer matrix run on `github-hosted-playwright01`. Each Heal job opens its own PR (branches are `claude/playwright-healing-<group_id>`).
- The matrix-preparation and fixer-stage scripts install agent-local dependencies with `npm ci --prefix playwright/e2e-tests-core/agent` so Claude Code and TestDino MCP are resolved from `agent/package-lock.json`.
- The LLM fixer step timeout defaults to 45 minutes (`fixer_timeout_minutes`) so the agent can diagnose, fix, and re-run Playwright CLI sample verification. Callers can override it.
- The heal job installs Playwright Chromium and decrypts staging env files so the agent can run Playwright CLI while iterating. Claude is denied from reading `playwright/.env*` via `--disallowedTools` + settings deny rules; CLI loads env without the model opening the file.
- The workflow checks for staged and unstaged tracked code changes while excluding `playwright/agent/.healing`.
- The fixer packages per-group `staged.patch` and `unstaged.patch` artifacts named with the group id. The same Heal job resets to HEAD, reapplies that patch, and opens the PR so eval links point at this group's fixer logs.
- A PR is created when the fixer succeeded (`llmSucceeded`), produced code changes, and wrote `pr-body.md`. Fixer timeout/failure skips patch apply and PR creation. There is no separate post-fixer machine Playwright gate.
- The GitHub Step Summary shows aggregate counts and a per-group outcome table. Download `playwright-healing-groups` for each group's candidates, patches, stamped PR body / no-change notes, and `outcome.json`. `playwright-healing-summary` is the table only. Internal `_playwright-healing-group*` zips are deleted at the end of the run.
- Slack notifications are sent only for scheduled runs or manual runs with `create_pr=true`. The Playwright test workflow must upload `_playwright-slack-thread-desktop` and/or `_playwright-slack-thread-mobile` artifacts for failed runs. When a PR is created, the PR link is sent to the original failing test's Slack thread and the aggregate healing summary is posted to the configured Slack channel.

## Local Commands

Collect and group candidates:

```sh
node playwright/e2e-tests-core/agent/scripts/find-testdino-ui-changes.mjs
node playwright/e2e-tests-core/agent/scripts/group-ui-change-candidates.mjs
node playwright/e2e-tests-core/agent/scripts/run-regrouping-agent.mjs
```

Run the fixer for one group:

```sh
TESTDINO_UI_CHANGE_CANDIDATES_PATH="playwright/agent/.healing/groups/<group>.json" \
  playwright/e2e-tests-core/agent/scripts/run-healer-agent.sh
```

Download artifacts for one test case (GitHub Actions; TestDino no longer returns signed blob URLs). Run from the repo checkout — `gh` uses the current `GITHUB_REPOSITORY`:

```sh
# 1) List artifacts for the CI run
gh api "repos/${GITHUB_REPOSITORY}/actions/runs/<workflowRunId>/artifacts" \
  --jq '.artifacts[] | {name, expired, size_in_bytes}'

# 2) Download the chosen name into the healing dir
mkdir -p "playwright/agent/.healing/artifacts/<testcase-id>"
gh run download <workflowRunId> \
  -n "<chosen-artifact-name>" \
  -D "playwright/agent/.healing/artifacts/<testcase-id>"
```

Then open the Playwright result folder for that test title and read `error-context.md` / `test-failed*.png`.

## Offline eval

Frozen healer cases live in `eval/`. `npm run eval --prefix playwright/e2e-tests-core/agent` replays the real fixer against every golden with intercepted TestDino/`gh`, grades decision / process / judge, and writes an HTML report under `eval/runs/`. Add `-- --case <id>` for a single case. It needs `LITELLM_API_KEY` and `LITELLM_API_URL` in `agent/.env`. See `eval/README.md`.
