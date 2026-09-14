/**
 * Corpus loading, fixture validation and deterministic scoring.
 *
 * Library only — the single entry point is eval/replay-healer-eval.mjs
 * (`npm run eval`), which validates the corpus before it replays it.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCaseChecks, runUniversalChecks } from "./universal-checks.mjs";

const evalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const casesRoot = path.join(evalRoot, "cases");

export const listCaseDirs = () =>
  fs
    .readdirSync(casesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(casesRoot, entry.name))
    .sort();

export const loadCase = (caseDir) => {
  const casePath = path.join(caseDir, "case.json");
  const caseJson = JSON.parse(fs.readFileSync(casePath, "utf8"));
  const fixturesDir = path.join(caseDir, "fixtures");
  const has = (name) => fs.existsSync(path.join(fixturesDir, name));
  return {
    dir: caseDir,
    json: caseJson,
    fixturesDir,
    hasScreenshot: has("screenshot.png"),
    hasErrorContext: has("error-context.md"),
    hasGroupSlice: has("group-slice.json"),
  };
};

const EVIDENCE_GRADES = new Set(["screenshot", "error-context", "error"]);
const CLI_MODES = new Set(["pass", "blocked"]);

const validateCaseShape = (caseJson) => {
  const errors = [];
  if (!caseJson.id) errors.push("missing id");
  if (!Array.isArray(caseJson.sourcePrs) || caseJson.sourcePrs.length === 0) {
    errors.push("sourcePrs required");
  }
  if (!caseJson.checkoutSha || String(caseJson.checkoutSha).length < 7) {
    errors.push("checkoutSha required");
  }
  if (!EVIDENCE_GRADES.has(caseJson.evidenceGrade)) {
    errors.push("evidenceGrade must be screenshot|error-context|error");
  }
  if (!caseJson.expected?.artifact) errors.push("missing expected.artifact");
  if (!["no-change", "pr-body"].includes(caseJson.expected?.artifact)) {
    errors.push("expected.artifact must be no-change|pr-body");
  }
  if (!Array.isArray(caseJson.coversRules) || caseJson.coversRules.length === 0) {
    errors.push("coversRules required");
  }
  if (typeof caseJson.patch_scored !== "boolean") errors.push("patch_scored required");
  if (caseJson.cliMode && !CLI_MODES.has(caseJson.cliMode)) {
    errors.push("cliMode must be pass|blocked");
  }
  if (!caseJson.diagnosis?.rootCause) errors.push("diagnosis.rootCause required");
  return errors;
};

export const validateFixtures = (loaded) => {
  const errors = validateCaseShape(loaded.json);
  if (!loaded.hasGroupSlice) errors.push("missing fixtures/group-slice.json");
  if (loaded.json.evidenceGrade === "screenshot" && !loaded.hasScreenshot) {
    errors.push("evidenceGrade=screenshot but fixtures/screenshot.png missing");
  }
  if (loaded.json.evidenceGrade === "error-context" && !loaded.hasErrorContext) {
    errors.push("evidenceGrade=error-context but fixtures/error-context.md missing");
  }
  if (!loaded.hasErrorContext && !fs.existsSync(path.join(loaded.fixturesDir, "error.txt"))) {
    errors.push("missing fixtures/error-context.md or error.txt");
  }
  return errors;
};

export const scoreCase = (loaded, trace) => {
  const universal = runUniversalChecks(trace, {
    hasScreenshot: loaded.hasScreenshot,
    hasErrorContext: loaded.hasErrorContext,
  });
  const specific = runCaseChecks(trace, loaded.json);
  const failures = [...universal.failures, ...specific.failures];
  const decisionFailures = [...universal.decisionFailures, ...specific.decisionFailures];
  const processFailures = [...universal.processFailures, ...specific.processFailures];
  return {
    id: loaded.json.id,
    ok: failures.length === 0,
    // Kept apart on purpose: a healer can reach the right outcome while
    // skipping investigation steps, and the reverse.
    decisionOk: decisionFailures.length === 0,
    processOk: processFailures.length === 0,
    artifact: trace.artifact,
    expected: loaded.json.expected.artifact,
    failures,
    decisionFailures,
    processFailures,
  };
};
