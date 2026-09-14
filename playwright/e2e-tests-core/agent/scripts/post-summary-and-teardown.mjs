#!/usr/bin/env node
/**
 * Post the aggregate Slack healing summary and delete internal workflow artifacts.
 */
import fs from "node:fs";
import { getSlackPermalink, postSlackMessage } from "./slack-utils.mjs";

const appendGithubStepSummary = (markdown) => {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown.trim()}\n`);
};

const safeSlackPermalink = (value) => {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:") return "";
    if (url.hostname !== "slack.com" && !url.hostname.endsWith(".slack.com")) return "";
    return url.href;
  } catch {
    return "";
  }
};

const postSlackSummary = async () => {
  console.log("\n== Post Slack healing summary ==");
  if (process.env.SLACK_READY !== "true") {
    console.log("No created PRs were found; skipping Slack summary post.");
    return;
  }

  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_CHANNEL_ID;
  const messagePath = process.env.SLACK_MESSAGE_PATH || "playwright/agent/.healing/slack-message.txt";

  if (!token || !channel) {
    console.log("Slack notification is not configured; skipping.");
    return;
  }

  try {
    const summaryText = fs.readFileSync(messagePath, "utf8").trim();
    const summaryResponse = await postSlackMessage({
      token,
      payload: {
        channel,
        text: summaryText,
        mrkdwn: true,
        unfurl_links: false,
        unfurl_media: false,
      },
    });
    console.log(`Posted Slack healing summary message to channel ${channel}.`);

    if (summaryResponse?.ts) {
      try {
        const permalink = await getSlackPermalink({
          token,
          channel: summaryResponse.channel || channel,
          messageTs: summaryResponse.ts,
        });
        const safePermalink = safeSlackPermalink(permalink);
        if (safePermalink) {
          appendGithubStepSummary(`[Slack summary thread](${safePermalink})`);
        } else if (permalink) {
          console.log("Slack summary permalink was not a safe Slack HTTPS URL.");
        } else {
          console.log("Slack summary permalink was not returned.");
        }
      } catch (error) {
        console.warn(`Could not resolve Slack summary permalink: ${error.message}`);
      }
    }

  } catch (error) {
    console.warn(`Slack summary post failed: ${error.message}`);
  }
};

const githubRequestJson = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${process.env.GH_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });

  if (response.status === 204) return null;
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`GitHub API returned ${response.status}: ${body?.message || response.statusText}`);
  }
  return body;
};

// Matches `_playwright-healing-groups` and `_playwright-healing-group-<id>`.
// Public zips (`playwright-healing-summary`, `playwright-healing-groups`) stay.
const shouldDeleteArtifact = (artifact) =>
  String(artifact?.name || "").startsWith("_playwright-healing-group");

const teardownArtifacts = async () => {
  console.log("\n== Teardown internal healing artifacts ==");
  const {
    GH_TOKEN,
    RUN_ID,
    REPO,
    GITHUB_API_URL = "https://api.github.com",
  } = process.env;

  if (!GH_TOKEN || !RUN_ID || !REPO) {
    console.log("Missing GitHub token, run id, or repository; skipping internal artifact cleanup.");
    return;
  }

  try {
    let deleted = 0;
    let page = 1;
    while (page <= 20) {
      const url = new URL(`/repos/${REPO}/actions/runs/${RUN_ID}/artifacts`, GITHUB_API_URL);
      url.searchParams.set("per_page", "100");
      url.searchParams.set("page", String(page));
      const data = await githubRequestJson(url);
      const artifacts = Array.isArray(data?.artifacts) ? data.artifacts : [];

      for (const artifact of artifacts.filter(shouldDeleteArtifact)) {
        const deleteUrl = new URL(`/repos/${REPO}/actions/artifacts/${artifact.id}`, GITHUB_API_URL);
        await githubRequestJson(deleteUrl, { method: "DELETE" });
        deleted += 1;
      }

      if (artifacts.length < 100) break;
      page += 1;
    }

    console.log(`Deleted ${deleted} internal healing artifact(s).`);
  } catch (error) {
    console.warn(`Internal artifact cleanup failed: ${error.message}`);
  }
};

await postSlackSummary();
await teardownArtifacts();
