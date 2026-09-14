#!/usr/bin/env node
/**
 * Build the aggregate healing report and Slack summary text.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const groupCount = Number(process.env.GROUP_COUNT || "0");
const publishDir = path.resolve("playwright/agent/.healing/publish");
const summaryDir = path.resolve("playwright/agent/.healing/summary");
const summaryPath = path.join(summaryDir, "healing-summary.md");
const slackPath = path.resolve("playwright/agent/.healing/slack-message.txt");
fs.mkdirSync(summaryDir, { recursive: true });

const parseMatrix = () => {
  const raw = JSON.parse(process.env.MATRIX_JSON || '{"include":[]}');
  if (!Array.isArray(raw.include)) {
    throw new Error("MATRIX_JSON must contain an include array");
  }
  return raw.include;
};

const matrix = parseMatrix();

const readJsonIfPresent = (file) => {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
};

const outcomes = [];
if (fs.existsSync(publishDir)) {
  for (const entry of fs.readdirSync(publishDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const loaded = readJsonIfPresent(path.join(publishDir, entry.name, "outcome.json"));
    if (loaded) outcomes.push(loaded);
  }
}

const outcomeByGroup = new Map(outcomes.map((outcome) => [String(outcome.groupId), outcome]));
const readGroupMarkdown = (groupId) => {
  const publishMd = [
    path.join(publishDir, groupId, "pr-body.md"),
    path.join(publishDir, groupId, "no-change.md"),
  ];
  for (const file of publishMd) {
    if (!fs.existsSync(file)) continue;
    const raw = fs.readFileSync(file, "utf8").trim();
    if (raw) return raw;
  }
  return "";
};

const rows = matrix.map((item) => {
  const groupId = String(item.group_id);
  const outcome = outcomeByGroup.get(groupId) || {};
  return {
    groupId,
    groupTitle: item.title_suffix || groupId,
    candidateCount: item.candidate_count,
    candidateFile: item.candidate_file,
    hasChanges: false,
    createPrEnabled: false,
    prCreated: false,
    prUrl: null,
    prTitle: null,
    slackThreads: [],
    jobStatus: "missing",
    reason: "missing_outcome",
    detailMarkdown: readGroupMarkdown(groupId),
    ...outcome,
  };
});

const totals = {
  groups: groupCount,
  withChanges: rows.filter((row) => row.hasChanges).length,
  prCreated: rows.filter((row) => row.prCreated).length,
  prDisabled: rows.filter((row) => row.reason === "pr_disabled").length,
  noChanges: rows.filter((row) => row.reason === "no_changes").length,
  notCreated: rows.filter((row) => row.reason === "pr_not_created").length,
  patchApplyFailed: rows.filter((row) => row.reason === "patch_apply_failed").length,
  failedJobs: rows.filter((row) => row.jobStatus === "failure" || row.jobStatus === "cancelled").length,
  missingOutcome: rows.filter((row) => row.reason === "missing_outcome").length,
};

const runUrl = process.env.RUN_URL;
const repo = process.env.REPO;
const DEFAULT_SLACK_CC = "<!subteam^S0AP2400XLZ>";
const slackCc = (process.env.PLAYWRIGHT_HEALING_SLACK_CC || DEFAULT_SLACK_CC).trim();
const readCreatePrInput = () => {
  if (process.env.CREATE_PR_INPUT) return process.env.CREATE_PR_INPUT;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) return "";

  try {
    const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
    return event?.inputs?.create_pr ?? "";
  } catch {
    return "";
  }
};
const eventName = process.env.EVENT_NAME || process.env.GITHUB_EVENT_NAME;
const createPrInput = String(readCreatePrInput()).toLowerCase();
const slackNotificationsEnabled = eventName === "schedule" || createPrInput === "true";
const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();
const slackText = (value) => normalizeText(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const safeSlackUrl = (value) => {
  const url = normalizeText(value);
  if (!url || /[>|]/.test(url)) return "";
  return url;
};
const slackLink = (url, label, fallback = label) => {
  const safeUrl = safeSlackUrl(url);
  return safeUrl ? `<${safeUrl}|${label}>` : slackText(fallback);
};
const markdownCell = (value) =>
  String(value ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\|/g, "\\|")
    .trim() || "-";
const prLabel = (row) => {
  if (row.prUrl) return `[PR](${row.prUrl})`;
  if (row.reason === "pr_disabled") return "disabled";
  if (row.reason === "pr_not_created") return "not created";
  return "-";
};

const lines = [];
lines.push("## Playwright Healing Summary");
lines.push("");
if (rows.length > 0) {
  lines.push("### UI Change Groups");
  lines.push("");
  lines.push("| Group | Candidates | Outcome | PR |");
  lines.push("| --- | ---: | --- | --- |");
  for (const row of rows) {
    lines.push([
      markdownCell(row.groupTitle || row.groupId),
      markdownCell(row.candidateCount),
      markdownCell(row.reason),
      prLabel(row),
    ].join(" | ").replace(/^/, "| ").replace(/$/, " |"));
  }
  lines.push("");
}
lines.push("Per-group details are in the `playwright-healing-groups` artifact.");

fs.writeFileSync(summaryPath, lines.join("\n") + "\n");
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, fs.readFileSync(summaryPath, "utf8"));
}

const runDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kuala_Lumpur",
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
}).format(new Date()).replace(/\//g, "-");
const runId = normalizeText(runUrl).match(/\/actions\/runs\/([^/?#]+)/)?.[1];
const workflowRunLink = runUrl ? slackLink(runUrl, `#${runId || "workflow run"}`, runUrl) : "-";
const slackThreadLinks = (row) => {
  const threads = Array.isArray(row.slackThreads) ? row.slackThreads : [];
  if (threads.length === 0) return "> No original failing-test Slack threads found.";
  return `> Links: ${threads
    .map((thread, index) => thread.permalink ? slackLink(thread.permalink, `Thread ${index + 1}`, `Thread ${index + 1}`) : slackText(`${thread.channel}/${thread.threadTs}`))
    .join(" • ")}`;
};
const slackLinkText = (value) => slackText(value).replace(/\|/g, " ");
const fixTitle = (row) => slackLinkText(row.groupTitle || row.prTitle || row.groupId);
const fixPrLink = (row) => row.prUrl ? slackLink(row.prUrl, fixTitle(row), fixTitle(row)) : fixTitle(row);
const threadCountLabel = (row) => {
  const count = Array.isArray(row.slackThreads) ? row.slackThreads.length : 0;
  return `${count} ${count === 1 ? "Thread" : "Threads"}`;
};

const slackLines = [];
slackLines.push(`*Daily Playwright Auto Healing | ${runDate}*`);
slackLines.push("");
slackLines.push("*Summary:*");
slackLines.push(`• PRs Created: ${totals.prCreated}`);
slackLines.push(`• Workflow Run: ${workflowRunLink}`);
slackLines.push("");
const prRows = rows.filter((row) => row.prUrl);
if (prRows.length > 0) {
  slackLines.push("*Fixes & Associated Slack Threads:*");
  prRows.forEach((row, index) => {
    slackLines.push(`${index + 1}. ${fixPrLink(row)} (${threadCountLabel(row)})`);
    slackLines.push(slackThreadLinks(row));
    if (index < prRows.length - 1) slackLines.push("");
  });
  slackLines.push("");
  slackLines.push(`Created PR links have been posted back to their original failing-test Slack threads.${slackCc ? ` CC: ${slackCc}` : ""}`);
} else {
  slackLines.push("No PRs were created in this healing run.");
}
fs.writeFileSync(slackPath, slackLines.join("\n") + "\n");

const appendGithubOutput = (key, value) => {
  if (!process.env.GITHUB_OUTPUT) return;
  const delimiter = `gh-output-${key}-${crypto.randomUUID()}`;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}<<${delimiter}\n${value}\n${delimiter}\n`);
};

appendGithubOutput("summary_path", summaryPath);
appendGithubOutput("slack_path", slackPath);
appendGithubOutput("slack_ready", slackNotificationsEnabled && totals.prCreated > 0 ? "true" : "false");
