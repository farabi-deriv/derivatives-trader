import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { blobFromLogAndPrediction, parseVerboseLog } from "../lib/parse-trace.mjs";
import { formatToolInput } from "../../scripts/stream-healing-output.mjs";
import { runCaseChecks, runUniversalChecks } from "../lib/universal-checks.mjs";
import { handleGh, prNumberFrom } from "../intercept/gh.mjs";
import { testdinoResponse, listTestcaseFromDetails } from "../intercept/testdino.mjs";
import { listCaseDirs, loadCase, scoreCase, validateFixtures } from "../lib/corpus.mjs";

const evalRoot = fileURLToPath(new URL("..", import.meta.url));

// Live shape emitted by stream-healing-output.mjs:
//   [→ <ClaudeToolName> <JSON.stringify(input)>]
const passingLog = ({ artifact = "no-change.md", extra = "", diff = "" } = {}) =>
  [
    '[→ Skill {"skill":"fix-testdino-test-case"}]',
    '[→ Skill {"skill":"playwright"}]',
    '[→ mcp__TestDino__get_testcase_details {"id":"abc"}]',
    '[→ mcp__TestDino__debug_testcase {"id":"abc"}]',
    '[→ Bash {"command":"gh api repos/deriv-com/home-app/actions/runs/1/artifacts"}]',
    '[→ Bash {"command":"gh run download 1 -D /tmp/artifacts"}]',
    '[→ Read {"file_path":"/tmp/artifacts/error-context.md"}]',
    '[→ Read {"file_path":"/tmp/artifacts/test-failed-1.png"}]',
    '[→ Bash {"command":"gh pr list --state all --search \'CashierPage in:body,title\' --limit 30"}]',
    `[→ Write {"file_path":"playwright/agent/.healing/fix/${artifact}","content":"ok"}]`,
    extra,
    diff,
  ].join("\n");

const baseCase = (overrides = {}) => ({
  id: "synthetic",
  sourcePrs: [1],
  checkoutSha: "abc1234",
  evidenceGrade: "screenshot",
  coversRules: ["O12"],
  patch_scored: false,
  expected: { artifact: "no-change" },
  ...overrides,
});

test("parseVerboseLog buckets tool calls by type", () => {
  const trace = parseVerboseLog(passingLog());
  assert.equal(trace.artifact, "no-change");
  assert.deepEqual(trace.skills, ["fix-testdino-test-case", "playwright"]);
  assert.deepEqual(trace.mcpTools, ["get_testcase_details", "debug_testcase"]);
  assert.ok(trace.commands.some((item) => /gh run download/i.test(item)));
  assert.ok(trace.reads.some((item) => /error-context/.test(item)));
  assert.ok(trace.writes.some((item) => /no-change\.md$/.test(item)));
  assert.ok(trace.events.some((item) => item.kind === "tool_call" && /debug_testcase/.test(item.name)));
  // Raw Claude tool names stay in `tools`; typed buckets carry the semantics.
  assert.ok(trace.tools.includes("Bash"));
});

test("fixers overlap and a hung one is killed, so --concurrency is real", async () => {
  const { runFixer } = await import("../replay-healer-eval.mjs");
  const { EventEmitter } = await import("node:events");

  const started = [];
  const children = [];
  const spawnImpl = (cmd, args, opts) => {
    started.push(opts.cwd);
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => child.emit("close", null);
    children.push(child);
    return child;
  };

  // Two fixers launched back to back must both be running: under spawnSync the
  // second could not start until the first exited, which is what made
  // --concurrency 3 run the corpus one case at a time.
  const first = runFixer({ worktree: "/tmp/a", env: {}, timeoutMs: 60_000, spawnImpl });
  const second = runFixer({ worktree: "/tmp/b", env: {}, timeoutMs: 60_000, spawnImpl });
  assert.deepEqual(started, ["/tmp/a", "/tmp/b"], "second fixer must not wait for the first");

  children[0].stdout.emit("data", Buffer.from("worked"));
  children[0].emit("close", 0);
  assert.equal((await first).stdout, "worked");

  // A fixer that never exits has to be killed rather than stalling the run.
  const hung = runFixer({ worktree: "/tmp/c", env: {}, timeoutMs: 10, spawnImpl });
  const outcome = await hung;
  assert.equal(outcome.status, null);
  assert.match(outcome.error.message, /exceeded 10ms/);

  children[1].emit("close", 0);
  await second;
});

test("tool calls Claude could not parse still reach the typed buckets", () => {
  // Seen live: the model emitted two Bash calls in one payload, so Claude
  // reported __unparsedToolInput instead of a command. Both calls ran.
  const raw = JSON.stringify({
    command: "gh pr list --state all --search 'CryptoExchangePage in:body,title'",
    description: "Look for prior attempts",
  }).concat(JSON.stringify({ command: "npx playwright test crypto-exchange/deposit.spec.ts" }));
  const line = `[→ Bash ${JSON.stringify({ __unparsedToolInput: { raw, len: raw.length } })}]`;

  const trace = parseVerboseLog(line);
  assert.equal(trace.commands.length, 2);
  assert.ok(trace.commands.some((item) => /gh pr list/.test(item)), "duplicate search must not be lost");
  assert.ok(trace.commands.some((item) => /playwright test/.test(item)), "verification run must not be lost");
});

