import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const findChangesScript = fileURLToPath(new URL("../scripts/find-testdino-ui-changes.mjs", import.meta.url));

const runFind = (env) =>
  spawnSync(process.execPath, [findChangesScript], {
    env: { ...process.env, ...env },
    encoding: "utf8",
  });

test("Slack thread metadata lookup checks summary before TestDino artifact labels", () => {
  const script = fs.readFileSync(findChangesScript, "utf8");

  assert.match(script, /const candidateSlackArtifactLabels = \(candidate\) => \{/);
  assert.match(script, /candidate\?\.run\?\.platform/);
  assert.match(script, /\.\.\.\(Array\.isArray\(candidate\?\.run\?\.tags\)/);
  assert.match(script, /addLabel\("summary"\);/);
  assert.ok(script.indexOf('addLabel("summary");') < script.indexOf("for (const value of values)"));
  assert.match(script, /const artifactNames = new Set\(artifactLabels\.map\(\(label\) => `\$\{SLACK_THREAD_ARTIFACT_PREFIX\}\$\{label\}`\)\);/);
  assert.match(script, /artifactNames\.has\(candidateArtifact\.name\)/);
  assert.doesNotMatch(script, /candidateArtifact\.name === `\$\{SLACK_THREAD_ARTIFACT_PREFIX\}\$\{platform\}`/);
});

test("candidate URLs are built from org, project, run id, and case id", () => {
  const script = fs.readFileSync(findChangesScript, "utf8");

  assert.match(script, /const constructedRunUiUrl = \(runId\) => \{/);
  assert.match(script, /const constructedCaseUiUrl = \(runId, caseId\) => \{/);
  assert.match(script, /\$\{TESTDINO_APP_BASE_URL\}\/\$\{testdinoOrgId\}\/projects\/\$\{TESTDINO_PROJECT_ID\}\/test-runs\/\$\{encodeURIComponent\(id\)\}/);
  assert.match(script, /\$\{run\}\/\$\{encodeURIComponent\(id\)\}/);
  assert.doesNotMatch(script, /constructedCaseUiUrl[\s\S]*\/case\//);
  assert.doesNotMatch(script, /absoluteUiUrl\(testCase/);
  assert.doesNotMatch(script, /runLinks\?\.uiUrl/);
  assert.match(script, /const \{ entries: failedEntries \} = await collectFailedTestEntries\(runId\);/);
});

test("fails when TESTDINO_ORG_ID is missing or invalid", () => {
  const base = {
    TESTDINO_ACCESS_TOKEN: "td_pat_x",
    TESTDINO_PROJECT_ID: "project_x",
  };
  const missing = runFind({ ...base, TESTDINO_ORG_ID: "" });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /Missing or invalid TESTDINO_ORG_ID/);

  const invalid = runFind({ ...base, TESTDINO_ORG_ID: "not-an-org" });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Missing or invalid TESTDINO_ORG_ID/);
});
