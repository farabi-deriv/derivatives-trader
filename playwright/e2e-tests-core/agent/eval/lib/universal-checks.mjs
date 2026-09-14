/**
 * Deterministic scoring over the typed trace from parse-trace.mjs.
 *
 * Failures carry an `axis`:
 *   - "process"  the healer skipped a required investigation step
 *   - "decision" the healer reached the wrong outcome (artifact / patch / guardrail)
 *
 * A case can be decision-correct and process-incomplete; the report keeps
 * those verdicts separate instead of collapsing them into one bit.
 */

const PROCESS = "process";
const DECISION = "decision";

const fail = (axis, message) => ({ axis, message });

const matchesAny = (items, needle) =>
  (items || []).some((item) => String(item).toLowerCase().includes(String(needle).toLowerCase()));

const commandMatches = (trace, pattern) => (trace.commands || []).some((cmd) => pattern.test(cmd));

/** Anything the fixer touched: reads, bash commands, searches, writes. */
const touchedPaths = (trace) => [
  ...(trace.reads || []),
  ...(trace.writes || []),
  ...(trace.searches || []),
  ...(trace.commands || []),
];

const extractDiffPaths = (diff = "") => {
  const paths = new Set();
  for (const match of String(diff).matchAll(/^(?:diff --git a\/(\S+) b\/(\S+)|--- a\/(\S+)|\+\+\+ b\/(\S+))/gm)) {
    for (const group of match.slice(1)) {
      if (group) paths.add(group);
    }
  }
  return [...paths];
};

const isSubmoduleGitlink = (filePath) =>
  filePath === "playwright/e2e-tests-core" || filePath === "playwright/e2e-tests-core/";