test("reading SKILL.md counts as loading that skill", () => {
  const trace = parseVerboseLog(
    '[→ Read {"file_path":"/tmp/wt/playwright/e2e-tests-core/skills/fix-testdino-test-case/SKILL.md"}]',
  );
  assert.deepEqual(trace.skills, ["fix-testdino-test-case"]);
});

test("formatToolInput keeps Read paths and clips Write content", () => {
  const longPath =
    "/private/var/folders/46/09vwhrk5657d6dh7hlxgczhm0000gn/T/healer-eval-cfd-nav-infra-3100-89024/playwright/e2e-tests-core/skills/fix-testdino-test-case/SKILL.md";
  const read = formatToolInput({ file_path: longPath });
  assert.ok(read.includes("SKILL.md"));
  assert.doesNotMatch(read, /…/);
  const write = formatToolInput({
    file_path: "playwright/agent/.healing/no-change.md",
    content: `${"x".repeat(500)}TAIL`,
  });
  assert.ok(write.includes("no-change.md"));
  assert.ok(write.includes("…"));
  assert.doesNotMatch(write, /TAIL/);
});

test("stream-healing-output emits the full Read file_path", () => {
  const streamer = fileURLToPath(new URL("../../scripts/stream-healing-output.mjs", import.meta.url));
  const longPath =
    "/private/var/folders/46/09vwhrk5657d6dh7hlxgczhm0000gn/T/healer-eval-cfd-nav-infra-3100-89024/tmp/artifacts/error-context.md";
  const event = JSON.stringify({
    type: "assistant",
    message: {
      content: [{ type: "tool_use", name: "Read", input: { file_path: longPath } }],
    },
  });
  const result = spawnSync(process.execPath, [streamer], { input: `${event}\n`, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /error-context\.md/);
  assert.doesNotMatch(result.stdout, /…/);
  const trace = parseVerboseLog(result.stdout);
  assert.ok(trace.reads.some((item) => item.endsWith("error-context.md")));
});

test("passing synthetic log clears universal checks", () => {
  const trace = blobFromLogAndPrediction(passingLog());
  const result = runUniversalChecks(trace, { hasScreenshot: true, hasErrorContext: true });
  assert.deepEqual(result.failures, []);
  assert.equal(result.ok, true);
});

test("a pr list that only used path: is scored as no search at all", () => {
  const log = passingLog().replace(
    "gh pr list --state all --search 'CashierPage in:body,title' --limit 30",
    "gh pr list --state all --search 'path:playwright/pages/CashierPage.ts'",
  );
  const result = runUniversalChecks(blobFromLogAndPrediction(log), {
    hasScreenshot: true,
    hasErrorContext: true,
  });
  assert.ok(result.failures.some((item) => /cannot return rows/.test(item)));
  assert.equal(result.processOk, false);
});

test("gh api without /artifacts is not evidence download", () => {
  const log = passingLog().replace(
    '[→ Bash {"command":"gh api repos/deriv-com/home-app/actions/runs/1/artifacts"}]\n[→ Bash {"command":"gh run download 1 -D /tmp/artifacts"}]\n',
    '[→ Bash {"command":"gh api repos/deriv-com/home-app/releases"}]\n',
  );
  const result = runUniversalChecks(blobFromLogAndPrediction(log), {
    hasScreenshot: true,
    hasErrorContext: true,
  });
  assert.ok(result.processFailures.some((item) => /gh api artifacts or gh run download/.test(item)));

  const listed = passingLog().replace(
    '[→ Bash {"command":"gh run download 1 -D /tmp/artifacts"}]\n',
    "",
  );
  assert.deepEqual(
    runUniversalChecks(blobFromLogAndPrediction(listed), {
      hasScreenshot: true,
      hasErrorContext: true,
    }).failures,
    [],
    "gh api .../artifacts alone is enough",
  );
});

test("proposing a fix without running the Playwright CLI is a decision failure", () => {
  const trace = blobFromLogAndPrediction(passingLog({ artifact: "pr-body.md" }));
  const result = runUniversalChecks(trace, { hasScreenshot: true, hasErrorContext: true });
  assert.ok(result.failures.some((item) => /without running the Playwright verification CLI/.test(item)));

  const verified = blobFromLogAndPrediction(
    passingLog({
      artifact: "pr-body.md",
      extra: '[→ Bash {"command":"npx playwright test options/verify-dtrader-redirections.spec.ts"}]',
    }),
  );
  assert.deepEqual(runUniversalChecks(verified, { hasScreenshot: true, hasErrorContext: true }).failures, []);
});

test("missing debug_testcase fails universal checks", () => {
  const log = passingLog().replace('[→ mcp__TestDino__debug_testcase {"id":"abc"}]\n', "");
  const result = runUniversalChecks(blobFromLogAndPrediction(log), {
    hasScreenshot: true,
    hasErrorContext: true,
  });
  assert.ok(result.failures.some((item) => /debug_testcase/.test(item)));
});

test("src/ diff fails the ban-list", () => {
  const diff = [
    "diff --git a/src/features/dashboard/foo.ts b/src/features/dashboard/foo.ts",
    "--- a/src/features/dashboard/foo.ts",
    "+++ b/src/features/dashboard/foo.ts",
    "@@ -1 +1 @@",
    "-old",
    "+new",
  ].join("\n");
  const result = runUniversalChecks(blobFromLogAndPrediction(passingLog({ diff })), {
    hasScreenshot: true,
    hasErrorContext: true,
  });
  assert.ok(result.failures.some((item) => /src\//.test(item)));
});

test("3189: jBox-content must be added, toBeVisible must survive in the spec", () => {
  const caseJson = baseCase({
    id: "deposit-validation-3189",
    patch_scored: true,
    expected: { artifact: "pr-body" },
    hint_read_paths: ["playwright/pages/CashierPage.ts"],
    required_diff_hints: ["jBox-content"],
    required_preserved_hints: ["toBeVisible"],
    forbidden_diff_hints: ["not.toBeValid"],
  });
  const diff = [
    "diff --git a/playwright/pages/CashierPage.ts b/playwright/pages/CashierPage.ts",
    "--- a/playwright/pages/CashierPage.ts",
    "+++ b/playwright/pages/CashierPage.ts",
    "@@ -40,7 +40,7 @@",
    "-        return this.depositIframeLocator.locator('input:invalid');",
    "+        return this.depositIframeLocator.locator('.jBox-content').filter({ hasText: /Min|Max/ });",
  ].join("\n");
  const traced = (overrides) =>
    blobFromLogAndPrediction(
      passingLog({
        artifact: "pr-body.md",
        extra: '[→ Read {"file_path":"/tmp/wt/playwright/pages/CashierPage.ts"}]',
      }),
      { id: caseJson.id, artifact: "pr-body", diff, ...overrides },
    );

  // The real failure mode: toBeVisible lives in the spec, which the patch never
  // touches, so it appears in no diff — only in the resulting file.
  const spec = { "playwright/tests/deposit.spec.ts": "await expect(error).toBeVisible();" };
  const pass = runCaseChecks(traced({ resultingFiles: spec }), caseJson);
  assert.equal(pass.ok, true, pass.failures.join("; "));

  const dropped = runCaseChecks(
    traced({ resultingFiles: { "playwright/tests/deposit.spec.ts": "await expect(error).toBeAttached();" } }),
    caseJson,
  );
  assert.ok(dropped.decisionFailures.some((item) => /dropped required assertion: toBeVisible/.test(item)));

  const trap = runCaseChecks(
    traced({ diff: `${diff}\n+        await expect(error).not.toBeValid();`, resultingFiles: spec }),
    caseJson,
  );
  assert.ok(trap.failures.some((item) => /not\.toBeValid/.test(item)));

  // Prose in pr-body.md must not stand in for the code change.
  const prose = runCaseChecks(
    traced({
      diff: "diff --git a/playwright/pages/CashierPage.ts b/playwright/pages/CashierPage.ts\n+        const x = 1;",
      artifactText: "I retargeted .jBox-content and kept toBeVisible",
      resultingFiles: spec,
    }),
    caseJson,
  );
  assert.ok(prose.decisionFailures.some((item) => /jBox-content/.test(item)));
});

test("gh intercept copies screenshot on run download", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "healer-eval-gh-"));
  const caseDir = path.join(tmp, "case");
  const dest = path.join(tmp, "out");
  fs.mkdirSync(path.join(caseDir, "fixtures", "gh"), { recursive: true });
  fs.writeFileSync(path.join(caseDir, "fixtures", "screenshot.png"), "png");
  fs.writeFileSync(path.join(caseDir, "fixtures", "error-context.md"), "ctx");
  fs.writeFileSync(
    path.join(caseDir, "fixtures", "gh", "artifacts.json"),
    JSON.stringify({ artifacts: [{ name: "playwright-test-results" }] }),
  );
  const previous = process.env.EVAL_CASE_DIR;
  process.env.EVAL_CASE_DIR = caseDir;
  try {
    handleGh(["run", "download", "1", "-D", dest]);
    assert.equal(fs.readFileSync(path.join(dest, "test-failed-1.png"), "utf8"), "png");
    assert.equal(fs.readFileSync(path.join(dest, "error-context.md"), "utf8"), "ctx");
  } finally {
    if (previous === undefined) delete process.env.EVAL_CASE_DIR;
    else process.env.EVAL_CASE_DIR = previous;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("gh intercept parses subcommands positionally and serves pr view/diff", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "healer-eval-ghpr-"));
  const ghDir = path.join(tmp, "fixtures", "gh");
  fs.mkdirSync(ghDir, { recursive: true });
  fs.writeFileSync(
    path.join(ghDir, "pr-list.json"),
    JSON.stringify([
      { number: 3405, title: "Playwright Auto Healer Fix: waitFor", state: "CLOSED" },
      { number: 3403, title: "test(portfolio): unrelated noise", state: "MERGED" },
    ]),
  );
  fs.writeFileSync(
    path.join(ghDir, "pr-view-3405.json"),
    JSON.stringify({ number: 3405, body: "## Root cause\nselector moved" }),
  );
  fs.writeFileSync(path.join(ghDir, "pr-diff-3405.diff"), "diff --git a/playwright/pages/A.ts b/playwright/pages/A.ts\n");
  const previous = process.env.EVAL_CASE_DIR;
  process.env.EVAL_CASE_DIR = tmp;
  try {
    assert.equal(prNumberFrom(["--json", "body", "3405"]), "3405");
    assert.equal(prNumberFrom(["https://github.com/deriv-com/home-app/pull/3187"]), "3187");

    const listed = JSON.parse(handleGh(["pr", "list", "--state", "all", "--limit", "30"]));
    assert.equal(listed.length, 2);
    assert.ok(listed.some((item) => item.number === 3403), "noise PR must survive");

    // Search and state behave the way GitHub does, so a case cannot pass by
    // running a query that could never have found the PR it needed.
    const byText = JSON.parse(handleGh(["pr", "list", "--state", "all", "--search", "waitFor in:body,title"]));
    assert.deepEqual(byText.map((item) => item.number), [3405]);
    const byState = JSON.parse(handleGh(["pr", "list", "--state", "merged"]));
    assert.deepEqual(byState.map((item) => item.number), [3403]);
    const byPath = JSON.parse(handleGh(["pr", "list", "--state", "all", "--search", "path:playwright/pages/A.ts"]));
    assert.deepEqual(byPath, [], "path: is code search; issue/PR search returns nothing");

    const viewed = JSON.parse(handleGh(["pr", "view", "3405", "--json", "body"]));
    assert.match(viewed.body, /selector moved/);
    // Unknown PRs fall back to their pr-list entry rather than inventing data.
    assert.equal(JSON.parse(handleGh(["pr", "view", "3403"])).title, "test(portfolio): unrelated noise");
    assert.match(JSON.parse(handleGh(["pr", "view", "9999"])).error, /no pull request/);

    assert.match(handleGh(["pr", "diff", "3405"]), /^diff --git/);
    assert.match(JSON.parse(handleGh(["api", "repos/deriv-com/home-app/pulls/3405"])).body, /selector moved/);
    assert.throws(() => handleGh(["issue", "list"]), /unhandled gh command/);
    assert.throws(
      () => handleGh(["api", "repos/deriv-com/home-app/issues"]),
      /unhandled gh api route/,
    );
  } finally {
    if (previous === undefined) delete process.env.EVAL_CASE_DIR;
    else process.env.EVAL_CASE_DIR = previous;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("testdino intercept reads frozen MCP JSON", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "healer-eval-td-"));
  fs.mkdirSync(path.join(tmp, "fixtures", "mcp"), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, "fixtures", "mcp", "get_testcase_details.json"),
    JSON.stringify({ id: "abc", title: "frozen" }),
  );
  const response = testdinoResponse(tmp, "get_testcase_details");
  assert.equal(response.title, "frozen");
  const listed = testdinoResponse(tmp, "list_testcase");
  assert.equal(listed.items[0].title, "frozen");
  assert.deepEqual(listTestcaseFromDetails({ id: "x" }), { items: [{ id: "x" }] });
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("corpus fixtures validate and a passing log scores infra-cfd-nav-3100", () => {
  const casesRoot = path.join(evalRoot, "cases");
  if (!fs.existsSync(casesRoot) || fs.readdirSync(casesRoot).length === 0) {
    assert.fail("eval cases are missing; seed the corpus first");
  }
  for (const dir of listCaseDirs()) {
    assert.deepEqual(validateFixtures(loadCase(dir)), [], `invalid fixtures in ${dir}`);
  }

  const loaded = loadCase(path.join(casesRoot, "infra-cfd-nav-3100"));
  const hinted = (loaded.json.hint_read_paths || [])
    .map((item) => `[→ Read {"file_path":"/tmp/wt/${item}"}]`)
    .join("\n");
  const scored = scoreCase(loaded, blobFromLogAndPrediction(passingLog({ extra: hinted })));
  assert.equal(scored.ok, true, scored.failures.join("; "));
  assert.equal(scored.decisionOk, true);
  assert.equal(scored.processOk, true);
});

test("every case is anchored in a real run: real ids, its own evidence, agreeing error text", () => {
  const seenEvidence = new Map();
  for (const dir of listCaseDirs()) {
    const id = path.basename(dir);
    const caseJson = JSON.parse(fs.readFileSync(dir + "/case.json", "utf8"));
    const fixtures = path.join(dir, "fixtures");
    const slice = JSON.parse(fs.readFileSync(path.join(fixtures, "group-slice.json"), "utf8"));

    // v1 shipped ids like `test_run_eval_3100` / `eval-cfd-nav-infra-3100`, which
    // look plausible in a fixture and correspond to nothing that ever ran.
    assert.match(slice.id, /^ui-change-[0-9a-f]{12}$/, `${id}: group id is not a real healing group id`);
    for (const candidate of slice.candidates) {
      assert.match(candidate.run.id, /^test_run_[0-9a-f]{24}$/, `${id}: synthetic TestDino run id`);
      assert.match(candidate.testCase.id, /^[0-9a-f]{20}-[0-9a-f]{20}$/, `${id}: synthetic TestDino case id`);
    }

    // Three cases once shared one screenshot, so each was really grading the
    // same evidence under three different expectations.
    for (const name of ["screenshot.png", "error-context.md"]) {
      const file = path.join(fixtures, name);
      if (!fs.existsSync(file)) continue;
      const digest = createHash("sha256").update(fs.readFileSync(file)).digest("hex");
      const owner = seenEvidence.get(digest);
      assert.ok(!owner, `${id} reuses ${name} from ${owner}`);
      seenEvidence.set(digest, id);
    }

    // error.txt is what the fixer reads first; if it disagrees with the group
    // slice the case is testing a failure that never happened.
    const errorText = fs.readFileSync(path.join(fixtures, "error.txt"), "utf8");
    const claimed = slice.candidates[0].error.replace(/\\"/g, '"');
    assert.ok(
      errorText.includes(claimed.slice(0, 60)),
      `${id}: error.txt does not carry the group slice's error (${claimed.slice(0, 60)})`,
    );

    if (caseJson.patch_scored) {
      assert.ok(
        fs.existsSync(path.join(fixtures, "gold.diff")),
        `${id}: patch_scored needs a gold.diff to compare intent against`,
      );
    }

    // The intercept is fail-closed, so a fixture the checks require but the case
    // does not ship reads as "the tool is down" and the fixer STOPs on that
    // instead of on the evidence — a decision-pass for entirely the wrong reason.
    for (const tool of ["get_testcase_details", "debug_testcase"]) {
      assert.ok(
        fs.existsSync(path.join(fixtures, "mcp", `${tool}.json`)),
        `${id}: universal checks require ${tool}, so the case must ship mcp/${tool}.json`,
      );
    }

    assert.ok(caseJson.diagnosis, `${id}: needs a diagnosis of why its source PR was closed`);
    assert.notEqual(caseJson.diagnosis.rootCause, "TODO", `${id}: diagnosis left as TODO`);
  }
});

test("gh pr list exposes a source PR only when the case declares it discoverable", () => {
  for (const dir of listCaseDirs()) {
    const id = path.basename(dir);
    const caseJson = JSON.parse(fs.readFileSync(path.join(dir, "case.json"), "utf8"));
    const listPath = path.join(dir, "fixtures", "gh", "pr-list.json");
    if (!fs.existsSync(listPath)) continue;
    const listed = JSON.parse(fs.readFileSync(listPath, "utf8")).map((item) => item.number);
    const discoverable = new Set(caseJson.discoverablePrs || []);

    for (const source of caseJson.sourcePrs) {
      if (discoverable.has(source)) {
        assert.ok(listed.includes(source), `${id} declares PR ${source} discoverable but does not list it`);
      } else {
        assert.ok(
          !listed.includes(source),
          `${id} lists its own PR ${source} — the fixer can copy the answer, or STOP as a duplicate for a reason that did not exist at healing time. Add it to discoverablePrs if finding it IS the case.`,
        );
      }
    }
    assert.ok(listed.length >= 5, `${id} needs unrelated PRs as noise`);
  }
});

test("checks split decision failures from process failures", () => {
  const missingSkill = passingLog().replace('[→ Skill {"skill":"playwright"}]\n', "");
  const process = runUniversalChecks(blobFromLogAndPrediction(missingSkill), {
    hasScreenshot: true,
    hasErrorContext: true,
  });
  assert.equal(process.decisionOk, true);
  assert.equal(process.processOk, false);
  assert.ok(process.processFailures.some((item) => /playwright skill/.test(item)));

  const decision = runUniversalChecks(
    blobFromLogAndPrediction(passingLog({ diff: "diff --git a/src/x.ts b/src/x.ts" })),
    { hasScreenshot: true, hasErrorContext: true },
  );
  assert.equal(decision.decisionOk, false);
  assert.ok(decision.decisionFailures.some((item) => /src\//.test(item)));
});

test("hint_read_paths is scored as a process check", () => {
  const caseJson = baseCase({ hint_read_paths: ["playwright/pages/CashierPage.ts"] });
  const missed = runCaseChecks(blobFromLogAndPrediction(passingLog()), caseJson);
  assert.ok(missed.processFailures.some((item) => /CashierPage\.ts/.test(item)));
  assert.equal(missed.decisionOk, true);

  const opened = runCaseChecks(
    blobFromLogAndPrediction(
      passingLog({ extra: '[→ Read {"file_path":"/tmp/wt/playwright/pages/CashierPage.ts"}]' }),
    ),
    caseJson,
  );
  assert.equal(opened.ok, true, opened.failures.join("; "));
});

test("collectResultingFiles and build-case --id stay inside their roots", async () => {
  const { resolveInside } = await import("../lib/paths.mjs");
  const { collectResultingFiles } = await import("../replay-healer-eval.mjs");
  const { resolveCaseDir } = await import("../tools/build-case.mjs");

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "healer-eval-paths-"));
  const worktree = path.join(tmp, "wt");
  const outside = path.join(tmp, "secret.txt");
  const insideRel = path.join("playwright", "pages", "CashierPage.ts");
  fs.mkdirSync(path.join(worktree, "playwright", "pages"), { recursive: true });
  fs.writeFileSync(path.join(worktree, insideRel), "inside");
  fs.writeFileSync(outside, "leaked");

  assert.equal(resolveInside(worktree, insideRel), path.join(worktree, insideRel));
  assert.equal(resolveInside(worktree, path.join("..", "secret.txt")), null);
  assert.equal(resolveInside(worktree, outside), null);

  const files = collectResultingFiles(
    worktree,
    { hint_read_paths: [insideRel, path.join("..", "secret.txt"), outside] },
    "",
  );
  assert.deepEqual(Object.keys(files), [insideRel]);
  assert.equal(files[insideRel], "inside");

  const casesRoot = path.join(tmp, "cases");
  fs.mkdirSync(casesRoot, { recursive: true });
  assert.equal(resolveCaseDir("dup-coin-picker-3259", casesRoot), path.join(casesRoot, "dup-coin-picker-3259"));
  assert.throws(() => resolveCaseDir("../outside", casesRoot), /must resolve under cases/);
  assert.throws(() => resolveCaseDir(outside, casesRoot), /must resolve under cases/);
  assert.throws(() => resolveCaseDir(".", casesRoot), /must resolve under cases/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("artifact prose cannot satisfy a tool check", () => {
  const log = passingLog()
    .replace('[→ mcp__TestDino__debug_testcase {"id":"abc"}]\n', "")
    .concat('\n[→ Write {"file_path":"playwright/agent/.healing/no-change.md","content":"I ran debug_testcase and gh pr list"}]');
  const result = runUniversalChecks(blobFromLogAndPrediction(log), {
    hasScreenshot: true,
    hasErrorContext: true,
  });
  assert.ok(result.processFailures.some((item) => /debug_testcase/.test(item)));
});

test("testdino MCP unknown tool is fail-closed; known tool returns fixture JSON", async () => {
  const { handleMcpMessage } = await import("../intercept/testdino-mcp.mjs");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "healer-eval-mcp-"));
  fs.mkdirSync(path.join(tmp, "fixtures", "mcp"), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, "fixtures", "mcp", "debug_testcase.json"),
    JSON.stringify({ id: "frozen-debug" }),
  );
  const unknown = handleMcpMessage(
    { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "delete_everything" } },
    { caseDir: tmp },
  );
  assert.equal(unknown.result.isError, true);
  assert.match(unknown.result.content[0].text, /unknown TestDino tool/);

  const ok = handleMcpMessage(
    { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "debug_testcase" } },
    { caseDir: tmp },
  );
  assert.equal(ok.result.isError, undefined);
  assert.match(ok.result.content[0].text, /frozen-debug/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("judge packet omits verbose log and redacts secrets; PARTIAL is not a pass", async () => {
  const { buildJudgePacket, parseJudgeResponse, judgeFix, judgeText, messagesUrl, summarizeHttpError } =
    await import("../lib/judge-fix.mjs");
  const packet = buildJudgePacket(
    {
      id: "deposit-validation-3189",
      expected: { artifact: "pr-body" },
      notes: "keep toBeVisible",
      coversRules: ["S16"],
      forbidden_diff_hints: ["not.toBeValid"],
      judge: { outcome: "retarget jBox", must_not: ["HTML5 validity"] },
    },
    {
      artifact: "pr-body",
      diff: "tdstorage.blob.core.windows.net/x?sig=abc sk-secretkey",
      artifactText: "verbose thought dump should not be required",
    },
    "gold jBox-content",
  );
  const serialized = JSON.stringify(packet);
  assert.doesNotMatch(serialized, /sig=abc/);
  assert.doesNotMatch(serialized, /sk-secretkey/);
  assert.equal(packet.expected.artifact, "pr-body");
  assert.ok(packet.expected.must_not.includes("not.toBeValid"));

  const partial = parseJudgeResponse(
    '```json\n{"pass":true,"label":"PARTIAL","reason":"close","violations":[]}\n```',
  );
  assert.equal(partial.label, "PARTIAL");
  assert.equal(partial.pass, false);

  let postedUrl;
  let posted;
  const fetchImpl = async (url, opts) => {
    postedUrl = url;
    posted = JSON.parse(opts.body);
    return {
      ok: true,
      json: async () => ({
        content: [{ text: '{"pass":true,"label":"PASS","reason":"matches gold","violations":[]}' }],
      }),
    };
  };
  assert.equal(messagesUrl("https://litellm.example/v1"), "https://litellm.example/v1/messages");
  assert.match(
    summarizeHttpError(403, "<html>Cloudflare Access</html>"),
    /Cloudflare Access/,
  );
  assert.equal(summarizeHttpError(500, "<html>nope</html>"), "judge HTTP 500: HTML error page");
  const judged = await judgeFix(packet, {
    env: { LITELLM_API_KEY: "k", LITELLM_API_URL: "https://litellm.example/v1" },
    fetchImpl,
  });
  assert.equal(judged.pass, true);
  assert.equal(postedUrl, "https://litellm.example/v1/messages");
  assert.equal(posted.temperature, 0);
  assert.equal(posted.model, "claude-sonnet-5");
  assert.equal(posted.messages[0].role, "user");
  assert.ok(posted.system);

  // grok-4.6 answers with its scratchpad first, so reading content[0] graded the
  // reasoning and reported "no JSON" while the real verdict sat one block later.
  const reasoned = judgeText({
    content: [
      { type: "thinking", text: "The healer stopped. Was that right? Let me weigh {a} against {b}." },
      { type: "text", text: '{"pass":false,"label":"FAIL","reason":"weakened","violations":["x"]}' },
    ],
  });
  assert.equal(parseJudgeResponse(reasoned).reason, "weakened");
  assert.equal(judgeText({ choices: [{ message: { content: "{}" } }] }), "{}", "OpenAI shape still works");
});

test("replay report mode does not fail exit when only the judge fails", async () => {
  const { replayExitCode, writeCandidatesFile, parseReplayArgs, resolveConcurrency, mapWithConcurrency, readSavedCaseOutcome, EVAL_ALLOWED_TOOLS, listServedModels, SPARSE_DIRS, resolveSparseDirs, writeGhShim, writePlaywrightShim, overlayCurrentHealer, parseDotEnv, applyDotEnvFile, claudeCliProblem, axisRates, judgeReplayRows } =
    await import("../replay-healer-eval.mjs");
  assert.deepEqual(resolveSparseDirs({}), SPARSE_DIRS);
  assert.equal(resolveSparseDirs({ PW_HEALER_EVAL_SPARSE: "0" }), null);
  assert.deepEqual(resolveSparseDirs({ PW_HEALER_EVAL_SPARSE_DIRS: "playwright, src" }), ["playwright", "src"]);
  assert.ok(SPARSE_DIRS.includes("playwright"));
  assert.ok(!SPARSE_DIRS.includes("public"));
  assert.equal(parseReplayArgs([]).judge, "report");
  assert.equal(parseReplayArgs([]).concurrency, "");
  assert.equal(parseReplayArgs(["--report-from", "eval/runs/x"]).reportFrom, "eval/runs/x");
  assert.equal(parseReplayArgs(["--concurrency", "3"]).concurrency, "3");
  assert.equal(resolveConcurrency("", {}), 2);
  assert.equal(resolveConcurrency("", { PW_HEALER_EVAL_CONCURRENCY: "4" }), 4);
  assert.equal(resolveConcurrency("1", { PW_HEALER_EVAL_CONCURRENCY: "4" }), 1);
  const ordered = await mapWithConcurrency(["a", "b", "c"], 2, async (item, index) => {
    await new Promise((resolve) => setTimeout(resolve, (2 - index) * 10));
    return `${index}:${item}`;
  });
  assert.deepEqual(ordered, ["0:a", "1:b", "2:c"]);
  assert.deepEqual(parseDotEnv("LITELLM_API_KEY=from-file\nexport LITELLM_API_URL=https://example\n# skip\n"), {
    LITELLM_API_KEY: "from-file",
    LITELLM_API_URL: "https://example",
  });
  const envCopy = { LITELLM_API_KEY: "shell" };
  const tmpEnv = path.join(os.tmpdir(), `healer-eval-dotenv-${process.pid}.env`);
  fs.writeFileSync(tmpEnv, "LITELLM_API_KEY=file\nLITELLM_API_URL=https://from-file\n");
  applyDotEnvFile(tmpEnv, envCopy);
  assert.equal(envCopy.LITELLM_API_KEY, "shell");
  assert.equal(envCopy.LITELLM_API_URL, "https://from-file");
  fs.unlinkSync(tmpEnv);
  assert.deepEqual(axisRates([{ decisionOk: true, processOk: false, judge: { pass: true } }]), {
    decision: "1/1",
    process: "0/1",
    judge: "1/1",
  });
  const judged = await judgeReplayRows(
    [{ id: "x", judge: null, logText: null }],
    new Map(),
    { judgeMode: "off" },
  );
  assert.equal(judged[0].judge, null);
  assert.equal(replayExitCode([{ ok: true, judge: { pass: false, label: "FAIL", reason: "nope" } }], "report"), 0);
  assert.equal(replayExitCode([{ ok: true, judge: { pass: false, label: "FAIL", reason: "nope" } }], "gate"), 1);
  assert.equal(replayExitCode([{ ok: false, failures: ["trace"] }], "report"), 1);
  // The Playwright CLI is allowed and stubbed rather than withheld: production
  // healing runs it, so withholding it made every case a `cannot verify` case.
  assert.match(EVAL_ALLOWED_TOOLS, /Bash\(npx playwright test:\*\)/);

  // A proxy that does not serve the requested model routes to another one and
  // returns a full, plausible, wrong run — so the model list is a preflight.
  const servedFetch = async () => ({ ok: true, json: async () => ({ data: [{ id: "grok-4.6" }, { id: "auto" }] }) });
  assert.deepEqual(await listServedModels("https://proxy/v1", "k", servedFetch), ["grok-4.6", "auto"]);
  assert.deepEqual(await listServedModels("", "k", servedFetch), [], "no URL means no preflight, not a failure");
  const brokenFetch = async () => {
    throw new Error("offline");
  };
  assert.deepEqual(await listServedModels("https://proxy/v1", "k", brokenFetch), [], "an unreachable proxy must not block");
  const salvageTmp = fs.mkdtempSync(path.join(os.tmpdir(), "healer-eval-salvage-"));
  fs.mkdirSync(path.join(salvageTmp, "cases", "x"), { recursive: true });
  fs.writeFileSync(path.join(salvageTmp, "cases", "x", "stream.jsonl"), "{}\n");
  assert.equal(readSavedCaseOutcome(path.join(salvageTmp, "cases", "x")).complete, false);
  fs.writeFileSync(path.join(salvageTmp, "cases", "x", "fixer.log"), "[→ Skill {\"skill\":\"playwright\"}]\n");
  fs.writeFileSync(path.join(salvageTmp, "cases", "x", "no-change.md"), "stop");
  fs.writeFileSync(
    path.join(salvageTmp, "cases", "x", "resulting-files.json"),
    JSON.stringify({ "playwright/tests/a.spec.ts": "toBeVisible" }),
  );
  const saved = readSavedCaseOutcome(path.join(salvageTmp, "cases", "x"));
  assert.equal(saved.complete, true);
  assert.equal(saved.artifact, "no-change");
  assert.match(saved.resultingFiles["playwright/tests/a.spec.ts"], /toBeVisible/);
  fs.rmSync(salvageTmp, { recursive: true, force: true });

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "healer-eval-cand-"));
  const slice = path.join(tmp, "group-slice.json");
  const dest = path.join(tmp, "out", "ui-change-candidates.json");
  fs.writeFileSync(slice, JSON.stringify({ id: "x", candidates: [{ testCase: { id: "1" } }] }));
  writeCandidatesFile(slice, dest);
  const written = JSON.parse(fs.readFileSync(dest, "utf8"));
  assert.equal(written.count, 1);

  const binDir = path.join(tmp, "bin");
  const intercept = path.join(evalRoot, "intercept/gh.mjs");
  writeGhShim(binDir, intercept);
  assert.equal(fs.statSync(path.join(binDir, "gh")).mode & 0o111, 0o111);
  writePlaywrightShim(binDir, tmp, "pass");
  assert.equal(fs.existsSync(path.join(binDir, "playwright")), true);
  assert.equal(fs.existsSync(path.join(binDir, "npx")), false, "npx must not be shadowed");
  assert.equal(fs.existsSync(path.join(tmp, "node_modules/.bin/playwright")), true);

  const sourceCore = path.join(tmp, "src-core");
  const destCore = path.join(tmp, "dest-core");
  fs.mkdirSync(path.join(sourceCore, "agent", "prompts"), { recursive: true });
  fs.mkdirSync(path.join(sourceCore, "agent", "eval", "cases", "skip-me"), { recursive: true });
  fs.mkdirSync(path.join(sourceCore, "skills", "fix-testdino-test-case"), { recursive: true });
  fs.writeFileSync(path.join(sourceCore, "agent", "prompts", "fix.md"), "prompt");
  fs.writeFileSync(path.join(sourceCore, "agent", ".env"), "LITELLM_API_KEY=secret");
  fs.writeFileSync(path.join(sourceCore, "agent", "eval", "cases", "skip-me", "case.json"), "{}");
  fs.writeFileSync(path.join(sourceCore, "skills", "fix-testdino-test-case", "SKILL.md"), "skill");
  overlayCurrentHealer(sourceCore, destCore);
  assert.equal(fs.readFileSync(path.join(destCore, "agent", "prompts", "fix.md"), "utf8"), "prompt");
  assert.equal(fs.existsSync(path.join(destCore, "agent", ".env")), false);
  assert.equal(fs.existsSync(path.join(destCore, "agent", "eval")), false, "entire eval/ must be skipped");
  assert.equal(fs.readFileSync(path.join(destCore, "skills", "fix-testdino-test-case", "SKILL.md"), "utf8"), "skill");
  assert.match(claudeCliProblem(path.join(tmp, "missing-agent")), /Missing Claude CLI/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("HTML report escapes dynamic content and writes fixer.log", async () => {
  const { renderHtmlReport, writeCaseRunFiles, writeRunReport, createRunDir, assertionRows } =
    await import("../lib/report-html.mjs");
  const html = renderHtmlReport({
    rows: [
      {
        id: "cfd-nav-infra-3100",
        ok: false,
        expected: "no-change",
        artifact: "no-change",
        failures: ["did not call debug_testcase"],
        judge: { pass: true, label: "PASS", reason: "ok" },
        events: [
          {
            kind: "tool_call",
            name: "Read",
            text: '{"file_path":"/tmp/worktree/playwright/agent/.healing/error-context.md"}',
          },
          { kind: "tool_call", name: "lookup", text: "<script>alert(1)</script>" },
        ],
        artifactText: "STOP <b>infra</b>",
        durationMs: 12,
        fixerStatus: 0,
        hasScreenshot: true,
        hasErrorContext: true,
        logRelPath: "cases/cfd-nav-infra-3100/fixer.log",
      },
    ],
    gatePassed: false,
  });
  assert.match(html, /Event timeline/);
  assert.match(html, /Tool call · Read — \/tmp\/worktree\/playwright\/agent\/\.healing\/error-context\.md/);
  assert.match(html, /Tool call · lookup/);
  assert.match(html, /&lt;script&gt;alert/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /Content-Security-Policy/);
  assert.ok(assertionRows({ failures: ["did not call debug_testcase"], hasScreenshot: true, hasErrorContext: true }).some((row) => row.name === "debug_testcase" && !row.pass));

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "healer-eval-report-"));
  const runDir = path.join(tmp, "run");
  fs.mkdirSync(runDir, { recursive: true });
  const logText = '[→ Skill {"skill":"playwright"}]\n';
  const rel = writeCaseRunFiles(runDir, "cfd-nav-infra-3100", { logText });
  assert.equal(rel, "cases/cfd-nav-infra-3100/fixer.log");
  assert.equal(fs.readFileSync(path.join(runDir, rel), "utf8"), logText);
  const htmlPath = writeRunReport(runDir, { rows: [{ id: "cfd-nav-infra-3100", ok: true, failures: [] }], gatePassed: true });
  assert.equal(path.basename(htmlPath), "report.html");
  assert.match(createRunDir(tmp), /runs/);
  fs.rmSync(tmp, { recursive: true, force: true });
});
