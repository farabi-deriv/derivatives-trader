#!/usr/bin/env node
/**
 * Find recent failed TestDino test cases for Playwright healing.
 *
 * Public API: https://docs.testdino.com/api-reference/overview
 * Base path:  {TESTDINO_BASE_URL}/api/v1/public/{projectId}/...
 *
 * Required env:
 *   TESTDINO_ACCESS_TOKEN  Public API PAT (`td_pat_...`, public-api scope)
 *   TESTDINO_PROJECT_ID    Project ID (`project_...`). Repo variable.
 *   TESTDINO_ORG_ID        Org ID (`org_...`). Repo variable. Used to build app.testdino.com deep links
 *                          (API links.uiUrl is the old /runs/.../case/ router and is not used).
 *
 * Optional env:
 *   TESTDINO_LOOKBACK_HOURS  Lookback window, default 24
 *   TESTDINO_MAX_RUNS        Number of recent runs to inspect, default 100
 *   TESTDINO_BRANCH          Only include runs from this git branch (empty = no branch filter)
 *   TESTDINO_ENVIRONMENT     Only include runs from this environment (empty = no environment filter)
 *   TESTDINO_RUN_COUNTERS    Comma-separated run counters to inspect exclusively;
 *                            bypasses lookback/max-runs when set
 *   TESTDINO_REQUESTS_PER_MINUTE Pace TestDino public API calls, default 80
 *   TESTDINO_OUTPUT_PATH     Output JSON path, default playwright/agent/.healing/ui-change-candidates.json
 *   TESTDINO_BASE_URL        API host, default https://api.testdino.com
 *
 * Requires Node 18+ for global fetch.
 */

import fs from "node:fs";
import childProcess from "node:child_process";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";

const {
  TESTDINO_ACCESS_TOKEN,
  TESTDINO_PROJECT_ID,
  TESTDINO_ORG_ID,
  TESTDINO_LOOKBACK_HOURS = "24",
  TESTDINO_MAX_RUNS = "100",
  TESTDINO_BRANCH,
  TESTDINO_ENVIRONMENT,
  TESTDINO_RUN_COUNTERS = "",
  TESTDINO_REQUESTS_PER_MINUTE = "80",
  TESTDINO_OUTPUT_PATH = "playwright/agent/.healing/ui-change-candidates.json",
  TESTDINO_BASE_URL = "https://api.testdino.com",
  GITHUB_API_URL = "https://api.github.com",
  GITHUB_REPOSITORY,
  GITHUB_RUN_ID,
  GITHUB_SHA,
  GH_TOKEN,
  GITHUB_TOKEN,
} = process.env;

/** Trimmed filter values; empty/whitespace means "do not apply this filter". */
const testdinoBranch = String(TESTDINO_BRANCH || "").trim();
const testdinoEnvironment = String(TESTDINO_ENVIRONMENT || "").trim();
const testdinoOrgId = String(TESTDINO_ORG_ID || "").trim();

const PROJECT_RE = /^project_[a-zA-Z0-9_-]+$/;
const ORG_RE = /^org_[a-zA-Z0-9_-]+$/;
const PUBLIC_API_PREFIX = "/api/v1/public";
const LIST_PAGE_LIMIT = 100; // Public API allowlist: 10 | 25 | 50 | 100
const FAILED_RUN_STATUSES = new Set(["failed", "interrupted", "incomplete"]);
const githubToken = GH_TOKEN || GITHUB_TOKEN;
const SLACK_THREAD_ARTIFACT_PREFIX = "_playwright-slack-thread-";

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const assertInsideHealingDir = (filePath) => {
  const healingBase = path.resolve("playwright/agent/.healing");
  const resolved = path.resolve(filePath);
  const relative = path.relative(healingBase, resolved);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) return resolved;
  throw new Error(`Refusing to write outside healing dir: ${resolved}`);
};

if (!TESTDINO_ACCESS_TOKEN) fail("Missing TESTDINO_ACCESS_TOKEN.");
if (!TESTDINO_ACCESS_TOKEN.startsWith("td_pat_")) {
  fail("TESTDINO_ACCESS_TOKEN must be a public API PAT with the td_pat_ prefix (see https://docs.testdino.com/api-reference/quickstart).");
}
if (!PROJECT_RE.test(TESTDINO_PROJECT_ID ?? "")) fail("Missing or invalid TESTDINO_PROJECT_ID.");
if (!ORG_RE.test(testdinoOrgId)) fail("Missing or invalid TESTDINO_ORG_ID.");