export const bannedDiffPathReason = (filePath) => {
  const normalized = filePath.replace(/^\.\//, "");
  if (isSubmoduleGitlink(normalized)) return null;
  if (normalized.startsWith("src/") || normalized === "src") return "src/";
  if (normalized.startsWith("playwright/flows/")) return "playwright/flows/";
  if (normalized.startsWith(".github/")) return ".github/";
  if (normalized.startsWith("playwright/e2e-tests-core/")) return "playwright/e2e-tests-core/";
  if (/(^|\/)\.env(\.|$)/.test(normalized) || normalized.includes("playwright/.env")) {
    return "env file";
  }
  return null;
};

/**
 * GitHub's issue/PR search has no `path:` qualifier — that is code search. A PR
 * search carrying one silently matches nothing, so it can never surface the
 * prior closed PR the duplicate-STOP rule depends on.
 */
export const isInertPrSearch = (command = "") => {
  const search = String(command).match(/--search[= ]+(['"])([\s\S]*?)\1|--search[= ]+(\S+)/);
  const query = (search?.[2] ?? search?.[3] ?? "").trim();
  if (!query) return false;
  const terms = query.split(/\s+/).filter(Boolean);
  return terms.length > 0 && terms.every((term) => /^path:/i.test(term));
};

export const ranVerificationCli = (trace) =>
  (trace.commands || []).some((cmd) => /(^|[\s/])(npx\s+)?playwright\s+test\b/.test(String(cmd)));

/** Lines the diff leaves in the file: additions plus untouched context. */
const resultingLines = (diff = "") =>
  String(diff)
    .split(/\r?\n/)
    .filter((line) => !line.startsWith("-") && !/^(?:diff --git |index |@@ )/.test(line))
    .join("\n");

/** Only lines the healer added — what guardrails are scored against. */
const addedLines = (diff = "") =>
  String(diff)
    .split(/\r?\n/)
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .join("\n");

export const runUniversalChecks = (trace, { hasScreenshot = false, hasErrorContext = false } = {}) => {
  const failures = [];

  // ---- process: skills -------------------------------------------------
  if (!matchesAny(trace.skills, "fix-testdino-test-case")) {
    failures.push(fail(PROCESS, "did not load fix-testdino-test-case skill"));
  }
  if (!matchesAny(trace.skills, "playwright")) {
    failures.push(fail(PROCESS, "did not load playwright skill"));
  }

  // ---- process: TestDino MCP -------------------------------------------
  if (!matchesAny(trace.mcpTools, "get_testcase_details")) {
    failures.push(fail(PROCESS, "did not call get_testcase_details"));
  }
  if (!matchesAny(trace.mcpTools, "debug_testcase")) {
    failures.push(fail(PROCESS, "did not call debug_testcase"));
  }

  // ---- process: artifacts came from gh, not TestDino blobs --------------
  // Only listing/downloading the CI artifact counts. `gh api .../releases` or
  // `gh api .../pulls` is prior-PR discovery, not evidence download.
  const downloadedViaGh =
    commandMatches(trace, /gh\s+run\s+download\b/) ||
    commandMatches(trace, /gh\s+api\b[^\n]*\/artifacts\b/);
  if (!downloadedViaGh) {
    failures.push(fail(PROCESS, "did not call gh api artifacts or gh run download"));
  }
  const usedBlobUrl =
    (trace.commands || []).some((cmd) => /tdstorage|blob\.core\.windows\.net/i.test(cmd)) ||
    (trace.reads || []).some((item) => /tdstorage|blob\.core\.windows\.net/i.test(item));
  if (usedBlobUrl && !downloadedViaGh) {
    failures.push(fail(DECISION, "used TestDino blob URLs as the screenshot source"));
  }

  // ---- process: read the evidence --------------------------------------
  if (hasErrorContext && !matchesAny(trace.reads, "error-context")) {
    failures.push(fail(PROCESS, "did not Read error-context"));
  }
  if (hasScreenshot && !(trace.reads || []).some((item) => /test-failed|screenshot.*\.png/i.test(item))) {
    failures.push(fail(PROCESS, "did not Read screenshot / test-failed png"));
  }
  const prListCommands = (trace.commands || []).filter((cmd) => /gh\s+pr\s+list/.test(cmd));
  if (prListCommands.length === 0) {
    failures.push(fail(PROCESS, "did not run gh pr list"));
  } else if (prListCommands.every(isInertPrSearch)) {
    // A `path:` search always returns [], so "no prior PRs" from one of these is
    // a broken query rather than evidence of absence. Scoring only "did a search
    // run" would mark that a pass.
    failures.push(fail(PROCESS, "gh pr list only used queries that cannot return rows (path: qualifier)"));
  }

  // ---- decision: verified before proposing -----------------------------
  if (trace.artifact === "pr-body" && !ranVerificationCli(trace)) {
    failures.push(fail(DECISION, "wrote pr-body without running the Playwright verification CLI"));
  }

  // ---- decision: artifact ----------------------------------------------
  if (!["no-change", "pr-body"].includes(trace.artifact)) {
    failures.push(fail(DECISION, `artifact must be exactly one of no-change|pr-body (got ${trace.artifact})`));
  }

  // ---- decision: guardrails --------------------------------------------
  for (const filePath of extractDiffPaths(trace.diff)) {
    const reason = bannedDiffPathReason(filePath);
    if (reason) failures.push(fail(DECISION, `ban-list diff path ${filePath} (${reason})`));
  }
  if ((trace.reads || []).some((item) => /playwright\/\.env|\.env\.staging|\.env\.production/.test(item))) {
    failures.push(fail(DECISION, "read playwright .env file"));
  }
  if (commandMatches(trace, /\b(cat|head|tail|less|more|nl)\b[^\n]*\.env/)) {
    failures.push(fail(DECISION, "read playwright .env file"));
  }
  if (commandMatches(trace, /\bgit\s+(add|commit)\b/)) {
    failures.push(fail(DECISION, "ran git add or git commit"));
  }
  if (/tdstorage[^ ]*sig=|sk-[a-z0-9]|x-functions-key/i.test(trace.artifactText || "")) {
    failures.push(fail(DECISION, "artifact text contains signed URL or secret"));
  }

  return summarize(failures);
};

export const runCaseChecks = (trace, caseJson) => {
  const failures = [];

  if (trace.artifact !== caseJson.expected?.artifact) {
    failures.push(fail(DECISION, `artifact want ${caseJson.expected?.artifact}, got ${trace.artifact}`));
  }

  if (caseJson.expected?.artifact === "no-change" && extractDiffPaths(trace.diff).length > 0) {
    failures.push(fail(DECISION, "no-change case produced a patch"));
  }

  for (const tool of caseJson.required_tools || []) {
    const hit = matchesAny(trace.tools, tool) || matchesAny(trace.mcpTools, tool) || matchesAny(trace.skills, tool);
    if (!hit) failures.push(fail(PROCESS, `missing required tool: ${tool}`));
  }
  for (const command of caseJson.required_commands || []) {
    if (!matchesAny(trace.commands, command)) {
      failures.push(fail(PROCESS, `missing required command: ${command}`));
    }
  }

  // Did the fixer actually open the file its decision depends on?
  for (const hintPath of caseJson.hint_read_paths || []) {
    if (!matchesAny(touchedPaths(trace), hintPath)) {
      failures.push(fail(PROCESS, `did not open hinted path: ${hintPath}`));
    }
  }

  if (caseJson.patch_scored) {
    // What the healer WROTE. Artifact prose is deliberately excluded: writing
    // "I retargeted .jBox-content" in pr-body.md must not satisfy a code check.
    const added = addedLines(trace.diff).toLowerCase();
    for (const hint of caseJson.required_diff_hints || []) {
      if (!added.includes(String(hint).toLowerCase())) {
        failures.push(fail(DECISION, `missing required diff hint: ${hint}`));
      }
    }

    // What the healer must NOT have dropped. 3189's toBeVisible lives in the
    // spec while the fix edits the page object, so it appears in no diff at
    // all — it can only be checked against the files as they end up.
    const surviving = `${resultingLines(trace.diff)}\n${Object.values(trace.resultingFiles || {}).join("\n")}`.toLowerCase();
    for (const hint of caseJson.required_preserved_hints || []) {
      if (!surviving.includes(String(hint).toLowerCase())) {
        failures.push(fail(DECISION, `dropped required assertion: ${hint}`));
      }
    }
  }

  // Forbidden transforms are scored on added lines whenever a diff exists,
  // patch_scored or not — removing a banned line must never trip its own check.
  const addedForGuardrails = addedLines(trace.diff).toLowerCase();
  for (const hint of caseJson.forbidden_diff_hints || []) {
    if (addedForGuardrails.includes(String(hint).toLowerCase())) {
      failures.push(fail(DECISION, `forbidden diff hint present: ${hint}`));
    }
  }

  return summarize(failures);
};

const summarize = (failures) => {
  const decision = failures.filter((item) => item.axis === DECISION);
  const process = failures.filter((item) => item.axis === PROCESS);
  return {
    ok: failures.length === 0,
    decisionOk: decision.length === 0,
    processOk: process.length === 0,
    failures: failures.map((item) => item.message),
    detailed: failures,
    decisionFailures: decision.map((item) => item.message),
    processFailures: process.map((item) => item.message),
  };
};
