# Healer offline eval

Score healer prompt/skill changes against frozen historical cases.

`npm run eval` **is** the LLM replay: it runs the real fixer against each golden with intercepted TestDino/`gh`, grades the trace deterministically, judges the applied fix, and writes a run folder with `fixer.log`, `stream.jsonl` and `report.html`. There is no LLM-free variant — `npm test` covers the corpus and the graders.

## Quick start

From `playwright/e2e-tests-core/agent`:

```sh
npm test                                       # unit tests + corpus validation
npm run eval                                   # all goldens, live fixer, judge in report mode
npm run eval -- --case infra-cfd-nav-3100      # one case
npm run eval -- --concurrency 4                # override PW_HEALER_EVAL_CONCURRENCY
npm run eval -- --judge gate                   # judge failures also fail the run
npm run eval -- --report-from eval/runs/<ts>   # re-score a cut-off run from saved logs
```

Replay needs `LITELLM_API_KEY` and `LITELLM_API_URL` in `agent/.env` (copy `.env.example`; gitignored). It does **not** need `TESTDINO_ACCESS_TOKEN`. Do **not** set `LLM_AGENT_SUPPRESS_TOOL_OUTPUT` for eval.

Claude Code must be the **native** binary, not the Windows `claude.exe` stub. After `npm ci` in `agent/`, if replay fails with that stub:

```sh
node node_modules/@anthropic-ai/claude-code/install.cjs
```

The judge POSTs Anthropic `/v1/messages` (same path as Claude Code), not OpenAI `/v1/chat/completions`.

### Model

`LITELLM_MODEL` picks the fixer model and defaults to `claude-sonnet-5`, which is what production healing uses. Not every proxy serves it — `litellmsa.deriv.ai` does, `litellm.deriv.ai` does not. List what yours has:

```sh
curl -sS "$LITELLM_API_URL/models" -H "x-api-key: $LITELLM_API_KEY" | jq -r '.data[].id'
```

If `claude-sonnet-5` is missing, set `LITELLM_MODEL` to a served model — `grok-4.6` is the usual stand-in — and the run proceeds, printing which model is standing in and recording it in `summary.json`. **A stand-in run measures that model, not production**: quote the model whenever you compare two runs, and never treat one as a production gate.

What the eval will not do is let the substitution happen silently. Asking LiteLLM for a model it does not serve gets you a complete, plausible run on some other model rather than an error — which is how one run graded `claude-sonnet-5` cases against `grok-4.6` without saying so. The replay now lists the proxy's models first and exits `2` if the requested one is absent, so the stand-in has to be chosen rather than assigned.

### Environment knobs

| Variable                          | Default                                       | Effect                                                                           |
| --------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------- |
| `LITELLM_MODEL`                   | `claude-sonnet-5`                             | Fixer model                                                                      |
| `PW_HEALER_EVAL_JUDGE_MODEL`      | `LITELLM_MODEL`                               | Judge model                                                                      |
| `PW_HEALER_EVAL_JUDGE_TIMEOUT_MS` | 4 min                                         | Judge HTTP timeout — a reasoning judge thinks for minutes before its first token |
| `PW_HEALER_EVAL_CONCURRENCY`      | `2`                                           | Cases in flight (`--concurrency` wins)                                           |
| `PW_HEALER_EVAL_TIMEOUT_MS`       | 45 min                                        | Per-case fixer timeout                                                           |
| `PW_HEALER_EVAL_SPARSE`           | `1`                                           | Sparse-checkout the worktree (`0` = full tree)                                   |
| `PW_HEALER_EVAL_SPARSE_DIRS`      | `playwright,src,docs,scripts,.github,.claude` | Sparse cone                                                                      |
| `HOME_APP_ROOT`                   | auto-detected                                 | Clone the worktree is cut from                                                   |

Sparse checkout drops `public/`, `design-system/` and other trees the fixer can never use, taking each worktree from ~44 MB to ~31 MB. Root-level files are always present (cone mode).

## Run output

Every run writes `eval/runs/<timestamp>/` (gitignored):