const lookbackHours = Number(TESTDINO_LOOKBACK_HOURS);
if (!Number.isFinite(lookbackHours) || lookbackHours <= 0) fail("TESTDINO_LOOKBACK_HOURS must be a positive number.");

const maxRuns = Math.max(1, Math.min(Number.parseInt(TESTDINO_MAX_RUNS, 10) || 100, 500));
const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
const until = new Date();
const explicitCounters = TESTDINO_RUN_COUNTERS.split(",")
  .map((value) => Number.parseInt(value.trim(), 10))
  .filter((value) => Number.isInteger(value) && value > 0);
const includeArtifactUrls = false;
const explicitCountersOnly = explicitCounters.length > 0;
const requestedRateLimit = Number.parseInt(TESTDINO_REQUESTS_PER_MINUTE, 10);
if (!Number.isFinite(requestedRateLimit) || requestedRateLimit <= 0) {
  fail("TESTDINO_REQUESTS_PER_MINUTE must be a positive integer.");
}
const testDinoRequestsPerMinute = Math.max(1, Math.min(requestedRateLimit, 100));
const testDinoRequestSpacingMs = Math.ceil(60_000 / testDinoRequestsPerMinute);
const testDino429Retries = 3;
const maxRetryAfterMs = 30_000;
let lastTestDinoRequestStartedAt = 0;

const publicApiPath = (suffix) => `${PUBLIC_API_PREFIX}/${TESTDINO_PROJECT_ID}${suffix}`;

