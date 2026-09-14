#!/usr/bin/env node
/**
 * Apply a per-group fixer artifact and expose patch/diff status to GitHub Actions.
 *
 * PR creation requires: successful fixer, applied patch with changes, and pr-body.md
 * (agent is responsible for sample Playwright CLI verification before writing pr-body).
 */
import childProcess from "node:child_process";
import fs from "node:fs";
import { FIXER_ARTIFACT_DIR, HEALING_DIFF_PATHSPEC, HEALING_GIT_APPLY_EXCLUDE_ARGS } from "./healing-diff-utils.mjs";

const appendOutput = (key, value) => {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
};

const run = (command, args) =>
  childProcess.spawnSync(command, args, {
    encoding: "utf8",
    stdio: "inherit",
  });

const hasNonEmptyFile = (filePath) =>
  fs.existsSync(filePath) && fs.statSync(filePath).isFile() && fs.readFileSync(filePath, "utf8").trim().length > 0;

let fixerFailed = false;
let applyFailed = false;
let hasChanges = false;

if (fs.existsSync(`${FIXER_ARTIFACT_DIR}/metadata.json`)) {
  const metadata = JSON.parse(fs.readFileSync(`${FIXER_ARTIFACT_DIR}/metadata.json`, "utf8"));
  fixerFailed = !metadata.llmSucceeded;
} else {
  console.warn("Missing fixer metadata; treating the fixer stage as failed.");
  fixerFailed = true;
}

if (!fixerFailed) {
  for (const fileName of ["pr-body.md", "no-change.md"]) {
    const source = `${FIXER_ARTIFACT_DIR}/${fileName}`;
    if (fs.existsSync(source) && fs.statSync(source).isFile()) {
      fs.copyFileSync(source, `playwright/agent/.healing/${fileName}`);
    }
  }

  for (const patch of ["staged.patch", "unstaged.patch"]) {
    const patchPath = `${FIXER_ARTIFACT_DIR}/${patch}`;
    if (!fs.existsSync(patchPath) || fs.statSync(patchPath).size === 0) continue;
    const result = run("git", ["apply", ...HEALING_GIT_APPLY_EXCLUDE_ARGS, patchPath]);
    if (result.status !== 0) applyFailed = true;
  }

  if (!applyFailed) {
    const diff = childProcess.spawnSync("git", ["diff", "--quiet", "--", ...HEALING_DIFF_PATHSPEC], {
      stdio: "ignore",
    });
    hasChanges = diff.status === 1;
  }
} else {
  console.warn("Fixer failed or timed out (llmSucceeded=false); skipping patch apply and PR body.");
}

const prBodyPresent =
  !fixerFailed &&
  !applyFailed &&
  (
    hasNonEmptyFile(`${FIXER_ARTIFACT_DIR}/pr-body.md`) ||
    hasNonEmptyFile("playwright/agent/.healing/pr-body.md")
  );

const prEligible =
  !fixerFailed &&
  !applyFailed &&
  hasChanges &&
  prBodyPresent;

appendOutput("fixer_failed", fixerFailed ? "true" : "false");
appendOutput("apply_failed", applyFailed ? "true" : "false");
appendOutput("has_changes", hasChanges ? "true" : "false");
appendOutput("pr_body_present", prBodyPresent ? "true" : "false");
appendOutput("pr_eligible", prEligible ? "true" : "false");
