#!/usr/bin/env node
/**
 * Post the per-group PR link to original Slack threads and write group outcome files.
 */
import fs from "node:fs";
import path from "node:path";
import { FIXER_ARTIFACT_DIR } from "./healing-diff-utils.mjs";
import { postSlackMessage, uniqueSlackThreadsFromCandidateFile } from "./slack-utils.mjs";

const hasChanges = process.env.HAS_CHANGES === "true";
const prBodyPresent = process.env.PR_BODY_PRESENT === "true";
const prEligible = process.env.PLAYWRIGHT_PR_ELIGIBLE === "true";
const prUrl = (process.env.PR_URL || "").trim();
const eventName = process.env.EVENT_NAME;
const createPrInput = (process.env.CREATE_PR_INPUT || "").toLowerCase();
const jobStatus = process.env.JOB_STATUS || "unknown";
const createPrEnabled = eventName === "schedule" || createPrInput === "true";
const prTitle = process.env.PR_TITLE || prUrl;

let reason = "no_changes";
if (process.env.FIXER_FAILED === "true") reason = "fixer_failed";
if (process.env.APPLY_FAILED === "true") reason = "patch_apply_failed";
if (hasChanges && !prBodyPresent && process.env.FIXER_FAILED !== "true") reason = "missing_pr_body";
if (prEligible && !createPrEnabled) reason = "pr_disabled";
if (prEligible && createPrEnabled && !prUrl) reason = "pr_not_created";
if (prUrl) reason = "pr_created";

const artifactFile = (name) => ({ source: name, file: `${FIXER_ARTIFACT_DIR}/${name}` });

const readDetailMarkdown = () => {
  const prBody = artifactFile("pr-body.md");
  const noChange = artifactFile("no-change.md");
  const candidates = hasChanges ? [prBody, noChange] : [noChange, prBody];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate.file)) continue;
    const raw = fs.readFileSync(candidate.file, "utf8").trim();
    if (!raw) continue;
    return {
      detailSource: candidate.source,
      detailMarkdown: raw,
    };
  }

  return {
    detailSource: "generated-outcome.md",
    detailMarkdown: [
      "# Playwright Healing Outcome",
      "",
      `Group ID: \`${process.env.GROUP_ID}\``,
      `Reason: \`${reason}\``,
      "",
      "No `no-change.md` or `pr-body.md` was produced by the fixer.",
    ].join("\n"),
  };
};

const detail = readDetailMarkdown();
const outcomeDir = "playwright/agent/.healing/outcomes";
fs.mkdirSync(outcomeDir, { recursive: true });
const detailFile = path.join(outcomeDir, `${process.env.GROUP_ID}.md`);
fs.writeFileSync(detailFile, detail.detailMarkdown.trim() + "\n");

const readCandidates = () => {
  try {
    const raw = JSON.parse(fs.readFileSync(process.env.CANDIDATE_FILE, "utf8"));
    return Array.isArray(raw.candidates) ? raw.candidates : [];
  } catch (error) {
    console.warn(`Could not read candidate testcase metadata: ${error.message}`);
    return [];
  }
};

const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();
const slackText = (value) => normalizeText(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const slackThreadKey = (thread) => thread?.channel && thread?.threadTs ? `${thread.channel}:${thread.threadTs}` : "";

const candidatesForSlackThread = (candidates, thread) => {
  const key = slackThreadKey(thread);
  if (!key) return [];
  return candidates.filter((candidate) => slackThreadKey(candidate?.slackThread) === key);
};

const testcaseSummariesFromCandidates = (candidates) => {
  const byKey = new Map();

  for (const candidate of candidates) {
    const title = normalizeText(candidate?.testCase?.title || candidate?.testCase?.fullTitle);
    if (!title) continue;

    const spec = normalizeText(candidate?.spec?.filePath || candidate?.spec?.fileName || candidate?.spec?.name);
    const url = normalizeText(candidate?.testCase?.url);
    const id = normalizeText(candidate?.testCase?.id);
    const key = `${spec}::${title}`;
    const summary = byKey.get(key) || {
      title,
      url,
      id,
    };
    if (!summary.url && url) summary.url = url;
    if (!summary.id && id) summary.id = id;
    byKey.set(key, summary);
  }

  return [...byKey.values()].map((summary) => ({
    id: summary.id || null,
    title: summary.title,
    url: summary.url || null,
  }));
};

const slackTestcaseLines = (testcases, maxLines = 10) => {
  if (testcases.length === 0) return ["• Test case metadata could not be read."];

  const visible = testcases.slice(0, maxLines);
  const lines = visible.map((testcase) =>
    testcase.url ? `• <${testcase.url}|${slackText(testcase.title)}>` : `• ${slackText(testcase.title)}`);

  if (testcases.length > visible.length) {
    lines.push(`• ...and ${testcases.length - visible.length} more test case(s).`);
  }
  return lines;
};

const slackPrTitle = () => normalizeText(prTitle).replace(/^Playwright Auto Healer\s+/i, "");
const prSlackText = () => slackText(slackPrTitle() || prUrl || "Playwright healing PR");

const buildSlackPrReplyPayload = (thread, testcases) => {
  const testcaseLines = slackTestcaseLines(testcases);
  const prLinkText = `<${prUrl}|PR> - ${prSlackText()}`;
  const fallbackText = [
    `:robot_face: Playwright auto-healer created this ${prLinkText}`,
    "",
    "which fixes the following failing test case(s):",
    ...testcaseLines,
  ].join("\n");

  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `:robot_face: Playwright auto-healer created this ${prLinkText}`,
          "",
          "which fixes the following failing test case(s):",
          ...testcaseLines,
        ].join("\n"),
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Open PR",
            emoji: true,
          },
          url: prUrl,
          style: "primary",
        },
      ],
    },
  ];

  return {
    channel: thread.channel,
    text: fallbackText,
    blocks,
    mrkdwn: true,
    thread_ts: thread.threadTs,
    unfurl_links: false,
    unfurl_media: false,
  };
};

