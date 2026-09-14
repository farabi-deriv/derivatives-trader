import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const writeOutcomeScript = fileURLToPath(new URL("../scripts/write-healing-outcome.mjs", import.meta.url));
const buildSummaryScript = fileURLToPath(new URL("../scripts/build-healing-summary.mjs", import.meta.url));
const postSummaryScript = fileURLToPath(new URL("../scripts/post-summary-and-teardown.mjs", import.meta.url));

const makeWorkspace = (t) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "healing-outcome-test-"));
  fs.mkdirSync(path.join(workspace, "playwright/agent/.healing/fix"), { recursive: true });
  fs.writeFileSync(
    path.join(workspace, "candidates.json"),
    JSON.stringify({
      candidates: [
        {
          testCase: {
            title: "cashier shows deposit method",
            url: "https://app.testdino.com/testcase/123",
          },
          spec: {
            filePath: "playwright/tests/cashier.spec.ts",
          },
        },
      ],
    }, null, 2),
  );
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  return workspace;
};

const writePrBody = (workspace) => {
  fs.writeFileSync(
    path.join(workspace, "playwright/agent/.healing/fix/pr-body.md"),
    [
      "## Failing test case(s)",
      "",
      "TestDino testcase link.",
      "",
      "## What is failing",
      "",
      "The cashier test still expects the old Deposit label at `CashierPage.ts:42`.",
      "",
      "## Evidence",
      "",
      "Current `src/` renamed the CTA; Playwright CLI sample verify passed.",
      "",
      "## What this fixes",
      "",
      "Updates the locator to the released CTA text.",
      "",
      "## Changes",
      "",
      "- Updated cashier locator.",
      "",
    ].join("\n"),
  );
};

const writeNoChange = (workspace) => {
  fs.writeFileSync(
    path.join(workspace, "playwright/agent/.healing/fix/no-change.md"),
    "Phase 2: failure is transient. No Playwright change.\n",
  );
};

