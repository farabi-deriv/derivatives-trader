#!/usr/bin/env node
/**
 * Build one eval case from the PR the healer actually opened.
 *
 *   node eval/tools/build-case.mjs --pr 3259 --id dup-coin-picker-3259 \
 *     --discoverable 3009,3187 --mcp /tmp/mcp-3259.json
 *
 * Everything the case replays is recovered from real history:
 *
 *   checkoutSha   the PR's base commit, so the worktree is the tree the healer
 *                 saw. Never `main` today — the corpus was wrong about two PRs
 *                 precisely because it was judged against a later tree.
 *   IDs           projectId / testcase_id / TestDino run / failing workflow run
 *                 and group id, lifted from the healer's own CI job log.
 *   gh fixtures   real PRs from the window, with the source PR withheld unless
 *                 the case declares it discoverable.
 *   evidence      screenshot.png / error-context.md fetched from the signed
 *                 TestDino attachment URLs carried in the MCP payload.
 *
 * The MCP payload has to be captured out-of-band (`--mcp`) because the TestDino
 * MCP needs a PAT this repo does not store. Its signed URLs expire in minutes,
 * so capture and build in the same sitting.
 */
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveInside } from "../lib/paths.mjs";

const REPO = "deriv-com/home-app";
const evalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const casesRoot = path.join(evalRoot, "cases");
const logCache = path.join(evalRoot, ".heal-logs");

const die = (message) => {
  console.error(message);
  process.exit(1);
};

/** Case directory under `cases/`; refuses `--id` values that escape the corpus root. */
export const resolveCaseDir = (id, root = casesRoot) => {
  const caseDir = resolveInside(root, id);
  if (!caseDir || caseDir === path.resolve(root)) {
    throw new Error(`--id must resolve under cases/ (got ${JSON.stringify(id)})`);
  }
  return caseDir;
};

const sh = (command, { allowFail = false, maxBuffer = 64 * 1024 * 1024 } = {}) => {
  const result = childProcess.spawnSync("bash", ["-lc", command], { encoding: "utf8", maxBuffer });
  if (result.status !== 0 && !allowFail) {
    die(`command failed: ${command}\n${result.stderr || result.stdout}`);
  }
  return result.stdout || "";
};

const ghJson = (args, fallback = null) => {
  const out = sh(`gh ${args}`, { allowFail: true }).trim();
  if (!out) return fallback;
  try {
    return JSON.parse(out);
  } catch {
    return fallback;
  }
};

export const parseArgs = (argv) => {
  const args = { noise: 12 };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
    args[key] = value;
  }
  return args;
};

const numberList = (value) =>
  String(value || "")
    .split(",")
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter(Number.isFinite);

// ---------------------------------------------------------------------------
// Redaction. Fixtures are committed, so nothing that can authenticate or
// identify may survive into them.
// ---------------------------------------------------------------------------

const SAS_QUERY = /\?[^"'\s]*\b(?:sig|se|sv|skoid|sktid|sks|skt|ske|skv|st|sp|sr|spr|rsct)=[^"'\s]*/gi;

export const redact = (text) =>
  String(text ?? "")
    // Azure/TestDino SAS: strip the whole query, keep the blob path as evidence
    // of where it came from.
    .replace(SAS_QUERY, "?<redacted-sas>")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "<redacted-email>")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "<redacted-key>")
    .replace(/\bgh[pousr]_[A-Za-z0-9]{16,}\b/g, "<redacted-token>")
    .replace(/\b(Bearer|token|authorization)\s+[A-Za-z0-9._-]{12,}/gi, "$1 <redacted-token>")
    .replace(/\b\+?\d[\d\s().-]{8,}\d\b/g, (match) => (/\d{7,}/.test(match.replace(/\D/g, "")) ? "<redacted-phone>" : match));

export const redactDeep = (value) => {
  if (typeof value === "string") return redact(value);
  if (Array.isArray(value)) return value.map(redactDeep);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = redactDeep(item);
    return out;
  }
  return value;
};

const writeJson = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

const writeText = (filePath, text) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text.endsWith("\n") ? text : `${text}\n`);
};

// ---------------------------------------------------------------------------
// Heal job log
// ---------------------------------------------------------------------------