const readSlackThreads = async () => {
  try {
    return (await uniqueSlackThreadsFromCandidateFile(process.env.CANDIDATE_FILE))
      .map((thread) => ({
        channel: thread.channel,
        threadTs: thread.threadTs,
        permalink: thread.permalink || null,
        testdinoRunId: thread.testdinoRunId || null,
        testdinoRunUrl: thread.testdinoRunUrl || null,
        platform: thread.platform || null,
        module: thread.module || null,
      }));
  } catch (error) {
    console.warn(`Could not read Slack thread metadata: ${error.message}`);
    return [];
  }
};

const slackThreads = await readSlackThreads();
const candidates = readCandidates();
const fixedTestcases = testcaseSummariesFromCandidates(candidates);
const fixedTestcasesBySlackThread = slackThreads.map((thread) => ({
  channel: thread.channel,
  threadTs: thread.threadTs,
  fixedTestcases: testcaseSummariesFromCandidates(candidatesForSlackThread(candidates, thread)),
}));

const postPrLinkToSlackThreads = async () => {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token || !prUrl) {
    console.log("Slack notification is not configured or PR URL is missing; skipping thread reply.");
    return;
  }

  if (slackThreads.length === 0) {
    console.log("No original failing-test Slack thread metadata found for this PR.");
    return;
  }

  try {
    for (const thread of slackThreads) {
      const threadCandidates = candidatesForSlackThread(candidates, thread);
      const threadTestcases = testcaseSummariesFromCandidates(threadCandidates);
      await postSlackMessage({
        token,
        payload: buildSlackPrReplyPayload(thread, threadTestcases),
      });
    }
    console.log(`Posted PR link to ${slackThreads.length} original failing-test Slack thread(s).`);
  } catch (error) {
    console.warn(`Slack thread reply failed: ${error.message}`);
  }
};

await postPrLinkToSlackThreads();

const outcome = {
  groupId: process.env.GROUP_ID,
  candidateFile: process.env.CANDIDATE_FILE,
  hasChanges,
  patchApplyFailed: process.env.APPLY_FAILED === "true",
  createPrEnabled,
  prCreated: Boolean(prUrl),
  prUrl: prUrl || null,
  prTitle: prTitle || null,
  slackThreads,
  fixedTestcases,
  fixedTestcasesBySlackThread,
  prBodyPresent,
  prEligible,
  jobStatus,
  reason,
  detailSource: detail.detailSource,
  detailFile: `${process.env.GROUP_ID}.md`,
  generatedAt: new Date().toISOString(),
};

const outputPath = path.join(outcomeDir, `${process.env.GROUP_ID}.json`);
fs.writeFileSync(outputPath, JSON.stringify(outcome, null, 2) + "\n");
console.log(`Wrote ${outputPath}`);

const copyIfFile = (source, dest) => {
  if (!source || !fs.existsSync(source) || !fs.statSync(source).isFile()) return;
  fs.copyFileSync(source, dest);
};

const packPublishDir = () => {
  const groupId = process.env.GROUP_ID;
  if (!groupId) return;
  const publishDir = path.join("playwright/agent/.healing/publish", groupId);
  fs.mkdirSync(publishDir, { recursive: true });
  copyIfFile(process.env.CANDIDATE_FILE, path.join(publishDir, "candidates.json"));
  for (const name of ["staged.patch", "unstaged.patch", "metadata.json"]) {
    copyIfFile(`${FIXER_ARTIFACT_DIR}/${name}`, path.join(publishDir, name));
  }
  const pickExisting = (...files) => files.find((file) => fs.existsSync(file) && fs.statSync(file).isFile());
  copyIfFile(
    pickExisting("playwright/agent/.healing/pr-body.md", `${FIXER_ARTIFACT_DIR}/pr-body.md`),
    path.join(publishDir, "pr-body.md"),
  );
  copyIfFile(
    pickExisting("playwright/agent/.healing/no-change.md", `${FIXER_ARTIFACT_DIR}/no-change.md`),
    path.join(publishDir, "no-change.md"),
  );
  copyIfFile(outputPath, path.join(publishDir, "outcome.json"));
};

packPublishDir();