const runWriteOutcome = (workspace, env) => {
  const result = spawnSync(process.execPath, [writeOutcomeScript], {
    cwd: workspace,
    env: {
      ...process.env,
      SLACK_BOT_TOKEN: "",
      GROUP_ID: "group-1",
      CANDIDATE_FILE: path.join(workspace, "candidates.json"),
      PR_TITLE: "Playwright Auto Healer Fix: cashier",
      HAS_CHANGES: "true",
      EVENT_NAME: "schedule",
      JOB_STATUS: "success",
      ...env,
    },
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  return {
    outcome: JSON.parse(fs.readFileSync(path.join(workspace, "playwright/agent/.healing/outcomes/group-1.json"), "utf8")),
    markdown: fs.readFileSync(path.join(workspace, "playwright/agent/.healing/outcomes/group-1.md"), "utf8"),
  };
};

test("eligible changes with PR URL are recorded as pr_created", (t) => {
  const workspace = makeWorkspace(t);
  writePrBody(workspace);

  const { outcome, markdown } = runWriteOutcome(workspace, {
    PR_BODY_PRESENT: "true",
    PLAYWRIGHT_PR_ELIGIBLE: "true",
    PR_URL: "https://github.com/deriv-com/home-app/pull/1234",
  });

  assert.equal(outcome.reason, "pr_created");
  assert.equal(outcome.detailSource, "pr-body.md");
  assert.match(markdown, /old Deposit label/);
});

test("write outcome packs a per-group publish folder", (t) => {
  const workspace = makeWorkspace(t);
  writePrBody(workspace);
  fs.writeFileSync(path.join(workspace, "playwright/agent/.healing/fix/staged.patch"), "diff --git a/x b/x\n");
  fs.writeFileSync(
    path.join(workspace, "playwright/agent/.healing/pr-body.md"),
    "## Links\n\n- Healer job (this group): https://github.com/deriv-com/home-app/actions/runs/1/job/2\n",
  );

  runWriteOutcome(workspace, {
    PR_BODY_PRESENT: "true",
    PLAYWRIGHT_PR_ELIGIBLE: "true",
    PR_URL: "https://github.com/deriv-com/home-app/pull/1234",
  });

  const publishDir = path.join(workspace, "playwright/agent/.healing/publish/group-1");
  assert.equal(
    fs.readFileSync(path.join(publishDir, "pr-body.md"), "utf8"),
    fs.readFileSync(path.join(workspace, "playwright/agent/.healing/pr-body.md"), "utf8"),
  );
  assert.ok(fs.existsSync(path.join(publishDir, "candidates.json")));
  assert.ok(fs.existsSync(path.join(publishDir, "staged.patch")));
  const packed = JSON.parse(fs.readFileSync(path.join(publishDir, "outcome.json"), "utf8"));
  assert.equal(packed.reason, "pr_created");
  assert.equal(packed.prUrl, "https://github.com/deriv-com/home-app/pull/1234");
});

test("changes without pr-body are missing_pr_body", (t) => {
  const workspace = makeWorkspace(t);
  writeNoChange(workspace);

  const { outcome, markdown } = runWriteOutcome(workspace, {
    PR_BODY_PRESENT: "false",
    PLAYWRIGHT_PR_ELIGIBLE: "false",
  });

  assert.equal(outcome.reason, "missing_pr_body");
  assert.equal(outcome.detailSource, "no-change.md");
  assert.match(markdown, /transient/);
});

test("no-change without code changes uses no_changes reason", (t) => {
  const workspace = makeWorkspace(t);
  writeNoChange(workspace);

  const { outcome } = runWriteOutcome(workspace, {
    HAS_CHANGES: "false",
    PR_BODY_PRESENT: "false",
    PLAYWRIGHT_PR_ELIGIBLE: "false",
  });

  assert.equal(outcome.reason, "no_changes");
  assert.equal(outcome.detailSource, "no-change.md");
});

test("PR Slack reply links only the PR label", () => {
  const script = fs.readFileSync(writeOutcomeScript, "utf8");

  assert.match(script, /`<\$\{prUrl\}\|PR> - \$\{prSlackText\(\)\}`/);
  assert.doesNotMatch(script, /PR ->/);
  assert.doesNotMatch(script, /triage\.md/);
});

test("summary Slack readiness is true only when a PR was created", (t) => {
  const workspace = makeWorkspace(t);
  const githubOutputPath = path.join(workspace, "github-output.txt");
  const publishDir = path.join(workspace, "playwright/agent/.healing/publish/group-1");
  fs.mkdirSync(publishDir, { recursive: true });
  fs.writeFileSync(
    path.join(publishDir, "outcome.json"),
    JSON.stringify({
      groupId: "group-1",
      hasChanges: true,
      reason: "pr_created",
      prCreated: true,
      prUrl: "https://github.com/deriv-com/home-app/pull/1234",
      jobStatus: "success",
    }, null, 2),
  );

  const result = spawnSync(process.execPath, [buildSummaryScript], {
    cwd: workspace,
    env: {
      ...process.env,
      GROUP_COUNT: "1",
      MATRIX_JSON: JSON.stringify({
        include: [
          {
            group_id: "group-1",
            title_suffix: "cashier",
            candidate_count: 1,
            candidate_file: "candidates.json",
          },
        ],
      }),
      RUN_URL: "https://github.com/deriv-com/home-app/actions/runs/1",
      REPO: "deriv-com/home-app",
      EVENT_NAME: "schedule",
      GITHUB_OUTPUT: githubOutputPath,
    },
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const githubOutput = fs.readFileSync(githubOutputPath, "utf8");
  assert.match(githubOutput, /slack_ready<<[^]+?\ntrue\n/);
});

test("post summary appends Slack summary thread permalink to GitHub summary", () => {
  const script = fs.readFileSync(postSummaryScript, "utf8");
  const slackUtils = fs.readFileSync(fileURLToPath(new URL("../scripts/slack-utils.mjs", import.meta.url)), "utf8");

  assert.match(script, /getSlackPermalink/);
  assert.match(script, /safeSlackPermalink/);
  assert.match(script, /url\.protocol !== "https:"/);
  assert.match(script, /hostname\.endsWith\("\.slack\.com"\)/);
  assert.match(script, /\[Slack summary thread\]/);
  assert.match(script, /not a safe Slack HTTPS URL/);
  assert.doesNotMatch(script, /SLACK_TRIAGE_MESSAGE_PATH/);
  assert.doesNotMatch(script, /Posted Slack triage reply/);
  assert.match(slackUtils, /const slackApiRequest/);
  assert.match(slackUtils, /SLACK_REQUEST_TIMEOUT_MS/);
});

test("teardown deletes only underscore-prefixed group internals", () => {
  const script = fs.readFileSync(postSummaryScript, "utf8");
  assert.match(script, /startsWith\("_playwright-healing-group"\)/);
  assert.match(script, /teardownArtifacts/);
  assert.match(script, /await teardownArtifacts\(\)/);

  const shouldDelete = (name) => String(name).startsWith("_playwright-healing-group");
  assert.equal(shouldDelete("_playwright-healing-groups"), true);
  assert.equal(shouldDelete("_playwright-healing-group-ui-change-1"), true);
  assert.equal(shouldDelete("playwright-healing-groups"), false);
  assert.equal(shouldDelete("playwright-healing-summary"), false);
  assert.equal(shouldDelete("playwright-healing-actionable-no-change"), false);
});