const apiUrl = (pathname, params = {}) => {
  const url = new URL(pathname, TESTDINO_BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  return url;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForTestDinoRateLimit = async () => {
  const elapsed = Date.now() - lastTestDinoRequestStartedAt;
  const waitMs = testDinoRequestSpacingMs - elapsed;
  if (waitMs > 0) await sleep(waitMs);
  lastTestDinoRequestStartedAt = Date.now();
};

const retryAfterMs = (retryAfter) => {
  const value = String(retryAfter || "").trim();
  if (!value) return maxRetryAfterMs;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(Math.max(1000, Math.ceil(seconds * 1000)), maxRetryAfterMs);
  const retryAt = Date.parse(value);
  if (Number.isFinite(retryAt)) return Math.min(Math.max(1000, retryAt - Date.now()), maxRetryAfterMs);
  return maxRetryAfterMs;
};

const requestEnvelope = async (url) => {
  for (let attempt = 0; attempt <= testDino429Retries; attempt += 1) {
    await waitForTestDinoRateLimit();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${TESTDINO_ACCESS_TOKEN}` },
        signal: controller.signal,
      });
      const body = await res.json().catch(() => null);
      if (res.status === 429 && attempt < testDino429Retries) {
        const waitMs = retryAfterMs(res.headers.get("retry-after") || res.headers.get("ratelimit-reset"));
        console.warn(
          `TestDino rate limit returned 429 for ${url.pathname}; retrying in ${Math.ceil(waitMs / 1000)}s ` +
            `(attempt ${attempt + 1}/${testDino429Retries}).`,
        );
        await sleep(waitMs);
        continue;
      }
      if (!res.ok) {
        const message = body?.error?.message || body?.message || body?.error?.code || body?.error || res.statusText;
        throw new Error(`HTTP ${res.status}: ${message}`);
      }
      // Live public API mixes envelopes:
      // - { success, data } (token-info, debug-bundle, test-cases)
      // - { items, pagination } (test-runs list)
      // - bare resource object (test-run detail)
      if (body?.success === false) {
        const message = body?.error?.message || body?.message || body?.error?.code || body?.error || "request failed";
        throw new Error(`HTTP ${res.status}: ${message}`);
      }
      if (
        body?.error &&
        body?.success !== true &&
        !body?.id &&
        !Array.isArray(body?.items) &&
        body?.data === undefined
      ) {
        const message = body?.error?.message || body?.message || body?.error?.code || body?.error || "request failed";
        throw new Error(`HTTP ${res.status}: ${message}`);
      }
      return body;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("HTTP 429: TestDino rate limit retry budget exhausted.");
};

const paginationOf = (body) => {
  const pagination = body?.pagination && typeof body.pagination === "object" ? body.pagination : {};
  const page = Number(pagination.page) || 1;
  const totalPages = Number(pagination.total_pages ?? pagination.totalPages) || 0;
  const hasNext = Boolean(
    pagination.hasNext ??
      (totalPages > 0 ? page < totalPages : false),
  );
  return { ...pagination, page, totalPages, hasNext };
};

const unwrapPayload = (body) => {
  if (!body || typeof body !== "object") return body;
  if (body.success === true && "data" in body) return body.data;
  if (Array.isArray(body.items)) return body.items;
  return body;
};

const requestJson = async (url) => unwrapPayload(await requestEnvelope(url));

const requestPage = async (url) => {
  const body = await requestEnvelope(url);
  const payload = unwrapPayload(body);
  const data = Array.isArray(payload) ? payload : Array.isArray(payload?.list) ? payload.list : [];
  return { data, pagination: paginationOf(body), raw: body, payload };
};

const firstPresent = (...values) => values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");

/** Browser UI host. Deep links are built here; API `links.uiUrl` is the old /runs/.../case/ router. */
const TESTDINO_APP_BASE_URL = String(process.env.TESTDINO_APP_BASE_URL || "https://app.testdino.com").replace(/\/$/, "");

const constructedRunUiUrl = (runId) => {
  const id = String(runId || "").trim();
  if (!id || !ORG_RE.test(testdinoOrgId) || !TESTDINO_PROJECT_ID) return null;
  return `${TESTDINO_APP_BASE_URL}/${testdinoOrgId}/projects/${TESTDINO_PROJECT_ID}/test-runs/${encodeURIComponent(id)}`;
};

const constructedCaseUiUrl = (runId, caseId) => {
  const run = constructedRunUiUrl(runId);
  const id = String(caseId || "").trim();
  if (!run || !id) return null;
  return `${run}/${encodeURIComponent(id)}`;
};

const normalizeRun = (run) => {
  if (!run || typeof run !== "object") return run;
  const metadata = run.metadata && typeof run.metadata === "object" ? run.metadata : {};
  const git = run.git && typeof run.git === "object" ? run.git : metadata.git && typeof metadata.git === "object" ? metadata.git : {};
  const ci = run.ci && typeof run.ci === "object" ? run.ci : metadata.ci && typeof metadata.ci === "object" ? metadata.ci : {};
  const pipeline = (ci.pipeline || metadata.pipeline || {}) && typeof (ci.pipeline || metadata.pipeline || {}) === "object"
    ? (ci.pipeline || metadata.pipeline || {})
    : {};
  const result = run.result || run.testStats || {};
  const branch = firstPresent(metadata.git_branch, git.branch, metadata.git?.branch, run.branch);
  const environment = firstPresent(metadata.environment, git.environment, metadata.git?.environment, run.environment);
  const commitHash = firstPresent(metadata.git_commit_hash, git.commit_hash, git.commit?.hash, metadata.git?.commit?.hash);
  const commitMessage = firstPresent(metadata.git_commit_message, git.commit_message, git.commit?.message);
  const commitAuthor = firstPresent(metadata.git_commit_author, git.commit_author, git.commit?.author);

  return {
    ...run,
    startTime: run.startTime || run.start_time || null,
    endTime: run.endTime || run.end_time || null,
    duration: run.duration ?? run.duration_ms ?? null,
    testStats: {
      total: result.total ?? run.testStats?.total ?? 0,
      passed: result.passed ?? run.testStats?.passed ?? 0,
      failed: result.failed ?? run.testStats?.failed ?? 0,
      skipped: result.skipped ?? run.testStats?.skipped ?? 0,
      flaky: result.flaky ?? run.testStats?.flaky ?? 0,
      timedOut: result.timedOut ?? result.timed_out ?? run.testStats?.timedOut ?? 0,
      interrupted: result.interrupted ?? 0,
    },
    metadata: {
      ...metadata,
      git: {
        ...(typeof metadata.git === "object" ? metadata.git : {}),
        ...git,
        branch: branch || null,
        environment: environment || null,
        commit: {
          hash: commitHash || null,
          message: commitMessage || null,
          author: commitAuthor || null,
        },
      },
      ci: {
        ...ci,
        provider: firstPresent(metadata.ci_provider, ci.provider, ci.name) || null,
        pipeline: {
          ...pipeline,
          id: firstPresent(pipeline.id, metadata.pipeline?.id, run.ci_run_id) || null,
          name: firstPresent(pipeline.name, metadata.pipeline?.name) || null,
          url: firstPresent(pipeline.url, metadata.pipeline?.url) || null,
        },
      },
    },
  };
};

const runBranch = (run) => run?.metadata?.git?.branch ?? run?.branch ?? null;
const runEnvironment = (run) =>
  run?.metadata?.git?.environment ?? run?.metadata?.ci?.environment?.name ?? run?.environment ?? null;
const runUrl = (run) => constructedRunUiUrl(run?.id || run?._id);
const runKey = (run) => run?.id || run?._id || (run?.counter ? `counter:${run.counter}` : null);
const arrayValues = (...values) => values.flatMap((value) => Array.isArray(value) ? value : []);
const uniqueValues = (...values) => [
  ...new Set(arrayValues(...values).filter((value) => value !== undefined && value !== null && String(value).trim() !== "")),
];

const githubRunIdFromUrl = (value) => {
  const match = String(value || "").match(/\/actions\/runs\/(\d+)/);
  return match ? match[1] : null;
};
const normalizeGithubRunId = (value) => {
  const direct = String(value || "").trim();
  if (/^\d+$/.test(direct)) return direct;
  return githubRunIdFromUrl(direct) || "";
};
const githubJobIdFromUrl = (value) => {
  const match = String(value || "").match(/\/job\/(\d+)/);
  return match ? match[1] : null;
};
const normalizeArtifactLabel = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

const legacyPlatformAlias = (value) => {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("mobile")) return "mobile";
  if (normalized.includes("desktop") || normalized.includes("chromium")) return "desktop";
  return "";
};

const candidateSlackArtifactLabels = (candidate) => {
  const values = [
    candidate?.run?.platform,
    ...(Array.isArray(candidate?.run?.tags) ? candidate.run.tags : []),
    candidate?.testCase?.browserId,
    ...(Array.isArray(candidate?.testCase?.tags) ? candidate.testCase.tags : []),
    ...(Array.isArray(candidate?.testCase?.metadata?.tags) ? candidate.testCase.metadata.tags : []),
  ];
  const labels = [];
  const addLabel = (label) => {
    if (!label || labels.includes(label)) return;
    labels.push(label);
  };

  addLabel("summary");
  for (const value of values) {
    addLabel(normalizeArtifactLabel(value));
  }
  for (const value of values) {
    addLabel(legacyPlatformAlias(value));
  }

  return labels;
};
const githubCiMetadata = (run) => {
  const ci = run?.metadata?.ci || {};
  const github = ci.github || ci.githubActions || ci.github_actions || {};
  const pipeline = ci.pipeline || {};
  const workflowRunUrl = firstPresent(
    github.workflowRunUrl,
    github.runUrl,
    github.url,
    ci.workflowRunUrl,
    ci.runUrl,
    ci.url,
    pipeline.workflowRunUrl,
    pipeline.runUrl,
    pipeline.url,
  );
  const jobUrl = firstPresent(github.jobUrl, ci.jobUrl);

  return {
    provider: firstPresent(github.provider, ci.provider, ci.name, pipeline.provider) || null,
    workflowRunId: String(firstPresent(
      github.workflowRunId,
      github.runId,
      github.run_id,
      ci.workflowRunId,
      ci.runId,
      ci.run_id,
      pipeline.workflowRunId,
      pipeline.runId,
      pipeline.run_id,
      pipeline.id,
      githubRunIdFromUrl(workflowRunUrl),
      githubRunIdFromUrl(jobUrl),
    ) || "") || null,
    workflowRunUrl: workflowRunUrl || null,
    jobId: String(firstPresent(
      github.jobId,
      github.job_id,
      ci.jobId,
      ci.job_id,
      githubJobIdFromUrl(jobUrl),
    ) || "") || null,
    jobUrl: jobUrl || null,
    runAttempt: String(firstPresent(github.runAttempt, github.run_attempt, ci.runAttempt, ci.run_attempt) || "") || null,
  };
};

const requestGithubJson = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${githubToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: controller.signal,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = body?.message || res.statusText;
      throw new Error(`HTTP ${res.status}: ${message}`);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
};

const listRunArtifacts = async (githubRunId) => {
  const normalized = normalizeGithubRunId(githubRunId);
  if (!normalized) return [];

  const artifacts = [];
  let page = 1;
  while (page <= 10) {
    const url = new URL(`/repos/${GITHUB_REPOSITORY}/actions/runs/${normalized}/artifacts`, GITHUB_API_URL);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    const data = await requestGithubJson(url);
    const pageArtifacts = Array.isArray(data.artifacts) ? data.artifacts : [];
    artifacts.push(...pageArtifacts);
    if (pageArtifacts.length < 100) break;
    page += 1;
  }
  return artifacts;
};

const downloadArtifactJson = async (artifact) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "playwright-slack-thread-"));
  const zipPath = path.join(tmpDir, `${crypto.randomUUID()}.zip`);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(artifact.archive_download_url, {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${githubToken}`,
        },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Artifact download returned ${res.status}: ${res.statusText}`);
      fs.writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
    } finally {
      clearTimeout(timer);
    }
    const raw = childProcess.execFileSync("unzip", ["-p", zipPath], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    });
    return JSON.parse(raw);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};

const attachSlackThreadMetadata = async (candidates) => {
  if (!githubToken || !GITHUB_REPOSITORY || candidates.length === 0) {
    return { count: 0, threadsByRunId: {} };
  }

  const artifactsByGithubRunId = new Map();
  const threadsByRunId = {};

  for (const candidate of candidates) {
    const testdinoRunId = String(candidate?.run?.id || "").trim();
    const githubRunId = normalizeGithubRunId(candidate?.run?.ci?.workflowRunId || candidate?.run?.ci?.workflowRunUrl);
    const artifactLabels = candidateSlackArtifactLabels(candidate);

    if (!testdinoRunId || candidate.slackThread) continue;
    if (!githubRunId || artifactLabels.length === 0) continue;

    try {
      if (!artifactsByGithubRunId.has(githubRunId)) {
        artifactsByGithubRunId.set(githubRunId, await listRunArtifacts(githubRunId));
      }
      const artifactNames = new Set(artifactLabels.map((label) => `${SLACK_THREAD_ARTIFACT_PREFIX}${label}`));
      const artifact = artifactsByGithubRunId
        .get(githubRunId)
        .filter((candidateArtifact) => artifactNames.has(candidateArtifact.name) && !candidateArtifact.expired)
        .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())[0];
      if (!artifact) continue;
      const artifactLabel = artifact.name.slice(SLACK_THREAD_ARTIFACT_PREFIX.length);

      const metadata = await downloadArtifactJson(artifact);
      candidate.slackThread = {
        ...metadata,
        githubRunId,
        githubRunUrl: candidate?.run?.ci?.workflowRunUrl || metadata.githubRunUrl || null,
        platform: artifactLabel,
        artifactId: artifact.id,
        artifactName: artifact.name,
      };
      threadsByRunId[testdinoRunId] = candidate.slackThread;
    } catch (error) {
      console.warn(`Slack thread metadata unavailable for TestDino run ${testdinoRunId}: ${error.message}`);
    }
  }

  return { count: Object.keys(threadsByRunId).length, threadsByRunId };
};

const testCaseUrl = (run, testCase) =>
  constructedCaseUiUrl(run?.id || run?._id, testCase?.id || testCase?._id);

const normalizeWhitespace = (value) => String(value || "").replace(/\s+/g, " ").trim();
const firstLineMatching = (text, patterns) => {
  for (const line of String(text || "").split(/\r?\n/)) {
    const normalized = normalizeWhitespace(line);
    if (patterns.some((pattern) => pattern.test(normalized))) return normalized;
  }
  return null;
};

const extractStackLocation = (stack) => {
  const lines = String(stack || "").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/\bat\s+(?:.+?\s+\()?(.+?):(\d+):(\d+)\)?$/);
    if (match) return { file: match[1], line: Number(match[2]), column: Number(match[3]) };
  }
  for (const line of lines) {
    const match = line.match(/^\s*(.+?):(\d+):(\d+)\s*$/);
    if (match) return { file: match[1], line: Number(match[2]), column: Number(match[3]) };
  }
  return null;
};

const normalizePathForSignature = (file) =>
  String(file || "")
    .replace(/^.*?\/home\/runner\/work\/[^/]+\/[^/]+\//, "")
    .replace(/^.*?\/playwright\//, "playwright/")
    .replace(/^\.\.\//, "playwright/");

const artifactSummary = (attachments = []) =>
  attachments.map((attachment) => {
    const summary = {
      name: attachment.name || null,
      contentType: attachment.contentType || attachment.content_type || null,
      available: Boolean(attachment.path || attachment.url || attachment.blobKey),
    };
    if (includeArtifactUrls) summary.path = attachment.path || attachment.url || null;
    return summary;
  });

const attemptList = (detail) => {
  if (Array.isArray(detail?.overview?.attempts)) return detail.overview.attempts;
  if (Array.isArray(detail?.attempts)) return detail.attempts;
  if (Array.isArray(detail?.otherAttempts)) return detail.otherAttempts;
  return [];
};

const primaryAttemptError = (attempt, detail) => {
  if (attempt?.error) return attempt.error;
  if (Array.isArray(attempt?.errors) && attempt.errors[0]) return attempt.errors[0];
  if (detail?.error) return detail.error;
  return null;
};

const buildFailureDetails = (detail) => {
  const attempts = attemptList(detail);
  const failedAttempts = attempts.filter((attempt) => attempt.status === "failed" || attempt.error || (Array.isArray(attempt.errors) && attempt.errors.length));
  const primaryAttempt = failedAttempts[0] || attempts[0] || null;
  const primaryError = primaryAttemptError(primaryAttempt, detail);
  const stack = primaryError?.stack || primaryError?.message || "";
  const messageLine = firstLineMatching(stack, [/^Error:/, /expect\(.+\) failed/i]) || normalizeWhitespace(stack.split(/\r?\n/)[0] || "");
  const locator = firstLineMatching(stack, [/^Locator:/i, /locator\(/i]);
  const expected = firstLineMatching(stack, [/^Expected:/i]);
  const timeout = firstLineMatching(stack, [/^Timeout:/i, /timeout \d+ms/i]);
  const sourceLocation = extractStackLocation(stack) || (
    primaryError?.location?.file
      ? { file: primaryError.location.file, line: Number(primaryError.location.line) || null, column: Number(primaryError.location.column) || null }
      : null
  );
  const normalizedLocation = sourceLocation
    ? { ...sourceLocation, file: normalizePathForSignature(sourceLocation.file) }
    : null;
  const attachments = primaryAttempt?.attachments || primaryAttempt?.assets || detail?.assets?.attachments || [];
  const artifacts = artifactSummary(attachments);

  return {
    status: detail?.overview?.status || detail?.status || detail?.test?.status || null,
    retries: detail?.overview?.retries ?? detail?.retries ?? null,
    attempts: attempts.length,
    failedAttempts: failedAttempts.length,
    error: {
      message: messageLine || null,
      locator,
      expected,
      timeout,
      sourceLocation: normalizedLocation,
      stackExcerpt: stack ? stack.split(/\r?\n/).slice(0, 18).join("\n") : null,
    },
    artifacts,
    grouping: {
      signatureParts: [
        normalizedLocation ? `${normalizedLocation.file}:${normalizedLocation.line}` : null,
        locator,
        messageLine,
      ].filter(Boolean),
    },
  };
};

const asObject = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});

/** Run-scope debug-bundle pages: { scope: "run", items[], total, nextPage }. */
const fetchRunFailedItems = async (runId) => {
  const bundlePath = publicApiPath("/debug-bundle");
  const items = [];
  let page = 1;
  while (page <= 20) {
    const body = await requestEnvelope(apiUrl(bundlePath, {
      runId,
      page,
      limit: 50,
    }));
    const payload = unwrapPayload(body);
    if (!payload || payload.scope !== "run") {
      throw new Error(`Unexpected debug-bundle payload for run ${runId}: scope=${payload?.scope ?? "missing"}`);
    }
    const pageItems = Array.isArray(payload.items) ? payload.items : [];
    items.push(...pageItems);
    const total = Number(payload.total) || items.length;
    const hasNext = Boolean(payload.nextPage) || page * 50 < total;
    if (!hasNext || pageItems.length === 0) break;
    page += 1;
  }
  return items;
};

const titlePathFromItem = (item) => {
  const testObj = asObject(item?.test);
  const raw = Array.isArray(item?.title_path)
    ? item.title_path
    : Array.isArray(testObj.title_path)
      ? testObj.title_path
      : Array.isArray(testObj.titlePath)
        ? testObj.titlePath
        : Array.isArray(item?.title)
          ? item.title
          : [];
  return raw.map((part) => String(part || "").trim()).filter(Boolean);
};

const titleFromFailureItem = (item) => {
  const testObj = asObject(item?.test);
  const parts = titlePathFromItem(item);
  if (parts.length) {
    return {
      title: parts[parts.length - 1] || null,
      fullTitle: parts.join(" > "),
      titlePath: parts,
    };
  }
  if (typeof item?.title === "string" && item.title.trim()) {
    return { title: item.title.trim(), fullTitle: item.fullTitle || item.title.trim(), titlePath: [item.title.trim()] };
  }
  const title = testObj.title || null;
  return { title, fullTitle: testObj.fullTitle || title, titlePath: title ? [title] : [] };
};

const errorFromFailureItem = (item) => {
  const testObj = asObject(item?.test);
  const raw = item?.error || testObj.error || null;
  if (!raw) return null;
  if (typeof raw === "string") return { message: raw };
  return raw;
};

const collectFailedTestEntries = async (runId) => {
  console.log(`Fetching /debug-bundle for failing cases in run ${runId}.`);
  const failedItems = await fetchRunFailedItems(runId);
  const entries = failedItems
    .filter((item) => (item.status || item.test?.status || "failed") === "failed")
    .map((item) => {
      const titles = titleFromFailureItem(item);
      const titlePath = titles.titlePath;
      const testObj = asObject(item.test);
      const specObj = asObject(item.spec);
      const browserId = firstPresent(
        item.browserId,
        item.groupId,
        item.platform,
        testObj.platform,
        item.environment?.platform,
        titlePath.find((part) => /chromium|firefox|webkit|mobile|desktop/i.test(part)),
      );
      const filePath = firstPresent(
        typeof item.spec === "string" ? item.spec : null,
        specObj.filePath,
        specObj.path,
        item.file_path,
        item.filePath,
        titlePath.find((part) => /\.(spec|test)\.[jt]sx?$/.test(part) || String(part).includes("/")),
      );
      const testCase = {
        id: item.caseId || testObj.caseId || item.id || item.testCaseId || item.pw_test_id || testObj.pw_test_id,
        title: titles.title,
        fullTitle: titles.fullTitle,
        status: item.status || testObj.status || "failed",
        duration: item.duration ?? testObj.duration ?? null,
        browserId: browserId || null,
        metadata: item.metadata || testObj.metadata || {},
        confidence: item.confidence ?? testObj.confidence ?? null,
        error_type: item.error_type ?? item.errorType ?? testObj.error_type ?? null,
        contextError: errorFromFailureItem(item),
      };
      const spec = {
        name: specObj.name || (typeof item.spec === "string" ? item.spec : null),
        fileName: specObj.fileName || null,
        filePath: filePath || null,
      };
      return { spec, testCase };
    });

  return { entries };
};

const summarizeCandidate = (run, spec, testCase) => {
  const candidate = {
    run: {
      id: run.id || run._id,
      counter: run.counter,
      url: runUrl(run),
      startTime: run.startTime,
      status: run.status,
      branch: runBranch(run),
      environment: runEnvironment(run),
      commit: run?.metadata?.git?.commit?.hash || null,
      repository: run?.metadata?.git?.repository?.name || null,
      ci: githubCiMetadata(run),
      tags: uniqueValues(run?.tags, run?.metadata?.tags, run?.metadata?.test?.customTags),
    },
    spec: {
      name: spec.name || null,
      fileName: spec.fileName || null,
      filePath: spec.filePath || null,
    },
    testCase: {
      id: testCase.id || testCase._id,
      url: testCaseUrl(run, testCase),
      title: testCase.title,
      fullTitle: testCase.fullTitle,
      status: testCase.status,
      duration: testCase.duration,
      browserId: testCase.browserId || null,
      tags: testCase.metadata?.tags || [],
      confidence: testCase.confidence ?? null,
      error_type: testCase.error_type ?? testCase.errorType ?? null,
      metadata: testCase.metadata || {},
    },
  };

  if (testCase.contextError) {
    candidate.details = buildFailureDetails({ error: testCase.contextError, status: testCase.status });
  }

  return candidate;
};

const passesRunFilters = (run) => {
  const startTime = new Date(run.startTime);
  if (!Number.isFinite(startTime.getTime())) return false;
  if (!explicitCountersOnly && startTime < since) return false;
  if (run.status && !FAILED_RUN_STATUSES.has(run.status)) return false;
  if ((run.testStats?.failed ?? 0) <= 0) return false;
  if (testdinoBranch && runBranch(run) !== testdinoBranch) return false;
  if (testdinoEnvironment && runEnvironment(run) !== testdinoEnvironment) return false;
  return true;
};

const listRecentFailedRuns = async () => {
  const listPath = publicApiPath("/test-runs");
  const runs = [];
  let page = 1;

  while (runs.length < maxRuns) {
    const { data, pagination } = await requestPage(apiUrl(listPath, {
      page,
      limit: LIST_PAGE_LIMIT,
      status: "failed,interrupted,incomplete",
      sort: "counter_desc",
      start_date: since.toISOString(),
      end_date: until.toISOString(),
      branch: testdinoBranch || undefined,
      environment: testdinoEnvironment || undefined,
    }));
    runs.push(...data.map(normalizeRun));
    if (!pagination.hasNext || data.length === 0) break;
    page += 1;
    if (page > 50) break;
  }

  return runs.slice(0, maxRuns);
};

const main = async () => {
  console.log(
    `Using TestDino API rate limit of ${testDinoRequestsPerMinute} request(s)/minute ` +
      `(${testDinoRequestSpacingMs}ms spacing).`,
  );

  const listPath = publicApiPath("/test-runs");
  const runByKey = new Map();
  const addRun = (run) => {
    const key = runKey(run);
    if (key) runByKey.set(key, run);
  };

  if (explicitCountersOnly) {
    let completedCounterSearches = 0;
    for (const counter of explicitCounters) {
      const searchRuns = await requestJson(apiUrl(listPath, { search: counter, limit: 10 }));
      for (const run of Array.isArray(searchRuns) ? searchRuns : []) {
        if (Number(run.counter) === counter) addRun(normalizeRun(run));
      }
      completedCounterSearches += 1;
      console.log(
        `Completed TestDino explicit counter search ${completedCounterSearches}/${explicitCounters.length}: ${counter}.`,
      );
    }
  } else {
    const runs = await listRecentFailedRuns();
    for (const run of runs) addRun(run);
    console.log(`Listed ${runs.length} failed TestDino run(s) (pagination complete; no counter-gap search).`);
  }

  const recentRuns = [...runByKey.values()].filter(passesRunFilters);
  console.log(`Selected ${recentRuns.length} recent failed TestDino run(s) after filters.`);
  const candidates = [];
  const inspectedRuns = [];

  for (let runIndex = 0; runIndex < recentRuns.length; runIndex += 1) {
    const run = recentRuns[runIndex];
    const runId = run.id || run._id;
    if (!runId) continue;

    const candidatesBeforeRun = candidates.length;
    console.log(
      `Inspecting TestDino run ${runIndex + 1}/${recentRuns.length}: ` +
        `counter ${run.counter ?? "unknown"}.`,
    );
    inspectedRuns.push({
      id: runId,
      counter: run.counter,
      startTime: run.startTime,
      failed: run.testStats?.failed ?? 0,
    });

    const { entries: failedEntries } = await collectFailedTestEntries(runId);
    for (const { spec, testCase } of failedEntries) {
      candidates.push(summarizeCandidate(run, spec, testCase));
    }
    console.log(
      `Run ${run.counter ?? "unknown"} added ${candidates.length - candidatesBeforeRun} candidate(s). ` +
        `Total candidates: ${candidates.length}.`,
    );
  }

  const slackThreadMetadata = await attachSlackThreadMetadata(candidates);

  const output = {
    generatedAt: new Date().toISOString(),
    source: "testdino-public-api",
    apiBasePath: `${TESTDINO_BASE_URL}${PUBLIC_API_PREFIX}`,
    repository: GITHUB_REPOSITORY || null,
    workflowRunId: GITHUB_RUN_ID || null,
    workflowSha: GITHUB_SHA || null,
    projectId: TESTDINO_PROJECT_ID,
    orgId: testdinoOrgId,
    filters: {
      lookbackHours,
      since: since.toISOString(),
      until: until.toISOString(),
      maxRuns,
      branch: testdinoBranch || null,
      environment: testdinoEnvironment || null,
      explicitCounters,
      explicitCountersOnly,
      includeArtifactUrls,
      requestsPerMinute: testDinoRequestsPerMinute,
    },
    inspectedRuns,
    slackThreadCount: slackThreadMetadata.count,
    slackThreads: slackThreadMetadata.threadsByRunId,
    count: candidates.length,
    candidates,
  };

  const outputPath = assertInsideHealingDir(TESTDINO_OUTPUT_PATH);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n");

  console.log(`Inspected ${inspectedRuns.length} failed recent run(s).`);
  console.log(`Found ${candidates.length} failed TestDino candidate(s).`);
  console.log(`Attached ${slackThreadMetadata.count} Slack thread metadata record(s).`);
  console.log(`Wrote ${path.relative(process.cwd(), outputPath) || outputPath}.`);
};

main().catch((error) => {
  console.error(`Failed to find TestDino healing candidates: ${error.message}`);
  process.exit(1);
});