```text
eval/runs/<timestamp>/
|-- report.html          # collapsible per-case verdicts + event timeline
|-- summary.json
`-- cases/<id>/
    |-- fixer.log        # [→ Name {json}] lines; Read/Bash paths are complete
    |-- stream.jsonl     # raw Claude stream-json (untruncated)
    |-- got.diff
    |-- resulting-files.json   # touched + hinted files as the fixer left them
    `-- no-change.md or pr-body.md
```

Each case in `report.html` is a collapsed `<details>` block showing its decision / process / judge badges; failing cases open by default.

## Layout

```text
eval/
|-- README.md
|-- schema/case.schema.json
|-- cases/<id>/case.json
|-- cases/<id>/fixtures/          # screenshot, error-context, MCP, gh stubs
|-- lib/parse-trace.mjs           # log -> typed trace (skills/mcpTools/reads/commands/writes)
|-- lib/universal-checks.mjs      # deterministic checks, tagged decision|process
|-- lib/corpus.mjs                # case loading, fixture validation, scoreCase
|-- lib/judge-fix.mjs             # LiteLLM judge on the applied fix
|-- lib/report-html.mjs           # HTML report
|-- intercept/gh.mjs              # EVAL_CASE_DIR=... node intercept/gh.mjs <gh args>
|-- intercept/testdino.mjs        # JSON replay, no signed blob URLs
|-- intercept/testdino-mcp.mjs    # fail-closed stdio MCP wrapping testdino.mjs
|-- replay-healer-eval.mjs        # the entry point (npm run eval)
`-- test/healer-eval.test.mjs
```

## Verdicts

A case reports three verdicts instead of one bit, because "right answer" and "right method" fail independently:

| Verdict      | Fails when                                                                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **decision** | Wrong artifact, patch on a STOP case, ban-list path, missing/forbidden diff hint, secret in the artifact, fixer crash                                                    |
| **process**  | Skipped a required step: skill not loaded, `get_testcase_details` / `debug_testcase` not called, evidence not read, `gh pr list` not run, `hint_read_paths` never opened |
| **judge**    | LiteLLM review of the applied fix returns PARTIAL or FAIL                                                                                                                |

Any decision or process failure fails the case (exit 1). `--judge report` (default) prints the judge verdict without changing the exit code; `--judge gate` also fails on a non-PASS judge; `--judge off` skips it. PARTIAL is never a pass. The console and `summary.json` also print separate **decision / process / judge** rates so a process miss is visible without hiding a correct STOP.

Fixers run first (concurrent). The judge runs only after every fixer has finished, so it is not competing with a 10–20 minute fixer for the same LiteLLM proxy.

Keeping the axes apart is the point: a healer that writes the correct `no-change.md` **without** reading the screenshot is decision-pass / process-fail, and that is a prompt bug worth seeing rather than a pass to celebrate.

### Scoring is structural, not substring

`parse-trace.mjs` buckets every `[→ Name {json}]` line by Claude tool name into `skills`, `mcpTools`, `reads`, `writes`, `commands`, `searches`. Checks read those buckets, so writing "I ran debug_testcase and checked gh pr list" into `no-change.md` cannot satisfy a tool check. Reading `skills/<name>/SKILL.md` counts as loading that skill, since that is how the prompt tells the fixer to load it.

Hints are scored on code, never on prose, and the three kinds ask different questions:

- `required_diff_hints` — must appear in the lines the healer **added**. "Did it make the change?"
- `required_preserved_hints` — must still exist in the **resulting files** (everything the patch touched plus `hint_read_paths`). "Did it keep what mattered?" 3189's `toBeVisible` lives in the spec while the fix edits the page object, so it appears in no diff at all; scoring it as a diff hint was a guaranteed false fail.
- `forbidden_diff_hints` — must not appear in **added lines**, so deleting a banned construct never trips its own guard.

Resulting files are captured from the worktree before it is torn down and saved as `resulting-files.json`, so `--report-from` re-scores identically.

### Universal checks (every run)

1. Loaded `fix-testdino-test-case` and `playwright` skills _(process)_
2. `get_testcase_details` _(process)_
3. `debug_testcase` _(process)_
4. `gh api` artifacts and/or `gh run download`, not TestDino blobs as the file source _(process; blob-as-source is decision)_
5. Read `error-context` and screenshot when those fixtures exist _(process)_
6. `gh pr list` _(process)_
7. Exactly one of `no-change.md` / `pr-body.md` _(decision)_
8. Diff ban-list: no `src/`, `playwright/flows/`, `.github/`, `playwright/e2e-tests-core/` (submodule gitlink ignored), `.env*` _(decision)_
9. No Read of `playwright/.env*` _(decision)_
10. No `git add` / `git commit` _(decision)_
11. No signed `tdstorage` URLs / secrets in artifact text _(decision)_

STOP cases (`expected.artifact: no-change`) also fail if the trace contains a patch.

## Intercept vs real `src/`

`npm run eval` checks out **home-app at** `case.checkoutSha` in a **git worktree** (never your current clone). Product and Playwright files are the real tree at that SHA. Current `agent/` + `skills/` are overlaid so you eval today's prompt.

The **Playwright CLI is stubbed, not withheld**. Production healing runs `npx playwright test` against staging before it proposes anything, so a corpus that forbids the command turns every case into a "cannot verify" case and stops measuring the judgement the healer actually exercises. `.eval-bin/playwright` (and copies under the worktree `node_modules/.bin`) therefore shadows the real binary and exits 0 with a plausible pass summary — no staging is ever touched. `npx` itself is **not** shadowed: a fake `npx` that 127'd everything else made `npx tsc` look like a sandbox bug. Real `npx playwright test` still finds the shim via `node_modules/.bin/playwright`. A case may set `"cliMode": "blocked"` for a missing-browser-shaped failure (cannot-verify → STOP); no golden uses that today. Because the gate is free, writing `pr-body.md` without having run it at all is a **decision** failure. All six goldens use `cliMode: "pass"`.

| Intercept? | Surface                                                                                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Yes**    | TestDino MCP → `fixtures/mcp/*.json` (stdio MCP, fail-closed). `list_testcase` is allowed; if `mcp/list_testcase.json` is absent it wraps `get_testcase_details` so a list-then-debug healer is not fail-closed as "tool down" |
| **Yes**    | `gh api …/artifacts`, `gh run download` → copy `screenshot.png` + `error-context.md`. Other `gh api` routes fail closed                                                                                                        |
| **Yes**    | `gh pr list` / `gh pr view N` / `gh pr diff N` / `gh api .../pulls/N`                                                                                                                                                          |
| **No**     | `Read`/`Grep`/`Glob` of `src/`**, `playwright/pages/`**, `playwright/tests/**`                                                                                                                                                 |

```sh
EVAL_CASE_DIR=eval/cases/infra-cfd-nav-3100 node eval/intercept/gh.mjs run download 1 -D /tmp/out
```

### gh fixtures carry noise on purpose

`fixtures/gh/pr-list.json` holds ~14 real PRs from the window before the case's checkout — other healer PRs with different signatures, feature PRs, test PRs — so "find a duplicate" means _discriminating_, not picking the only entry. `gh pr view N` returns `pr-view-<n>.json` when present and otherwise falls back to that PR's list entry; `gh pr diff N` returns `pr-diff-<n>.diff`. Two unrelated healer PRs per case ship with a full body and diff, so a wrong duplicate-STOP is reachable and therefore testable.

**A case must not list its own source PR** unless it declares that PR in `discoverablePrs`. Otherwise the fixer can copy the answer out of `gh pr diff`, or STOP as a duplicate for a reason that did not exist at healing time — a pass for the wrong reason, which is worse than a fail.

`dup-coin-picker-3259` is the case that declares it, and must: #3009 and #3187 are closed-unmerged healer PRs carrying its failure title verbatim, so finding them and stopping _is_ the case. A unit test checks both directions — declared PRs must be present, undeclared source PRs must be absent.

The intercept also reproduces GitHub's **search semantics**, not just its shape: `--state` filters, free text matches title and body, and `path:` — a code-search qualifier that issue/PR search ignores — returns `[]`. Without that, a healer searching `path:playwright/pages/Foo.ts` gets a fixture full of rows it would never have seen in production and passes the duplicate check by accident. It was the real 30-day failure: four of the seven source PRs ran a `path:` query, all four got nothing back, and each concluded there was no prior work.

## Goldens (6)

Each case replays one closed healer PR and asserts the call a human reviewer reached at the time. `rootCause` is read out of the healer's own CI log, not inferred from the diff — the distinction that matters is _why_ it went wrong, e.g. "never opened the screenshot" versus "opened it and misread it".

| case-id                   | Source PR | Artifact    | Rule under test                                                                   | Root cause of the original run                                                                    |
| ------------------------- | --------- | ----------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `infra-cfd-nav-3100`      | #3100     | `no-change` | screenshot shows page is still loading, agent should inspect screenshots and STOP | `RC-no-screenshot` — 45 Bash, 26 Read, zero images                                                |
| `outage-coin-picker-3187` | #3187     | `no-change` | test account deposits paused—test data drift, agent should STOP                   | `RC-misclassified-testdata` — saw the rate-unavailable screen, patched anyway                     |
| `badge-polarity-3404`     | #3404     | `no-change` | never flip an assertion's polarity                                                | `RC-flow-rewrite` — downloaded artifacts, opened no image, inverted badge-present to badge-absent |
| `dup-coin-picker-3259`    | #3259     | `no-change` | duplicate closed PR-STOP and dont ship same fix                                   | `RC-no-duplicate-search` — zero `gh pr list` calls                                                |
| `scope-symbol-label-2957` | #2957     | `no-change` | mobile evidence cannot justify a desktop change                                   | `RC-no-screenshot` — collapsed the `isMobile` branch unseen and unverified                        |
| `symbol-label-3253`       | #3253     | `pr-body`   | **positive control** — ship a verified locator retarget                           | `NO-FAILURE` — byte-equivalent to merged #3278, which is its `gold.diff`                          |

Five STOPs to one fix is deliberate: the expensive mistake is a healer that patches when it should stop, and the corpus needs a case that fails if the healer over-corrects into refusing everything. #2957 and #3253 are two attempts at the _same_ DTrader mobile drift twelve days apart; #2957 is excluded from #3253's `pr-list.json` so each scores one thing.

## Prompt / skill rule coverage

Source: `agent/prompts/fix-testdino-ui-change.md` and `skills/fix-testdino-test-case/SKILL.md`.

**Covered:** infra STOP, backend-outage STOP, polarity flip, assertion widening, duplicate-closed-PR STOP, `path:`-only search, shared-POM scope, viewport branch, verified fix, artifact one-of, `get_testcase_details`, screenshot inspect, `gh pr list`.

**Not covered:** known-issue, env mismatch, flake later-pass STOP, Turnstile, open/merged Playwright PR STOP, wait band-aid / not-a-UI-change STOP, cannot-verify STOP, `.env` as a scenario (universal check only), `src/` edit trap.

Growth: when a reviewer asks "why did it …?", add a golden under `cases/` and a row here. Prefer real fixtures over live MCP.

## Building a case from a PR

`eval/tools/build-case.mjs` does the mechanical part — it finds the PR's healing job, parses the project / group / TestDino ids out of that job's log, builds `gh` fixtures with real noise PRs, ingests an MCP payload, and writes a `case.json` skeleton:

```sh
node eval/tools/build-case.mjs --pr 3259 --id dup-coin-picker-3259 \
  --discoverable 3009,3187 --mcp /tmp/testcase-details.json
```

It redacts SAS query strings, emails and tokens on the way in. `--gold-pr N` attaches the merged human fix as `gold.diff`; `--exclude N` keeps a PR out of `pr-list.json`. You still write `coversRules`, `diagnosis` and `judge` by hand — those are the judgement calls the harness cannot infer.

## Adding a case

1. Add `cases/<id>/case.json` (see `schema/case.schema.json`).
2. Copy sanitized fixtures: `error-context.md` (redact PIN/session tokens), `screenshot.png` when the grade is screenshot, `group-slice.json`, `mcp/get_testcase_details.json` + `debug_testcase.json` without signed URLs (`list_testcase.json` is optional — the intercept wraps details), `gh/pr-list.json` with noise but **without** the case's own source PR.
3. Set `checkoutSha` to the healer PR **base** SHA.
4. Set `hint_read_paths` to the files the decision depends on — it is a scored process check.
5. Optionally set `judge.outcome` / `judge.must_not`.
6. Run `npm test`, then `npm run eval -- --case <id>`.
