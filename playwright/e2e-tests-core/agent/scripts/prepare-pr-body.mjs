#!/usr/bin/env node
/**
 * Ensure a non-empty healer PR body exists, stamp inspectable eval links
 * (healer job for this group + TestDino case URLs from the candidate group), and
 * reset ignored submodule pointers.
 *
 * Links are stamped here so they do not depend on the fixer LLM copying URLs.
 */
import fs from "node:fs";
import path from "node:path";
import childProcess from "node:child_process";
import { pathToFileURL } from "node:url";

const defaultSubmodulePath = "playwright/e2e-tests-core";
const LINKS_HEADING = "## Links";

export const prBodyPath = "playwright/agent/.healing/pr-body.md";

const hasNonEmptyFile = (filePath) =>
  fs.existsSync(filePath) && fs.statSync(filePath).isFile() && fs.readFileSync(filePath, "utf8").trim().length > 0;

export function healerWorkflowRunUrl(env = process.env) {
  const server = String(env.GITHUB_SERVER_URL || "").replace(/\/$/, "");
  const repo = String(env.GITHUB_REPOSITORY || "").trim();
  const runId = String(env.GITHUB_RUN_ID || "").trim();
  if (!server || !repo || !/^\d+$/.test(runId)) return null;
  return `${server}/${repo}/actions/runs/${runId}`;
}

export function healerJobUrl(env = process.env) {
  const direct = String(env.HEALER_JOB_URL || "").trim().replace(/\/$/, "");
  if (/^https?:\/\/\S+\/(?:actions\/runs\/\d+\/job|runs)\/\d+$/i.test(direct)) return direct;
  const runUrl = healerWorkflowRunUrl(env);
  const checkRunId = String(env.HEALER_CHECK_RUN_ID || "").trim();
  if (runUrl && /^\d+$/.test(checkRunId)) return `${runUrl}/job/${checkRunId}`;
  return null;
}

export function testdinoCaseUrl(candidate) {
  const url = String(candidate?.testCase?.url || "").trim();
  return /^https:\/\/app\.testdino\.com\//i.test(url) ? url : null;
}

export function testdinoEvalLinks(groupJson) {
  const candidates = Array.isArray(groupJson?.candidates) ? groupJson.candidates : [];
  const seen = new Set();
  const links = [];
  for (const candidate of candidates) {
    const url = testdinoCaseUrl(candidate);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const title = String(candidate?.testCase?.title || candidate?.testCase?.fullTitle || url).trim();
    links.push({ title, url });
  }
  return links;
}

export function renderEvalLinksSection({ healerJobUrl, healerJobName, testdinoLinks }) {
  const lines = [LINKS_HEADING, ""];
  if (healerJobUrl) {
    lines.push(`- Healer job (this group): ${healerJobUrl}`);
  } else if (healerJobName) {
    lines.push(`- Healer job (this group): ${healerJobName}`);
  }
  for (const link of testdinoLinks) {
    lines.push(`- TestDino: [${link.title.replace(/[\[\]]/g, "")}](${link.url})`);
  }
  return `${lines.join("\n")}\n`;
}

export function stripTrailingGithubNote(body) {
  return String(body).replace(/(?:\r?\n)+> \[!NOTE\](?:\r?\n> [^\n]*)*\s*$/, "").trimEnd();
}

export function mergeEvalLinksIntoBody(body, section) {
  let text = String(body).trim();
  if (text.startsWith("## Links")) {
    const next = text.search(/\n## (?!Links\b)/);
    text = next === -1 ? "" : text.slice(next).trim();
  }
  return `${text}\n\n${section.trim()}\n`;
}

function readGroupJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Failed to read candidate file ${filePath}: ${error.message}`);
  }
}

function stampEvalLinks(body, env = process.env) {
  const candidateFile = String(env.CANDIDATE_FILE || env.TESTDINO_UI_CHANGE_CANDIDATES_PATH || "").trim();
  if (!candidateFile) {
    throw new Error("CANDIDATE_FILE (or TESTDINO_UI_CHANGE_CANDIDATES_PATH) is required to stamp TestDino eval links.");
  }
  const resolved = path.resolve(candidateFile);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Candidate file not found: ${resolved}`);
  }
  const testdinoLinks = testdinoEvalLinks(readGroupJson(resolved));
  return mergeEvalLinksIntoBody(
    body,
    renderEvalLinksSection({
      healerJobUrl: healerJobUrl(env),
      healerJobName: String(env.HEALER_JOB_NAME || "").trim() || null,
      testdinoLinks,
    }),
  );
}

const resetIgnoredSubmodulePointers = (submodulePath) => {
  console.log("\n== Reset ignored submodule pointers ==");
  childProcess.spawnSync("git", ["status", "--short"], { stdio: "inherit" });
  const result = childProcess.spawnSync(
    "git",
    ["restore", "--source=HEAD", "--staged", "--worktree", "--", submodulePath],
    { stdio: "inherit" },
  );
  if (result.status !== 0) {
    const failureDetail = result.status === null
      ? `signal ${result.signal || "unknown"}`
      : `status ${result.status}`;
    console.error(`Failed to reset ${submodulePath} submodule pointer with ${failureDetail}.`);
    process.exit(result.status || 1);
  }
  childProcess.spawnSync("git", ["status", "--short"], { stdio: "inherit" });
};

function main() {
  if (!hasNonEmptyFile(prBodyPath)) {
    console.error(`Missing non-empty PR body at ${prBodyPath}; refusing to synthesize one.`);
    process.exit(1);
  }

  const stamped = stampEvalLinks(stripTrailingGithubNote(fs.readFileSync(prBodyPath, "utf8")));
  fs.writeFileSync(prBodyPath, `${stamped.trimEnd()}\n`);
  const fixPrBody = "playwright/agent/.healing/fix/pr-body.md";
  fs.mkdirSync(path.dirname(fixPrBody), { recursive: true });
  fs.copyFileSync(prBodyPath, fixPrBody);

  const submodulePath = (process.env.PW_HEALER_SUBMODULE_PATH || "").trim() || defaultSubmodulePath;
  resetIgnoredSubmodulePointers(submodulePath);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