/** Healing runs are twice daily; the PR's own run is the last one before it. */
export const findHealJobId = (pr) => {
  const fromBody = String(pr.body || "").match(/actions\/runs\/(\d+)\/job\/(\d+)/);
  if (fromBody) return { runId: fromBody[1], jobId: fromBody[2] };

  const runs = ghJson(
    `run list --repo ${REPO} --workflow playwright-healing.yaml --limit 80 --json databaseId,createdAt`,
    [],
  );
  const created = Date.parse(pr.createdAt);
  const candidate = runs
    .filter((run) => Date.parse(run.createdAt) <= created)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  if (!candidate) return null;

  const jobs = ghJson(`api repos/${REPO}/actions/runs/${candidate.databaseId}/jobs --paginate`, { jobs: [] });
  // Job name is "Heal: <error title>"; the PR title is
  // "Playwright Auto Healer Fix: <error title>".
  const errorTitle = String(pr.title || "").replace(/^Playwright Auto Healer Fix:\s*/, "").trim();
  const key = errorTitle.slice(0, 40).toLowerCase();
  const job = (jobs.jobs || []).find((item) => String(item.name || "").toLowerCase().includes(key));
  return job ? { runId: String(candidate.databaseId), jobId: String(job.id) } : null;
};

export const fetchHealLog = (jobId) => {
  fs.mkdirSync(logCache, { recursive: true });
  const cached = path.join(logCache, `job-${jobId}.log`);
  if (fs.existsSync(cached) && fs.statSync(cached).size > 0) return fs.readFileSync(cached, "utf8");
  const text = sh(`gh api repos/${REPO}/actions/jobs/${jobId}/logs --allow-escape-sequences`);
  fs.writeFileSync(cached, text);
  return text;
};

const firstMatch = (text, pattern) => text.match(pattern)?.[1] || "";

const allMatches = (text, pattern) => [...new Set([...String(text).matchAll(pattern)].map((m) => m[1]))];

/**
 * Everything the replay needs to look like the original run, read out of the
 * healer's own log rather than guessed.
 */
export const extractIdsFromLog = (logText) => ({
  projectId: firstMatch(logText, /(project_[0-9a-f]{20,})/),
  orgId: firstMatch(logText, /(org_[0-9a-f]{20,})/),
  testcaseIds: allMatches(logText, /\b([0-9a-f]{20}-[0-9a-f]{20})\b/g),
  testRunIds: allMatches(logText, /\b(test_run_[0-9a-f]{20,})\b/g),
  // The healing dir lists every group, so a bare `ui-change-*` match is usually a sibling
  // group. Only the one under `.healing/groups/<NNN>-` is the group this job actually healed.
  groupIds: allMatches(logText, /\.healing\/groups\/\d{3}-(ui-change-[0-9a-f]{12})/g),
  candidateFiles: allMatches(logText, /\b(\d{3}-ui-change-[0-9a-f]{12}-[a-z0-9-]+\.json)\b/g),
  workflowRunIds: allMatches(logText, /(?:gh run download|actions\/runs\/)\s*(\d{8,})/g),
  model: firstMatch(logText, /"model"\s*:\s*"([^"]+)"/),
});

// ---------------------------------------------------------------------------
// gh fixtures
// ---------------------------------------------------------------------------

const PR_FIELDS = "number,title,state,body,createdAt,closedAt,mergedAt,baseRefName,headRefName";

/**
 * Noise matters: a pr-list holding only the answer lets the healer "find a
 * duplicate" without discriminating. Real PRs merged around the healing date
 * are the noise, and the source PR is withheld unless finding it IS the case.
 */
export const buildPrList = ({ pr, discoverable, noise, exclude = [] }) => {
  const before = String(pr.createdAt).slice(0, 10);
  const recent = ghJson(
    `pr list --repo ${REPO} --state all --limit 120 --json ${PR_FIELDS} --search "created:<=${before} sort:created-desc"`,
    [],
  );
  const excluded = new Set([pr.number, ...exclude]);
  const rows = [];
  for (const number of discoverable) {
    const view = ghJson(`pr view ${number} --repo ${REPO} --json ${PR_FIELDS}`, null);
    if (view) rows.push(view);
  }
  const listedNumbers = new Set(rows.map((item) => item.number));
  for (const item of recent) {
    if (rows.length >= noise + discoverable.length) break;
    if (excluded.has(item.number) || listedNumbers.has(item.number)) continue;
    rows.push(item);
    listedNumbers.add(item.number);
  }
  return rows
    .map((item) => redactDeep(item))
    .sort((a, b) => b.number - a.number);
};

const writeGhFixtures = (fixturesDir, { pr, discoverable, noise, workflowRunId, exclude }) => {
  const list = buildPrList({ pr, discoverable, noise, exclude });
  writeJson(path.join(fixturesDir, "gh/pr-list.json"), list);

  for (const number of discoverable) {
    const view = ghJson(`pr view ${number} --repo ${REPO} --json ${PR_FIELDS}`, null);
    if (view) writeJson(path.join(fixturesDir, `gh/pr-view-${number}.json`), redactDeep(view));
    const diff = sh(`gh pr diff ${number} --repo ${REPO}`, { allowFail: true });
    if (diff.trim()) writeText(path.join(fixturesDir, `gh/pr-diff-${number}.diff`), redact(diff));
  }

  if (workflowRunId) {
    const artifacts = ghJson(`api repos/${REPO}/actions/runs/${workflowRunId}/artifacts --paginate`, null);
    if (artifacts) {
      writeJson(path.join(fixturesDir, "gh/artifacts.json"), {
        total_count: artifacts.total_count,
        artifacts: (artifacts.artifacts || []).map((item) => ({
          id: item.id,
          name: item.name,
          expired: item.expired,
          size_in_bytes: item.size_in_bytes,
        })),
      });
    }
  }

  const releases = ghJson(`release list --repo ${REPO} --limit 10 --json tagName,publishedAt,name`, []);
  writeJson(path.join(fixturesDir, "gh/releases.json"), releases);
  return list;
};

// ---------------------------------------------------------------------------
// TestDino MCP payload + evidence
// ---------------------------------------------------------------------------

const testcaseItem = (payload) => payload?.get_testcase_details?.items?.[0] || null;

const stripAnsi = (text) => String(text || "").replace(/\u001b\[[0-9;]*m/g, "");

/**
 * The healer reads the LAST attempt's evidence — the one the run finally failed
 * on. Taking attempt 0 would hand the eval a screenshot of a state the healer
 * never saw.
 */
export const attachmentUrls = (payload) => {
  const item = testcaseItem(payload);
  const evidence = Array.isArray(item?.evidence) ? item.evidence : [];
  const pick = (name) =>
    evidence
      .filter((entry) => entry.name === name && entry.url)
      .sort((a, b) => (a.attempt_index ?? 0) - (b.attempt_index ?? 0))
      .pop()?.url || "";
  return { screenshot: pick("screenshot"), "error-context": pick("error-context") };
};

export const errorTextFrom = (payload) => {
  const item = testcaseItem(payload);
  const attempts = Array.isArray(item?.attempts) ? item.attempts : [];
  const failed = attempts.filter((attempt) => (attempt.errors || []).length > 0).pop();
  return stripAnsi(failed?.errors?.[0]?.message || "").trim();
};

/**
 * The candidate slice the healing workflow hands the fixer. Rebuilt from the
 * TestDino record rather than invented, so the group id, TestDino URL and spec
 * path all resolve to the run that actually failed.
 */
export const groupSliceFrom = (payload, { groupId, orgId, projectId }) => {
  const item = testcaseItem(payload);
  if (!item) return null;
  const specFile = item.location?.file || item.title_path?.[2] || "";
  const url = `https://app.testdino.com/${orgId}/projects/${projectId}/test-runs/${item.testrun_id}/${item.pw_test_id}`;
  return {
    id: groupId,
    candidates: [
      {
        testCase: { title: item.title, url, id: item.pw_test_id },
        spec: { filePath: specFile.startsWith("playwright/") ? specFile : `playwright/tests/${specFile}` },
        error: errorTextFrom(payload).split("\n")[0].replace(/^Error:\s*/, ""),
        run: { id: item.testrun_id },
      },
    ],
  };
};

const download = async (url, destPath) => {
  const response = await fetch(url);
  if (!response.ok) return false;
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, buffer);
  return true;
};

const ingestMcp = async (fixturesDir, mcpPath, sliceMeta) => {
  const raw = JSON.parse(fs.readFileSync(mcpPath, "utf8"));
  const urls = attachmentUrls(raw);

  const errorText = errorTextFrom(raw);
  if (errorText) writeText(path.join(fixturesDir, "error.txt"), redact(errorText));
  const slice = groupSliceFrom(raw, sliceMeta);
  if (slice) writeJson(path.join(fixturesDir, "group-slice.json"), redactDeep(slice));

  if (urls.screenshot) {
    const ok = await download(urls.screenshot, path.join(fixturesDir, "screenshot.png"));
    if (!ok) console.error("  ! screenshot URL expired — recapture the MCP payload and rerun");
  }
  if (urls["error-context"]) {
    const tmp = path.join(fixturesDir, ".error-context.raw");
    if (await download(urls["error-context"], tmp)) {
      writeText(path.join(fixturesDir, "error-context.md"), redact(fs.readFileSync(tmp, "utf8")));
    } else {
      console.error("  ! error-context URL expired — recapture the MCP payload and rerun");
    }
    fs.rmSync(tmp, { force: true });
  }

  // Signed URLs are stripped only after the evidence is on disk; the intercept
  // must never hand the fixer a live credential.
  for (const tool of ["get_testcase_details", "debug_testcase", "get_run_details", "list_testcase"]) {
    if (raw[tool] === undefined) continue;
    writeJson(path.join(fixturesDir, `mcp/${tool}.json`), redactDeep(raw[tool]));
  }
  return urls;
};

// ---------------------------------------------------------------------------

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (!args.pr || !args.id) {
    die("usage: build-case.mjs --pr <number> --id <case-id> [--discoverable a,b] [--mcp file.json] [--noise 12]");
  }
  const prNumber = Number.parseInt(args.pr, 10);
  const caseDir = resolveCaseDir(args.id);
  const fixturesDir = path.join(caseDir, "fixtures");
  const discoverable = numberList(args.discoverable);

  const pr = ghJson(`pr view ${prNumber} --repo ${REPO} --json ${PR_FIELDS},baseRefOid`, null);
  if (!pr) die(`cannot read PR ${prNumber}`);

  const heal = args["heal-job"]
    ? { runId: args["heal-run"] || "", jobId: args["heal-job"] }
    : findHealJobId(pr);
  if (!heal) die(`cannot locate the healer job for PR ${prNumber} — pass --heal-job <id>`);

  console.error(`PR ${prNumber} -> heal job ${heal.jobId} (run ${heal.runId})`);
  const logText = fetchHealLog(heal.jobId);
  const ids = extractIdsFromLog(logText);
  const workflowRunId = args["workflow-run"] || ids.workflowRunIds.find((item) => item !== heal.runId) || "";

  console.error(
    `  project=${ids.projectId} group=${ids.groupIds[0] || "?"} testcases=${ids.testcaseIds.length} pwRun=${workflowRunId || "?"}`,
  );

  fs.mkdirSync(fixturesDir, { recursive: true });
  writeJson(path.join(fixturesDir, "meta.json"), {
    checkoutSha: pr.baseRefOid,
    sourcePrs: [prNumber],
    healJobId: heal.jobId,
    healRunId: heal.runId,
    workflowRunId,
    projectId: ids.projectId,
    groupId: ids.groupIds[0] || "",
    model: ids.model,
  });

  writeGhFixtures(fixturesDir, {
    pr,
    discoverable,
    noise: Number(args.noise) || 12,
    workflowRunId,
    exclude: numberList(args.exclude),
  });

  if (args.mcp) {
    const urls = await ingestMcp(fixturesDir, args.mcp, {
      groupId: ids.groupIds[0] || args.id,
      orgId: ids.orgId,
      projectId: ids.projectId,
    });
    console.error(`  evidence: screenshot=${Boolean(urls.screenshot)} error-context=${Boolean(urls["error-context"])}`);
  } else {
    console.error("  ! no --mcp payload: mcp/*.json, evidence and group-slice.json were not written");
  }

  if (args["gold-pr"]) {
    const gold = sh(`gh pr diff ${args["gold-pr"]} --repo ${REPO}`, { allowFail: true });
    if (gold.trim()) writeText(path.join(fixturesDir, "gold.diff"), redact(gold));
  }

  const casePath = path.join(caseDir, "case.json");
  if (!fs.existsSync(casePath)) {
    writeJson(casePath, {
      id: args.id,
      sourcePrs: [prNumber],
      checkoutSha: pr.baseRefOid,
      discoverablePrs: discoverable,
      evidenceGrade: "screenshot",
      coversRules: ["TODO"],
      patch_scored: false,
      cliMode: "pass",
      expected: { artifact: "no-change" },
      notes: "TODO",
      diagnosis: {
        rootCause: "TODO",
        evidence: "heal_log",
        healJobId: heal.jobId,
        proof: "TODO",
        shouldHaveDone: "TODO",
      },
    });
    console.error(`  wrote ${path.relative(evalRoot, casePath)} (fill in coversRules / diagnosis)`);
  }

};

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch((error) => die(error.stack || error.message));
}
