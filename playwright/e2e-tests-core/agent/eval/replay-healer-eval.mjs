#!/usr/bin/env node
/**
 * Healer eval: one LLM fixer session per golden, with intercepted TestDino MCP
 * + gh, home-app at checkoutSha, then deterministic grade + judge.
 *
 *   npm run eval
 *   npm run eval -- --case infra-cfd-nav-3100
 *   npm run eval -- --concurrency 2
 *   npm run eval -- --judge off|report|gate
 *   npm run eval -- --report-from eval/runs/<stamp>
 */
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { blobFromLogAndPrediction } from "./lib/parse-trace.mjs";
import { buildJudgePacket, judgeFix } from "./lib/judge-fix.mjs";
import { createRunDir, writeCaseRunFiles, writeRunReport } from "./lib/report-html.mjs";
import { listCaseDirs, loadCase, scoreCase, validateFixtures } from "./lib/corpus.mjs";
import { HEALING_DIFF_PATHSPEC } from "../scripts/healing-diff-utils.mjs";
import { resolveInside } from "./lib/paths.mjs";

const evalRoot = path.dirname(fileURLToPath(import.meta.url));
const agentDir = path.resolve(evalRoot, "..");
const coreRoot = path.resolve(agentDir, "..");
const healerScript = path.join(agentDir, "scripts/run-healer-agent.sh");
const mcpScript = path.join(evalRoot, "intercept/testdino-mcp.mjs");
const ghIntercept = path.join(evalRoot, "intercept/gh.mjs");

export const EVAL_ALLOWED_TOOLS = [
  "mcp__TestDino__get_testcase_details",
  "mcp__TestDino__debug_testcase",
  "mcp__TestDino__get_run_details",
  "mcp__TestDino__list_testcase",
  "Bash(gh api:*)",
  "Bash(gh run download:*)",
  "Bash(gh pr view:*)",
  "Bash(gh pr diff:*)",
  "Bash(gh pr list:*)",
  "Bash(gh release:*)",
  "Bash(git tag:*)",
  "Bash(git log:*)",
  "Bash(ls:*)",
  "Bash(find:*)",
  "Bash(mkdir:*)",
  // Mirrors DEFAULT_TESTDINO_MCP_ALLOWED_TOOLS in scripts/run-llm-agent.sh.
  // Without these the CLI is denied for every case, which turns Phase 7 into an
  // unconditional "Cannot run CLI" STOP and makes pr-body cases unreachable.
  "Bash(npx playwright test:*)",
  "Bash(node_modules/.bin/playwright:*)",
].join(",");

/**
 * Phase 7 runs a real Playwright suite against staging, which an offline replay
 * cannot do. The shim stands in for it so the gate still fires:
 *
 *   pass    - exits 0 with a Playwright-shaped summary (the default)
 *   blocked - exits 1 the way a missing browser binary does, so a case can test
 *             "Cannot run CLI -> STOP" instead of a pr-body on an unverified fix
 */
export const PLAYWRIGHT_SHIM_MODES = ["pass", "blocked"];

const shimBody = (mode) =>
  mode === "blocked"
    ? [
        'echo "Running 1 test using 1 worker" >&2',
        'echo "" >&2',
        `echo "  Error: browserType.launch: Executable doesn't exist at /root/.cache/ms-playwright/webkit-2140/pw_run.sh" >&2`,
        `echo "  Looks like Playwright Test or Playwright was just installed or updated." >&2`,
        `echo "  Please run the following command to download new browsers: npx playwright install" >&2`,
        "exit 1",
      ]
    : [
        'echo "Running 1 test using 1 worker"',
        'echo ""',
        'echo "  ok 1 [eval] - verification sample (1.2s)"',
        'echo ""',
        'echo "  1 passed (1.4s)"',
        "exit 0",
      ];

export const writePlaywrightShim = (binDir, worktree, mode = "pass") => {
  if (!PLAYWRIGHT_SHIM_MODES.includes(mode)) {
    throw new Error(`cliMode must be one of ${PLAYWRIGHT_SHIM_MODES.join("|")} (got ${mode})`);
  }
  fs.mkdirSync(binDir, { recursive: true });
  const playwrightPath = path.join(binDir, "playwright");
  fs.writeFileSync(playwrightPath, `#!/usr/bin/env bash\n${shimBody(mode).join("\n")}\n`);
  fs.chmodSync(playwrightPath, 0o755);

  // The skill offers `npx playwright test` and `node_modules/.bin/playwright`
  // interchangeably; both have to reach the same shim or the mode is a coin flip.
  // Do not shadow `npx`. Production allowlists `npx playwright test` and
  // `node_modules/.bin/playwright`; both resolve the worktree copy below.
  // A fake npx that 127s everything else made "npx tsc" look like a sandbox bug.
  if (worktree) {
    for (const relative of ["node_modules/.bin", "playwright/node_modules/.bin"]) {
      const localBin = path.join(worktree, relative);
      fs.mkdirSync(localBin, { recursive: true });
      fs.copyFileSync(playwrightPath, path.join(localBin, "playwright"));
      fs.chmodSync(path.join(localBin, "playwright"), 0o755);
    }
  }
  return playwrightPath;
};

export const parseReplayArgs = (argv) => {
  const args = { caseId: "", judge: "report", concurrency: "", reportFrom: "" };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--case") args.caseId = argv[++i] || "";
    else if (token === "--judge") args.judge = argv[++i] || "report";
    else if (token === "--concurrency") args.concurrency = argv[++i] || "";
    else if (token === "--report-from") args.reportFrom = argv[++i] || "";
  }
  if (!["off", "report", "gate"].includes(args.judge)) {
    throw new Error("--judge must be off|report|gate");
  }
  return args;
};

export const resolveConcurrency = (cliValue, env = process.env) => {
  const raw = cliValue != null && String(cliValue).trim() !== "" ? cliValue : env.PW_HEALER_EVAL_CONCURRENCY;
  const n = Number.parseInt(String(raw ?? "2"), 10);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error("PW_HEALER_EVAL_CONCURRENCY / --concurrency must be an integer >= 1");
  }
  return n;
};

export const mapWithConcurrency = async (items, concurrency, mapper) => {
  const limit = Math.max(1, Math.min(Number(concurrency) || 1, items.length || 1));
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  };
  const workers = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
};

let gitWorktreeChain = Promise.resolve();

export const withGitWorktreeLock = async (fn) => {
  const previous = gitWorktreeChain;
  let release;
  gitWorktreeChain = new Promise((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
};

const stripQuotes = (value) => {
  const text = String(value || "").trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1);
  }
  return text;
};

export const parseDotEnv = (text) => {
  const parsed = {};
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const withoutExport = line.startsWith("export ") ? line.slice(7).trim() : line;
    const eq = withoutExport.indexOf("=");
    if (eq <= 0) continue;
    const key = withoutExport.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    parsed[key] = stripQuotes(withoutExport.slice(eq + 1));
  }
  return parsed;
};

export const applyDotEnvFile = (filePath, env = process.env) => {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;
  const parsed = parseDotEnv(fs.readFileSync(filePath, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    if (env[key] == null || env[key] === "") env[key] = value;
  }
  return true;
};

export const loadAgentEnv = (fromAgentDir = agentDir, env = process.env) =>
  applyDotEnvFile(path.join(fromAgentDir, ".env"), env);

export const claudeCliProblem = (fromAgentDir = agentDir) => {
  const bin = path.join(fromAgentDir, "node_modules/.bin/claude");
  if (!fs.existsSync(bin)) {
    return "Missing Claude CLI at agent/node_modules/.bin/claude. From playwright/e2e-tests-core/agent run: npm ci";
  }
  try {
    const real = fs.realpathSync(bin);
    const size = fs.statSync(real).size;
    // postinstall always writes bin/claude.exe; after install that file is the
    // native Mach-O/ELF binary (~hundreds of MB). The Windows stub is <4KB.
    if (process.platform !== "win32" && /\.exe$/i.test(real) && size < 4096) {
      return "Claude CLI is the Windows stub (claude.exe) on this Mac. From playwright/e2e-tests-core/agent run: node node_modules/@anthropic-ai/claude-code/install.cjs";
    }
  } catch {
    return "Claude CLI symlink is broken. From playwright/e2e-tests-core/agent run: npm ci";
  }
  return null;
};

const clipLog = (text, max = 1600) => {
  const clean = String(text || "").trim();
  if (clean.length <= max) return clean;
  return clean.slice(-max);
};

export const resolveHomeAppRoot = (fromAgentDir = agentDir, env = process.env) => {
  if (env.HOME_APP_ROOT) return path.resolve(env.HOME_APP_ROOT);
  const candidate = path.resolve(fromAgentDir, "../../..");
  if (fs.existsSync(path.join(candidate, "playwright/e2e-tests-core"))) return candidate;
  throw new Error("Set HOME_APP_ROOT to the home-app clone (eval replay checks out case.checkoutSha).");
};

export const writeCandidatesFile = (groupSlicePath, destPath) => {
  const slice = JSON.parse(fs.readFileSync(groupSlicePath, "utf8"));
  const candidates = Array.isArray(slice.candidates) ? slice.candidates : [];
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(
    destPath,
    `${JSON.stringify({ ...slice, count: candidates.length, candidates }, null, 2)}\n`,
  );
};

const copyFilter = (fromRoot) => (src) => {
  const base = path.basename(src);
  if (base === "node_modules" || base === ".git") return false;
  if (base === ".env" || (base.startsWith(".env.") && base !== ".env.example")) return false;
  const rel = path.relative(fromRoot, src);
  if (!rel || rel.startsWith("..")) return true;
  const parts = rel.split(path.sep);
  if (parts.includes("node_modules") || parts.includes(".git")) return false;
  if (parts[0] === "eval") return false;
  return true;
};

export const overlayCurrentHealer = (sourceCore, destCore) => {
  fs.rmSync(destCore, { recursive: true, force: true });
  fs.mkdirSync(destCore, { recursive: true });
  const agentFrom = path.join(sourceCore, "agent");
  const skillsFrom = path.join(sourceCore, "skills");
  fs.cpSync(agentFrom, path.join(destCore, "agent"), { recursive: true, filter: copyFilter(agentFrom) });
  if (fs.existsSync(skillsFrom)) {
    fs.cpSync(skillsFrom, path.join(destCore, "skills"), { recursive: true, filter: copyFilter(skillsFrom) });
  }
};

export const writeGhShim = (binDir, interceptPath = ghIntercept) => {
  fs.mkdirSync(binDir, { recursive: true });
  const ghPath = path.join(binDir, "gh");
  fs.writeFileSync(
    ghPath,
    `#!/usr/bin/env bash\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(interceptPath)} "$@"\n`,
  );
  fs.chmodSync(ghPath, 0o755);
  return ghPath;
};

export const writeMcpConfig = (filePath, { caseDir, mcpScriptPath = mcpScript } = {}) => {
  fs.writeFileSync(
    filePath,
    `${JSON.stringify(
      {
        mcpServers: {
          TestDino: {
            command: process.execPath,
            args: [mcpScriptPath],
            env: {
              EVAL_CASE_DIR: caseDir,
              TESTDINO_PAT: "eval",
            },
          },
        },
      },
      null,
      2,
    )}\n`,
  );
};

export const readHealingArtifact = (healingDir) => {
  const names = ["pr-body.md", "no-change.md"];
  for (const name of names) {
    for (const folder of [healingDir, path.join(healingDir, "fix")]) {
      const filePath = path.join(folder, name);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const text = fs.readFileSync(filePath, "utf8");
        if (text.trim()) {
          return { artifact: name.replace(".md", ""), artifactText: text, writes: [filePath] };
        }
      }
    }
  }
  return { artifact: "none", artifactText: "", writes: [] };
};

const MAX_RESULTING_FILE_CHARS = 200_000;

/**
 * Post-run contents of the files the case cares about: everything the patch
 * touched plus every hint_read_path. `required_preserved_hints` are scored
 * against these, because an assertion the fix must keep can live in a file the
 * diff never touches.
 */
export const collectResultingFiles = (worktree, caseJson, diff = "") => {
  const paths = new Set(caseJson.hint_read_paths || []);
  for (const match of String(diff).matchAll(/^diff --git a\/(\S+) b\/(\S+)/gm)) {
    paths.add(match[2] || match[1]);
  }
  const files = {};
  for (const relative of paths) {
    const filePath = resolveInside(worktree, relative);
    if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) continue;
    files[relative] = fs.readFileSync(filePath, "utf8").slice(0, MAX_RESULTING_FILE_CHARS);
  }
  return files;
};

export const gitDiffWorktree = (worktree) => {
  const result = childProcess.spawnSync("git", ["diff", "--binary", "--", ...HEALING_DIFF_PATHSPEC], {
    cwd: worktree,
    encoding: "utf8",
  });
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`git diff failed: ${result.stderr || result.status}`);
  }
  return result.stdout || "";
};

export const replayExitCode = (rows, judgeMode) => {
  if (rows.some((row) => !row.ok)) return 1;
  if (judgeMode === "gate" && rows.some((row) => row.judge && row.judge.pass === false)) return 1;
  return 0;
};

export const readSavedCaseOutcome = (caseRunDir) => {
  const logPath = path.join(caseRunDir, "fixer.log");
  if (!fs.existsSync(logPath)) {
    const started = fs.existsSync(path.join(caseRunDir, "stream.jsonl"));
    return { complete: false, started, logText: "", artifact: "none", artifactText: "", diff: "" };
  }
  const logText = fs.readFileSync(logPath, "utf8");
  let artifact = "none";
  let artifactText = "";
  for (const name of ["no-change.md", "pr-body.md"]) {
    const filePath = path.join(caseRunDir, name);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      artifact = name.replace(".md", "");
      artifactText = fs.readFileSync(filePath, "utf8");
      break;
    }
  }
  const diffPath = path.join(caseRunDir, "got.diff");
  const diff = fs.existsSync(diffPath) ? fs.readFileSync(diffPath, "utf8") : "";
  const filesPath = path.join(caseRunDir, "resulting-files.json");
  const resultingFiles = fs.existsSync(filesPath) ? JSON.parse(fs.readFileSync(filesPath, "utf8")) : {};
  return { complete: true, started: true, logText, artifact, artifactText, diff, resultingFiles };
};

const judgeTrace = async (loaded, trace, { judgeMode, env }) => {
  if (judgeMode === "off") return null;
  const goldPath = path.join(loaded.fixturesDir, "gold.diff");
  const goldDiff = fs.existsSync(goldPath) ? fs.readFileSync(goldPath, "utf8") : "";
  const packet = buildJudgePacket(loaded.json, trace, goldDiff);
  // Retry once: a lost verdict used to read as a FAIL against the healer. Live
  // replay now judges only after every fixer has finished, so the proxy is idle.
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await judgeFix(packet, { env });
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
  return { pass: false, label: "FAIL", reason: lastError.message, violations: ["judge-error"] };
};

export const scoreSavedRun = async (runDir, { judgeMode = "report", env = process.env, caseId = "" } = {}) => {
  const dirs = listCaseDirs()
    .map(loadCase)
    .filter((loaded) => !caseId || loaded.json.id === caseId);
  const rows = [];
  for (const loaded of dirs) {
    const caseRunDir = path.join(runDir, "cases", loaded.json.id);
    const saved = fs.existsSync(caseRunDir) ? readSavedCaseOutcome(caseRunDir) : null;
    if (!saved?.complete) {
      const reason = saved?.started
        ? "fixer cut off before writing fixer.log"
        : "not run (replay interrupted)";
      rows.push({
        id: loaded.json.id,
        ok: false,
        decisionOk: false,
        processOk: false,
        expected: loaded.json.expected.artifact,
        artifact: "none",
        failures: [reason],
        decisionFailures: [reason],
        processFailures: [],
        judge: null,
        events: [],
        artifactText: "",
        diff: "",
        fixerStatus: null,
        durationMs: null,
        logRelPath: saved?.started ? path.posix.join("cases", loaded.json.id, "stream.jsonl") : "",
        hasScreenshot: loaded.hasScreenshot,
        hasErrorContext: loaded.hasErrorContext,
      });
      continue;
    }
    const trace = blobFromLogAndPrediction(saved.logText, {
      id: loaded.json.id,
      artifact: saved.artifact,
      artifactText: saved.artifactText,
      diff: saved.diff,
      resultingFiles: saved.resultingFiles,
    });
    const scored = scoreCase(loaded, trace);
    const judge = await judgeTrace(loaded, trace, { judgeMode, env });
    rows.push({
      ...scored,
      judge,
      events: trace.events || [],
      artifactText: saved.artifactText,
      diff: saved.diff,
      fixerStatus: 0,
      durationMs: null,
      logRelPath: path.posix.join("cases", loaded.json.id, "fixer.log"),
      hasScreenshot: loaded.hasScreenshot,
      hasErrorContext: loaded.hasErrorContext,
    });
  }
  const htmlPath = writeRunReport(runDir, {
    rows,
    gatePassed: replayExitCode(rows, judgeMode) === 0,
    extra: {
      judge: judgeMode,
      salvaged: true,
      model: env.LITELLM_MODEL || PRODUCTION_MODEL,
      rates: axisRates(rows),
    },
  });
  return { rows, htmlPath };
};

const runGit = (args, cwd) => {
  const result = childProcess.spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${(result.stderr || result.stdout || "").trim()}`);
  }
  return result;
};

// The fixer only ever reads Playwright specs/pages, docs and workflows, and is
// blocked from editing src/. Checking out the image-heavy trees costs ~26 MB per
// worktree for files it can never use.
export const SPARSE_DIRS = ["playwright", "src", "docs", "scripts", ".github", ".claude"];

export const resolveSparseDirs = (env = process.env) => {
  if (String(env.PW_HEALER_EVAL_SPARSE || "1") === "0") return null;
  const override = String(env.PW_HEALER_EVAL_SPARSE_DIRS || "").trim();
  return override ? override.split(",").map((item) => item.trim()).filter(Boolean) : SPARSE_DIRS;
};

const addWorktree = (homeAppRoot, checkoutSha, dest, env = process.env) => {
  fs.rmSync(dest, { recursive: true, force: true });
  const sparseDirs = resolveSparseDirs(env);
  if (!sparseDirs) {
    runGit(["worktree", "add", "--detach", dest, checkoutSha], homeAppRoot);
    return;
  }
  runGit(["worktree", "add", "--detach", "--no-checkout", dest, checkoutSha], homeAppRoot);
  // Cone mode also materialises every root-level file, which is what the
  // healer's repo-detection and config reads expect.
  runGit(["sparse-checkout", "set", "--cone", ...sparseDirs], dest);
  runGit(["checkout", "--detach", checkoutSha], dest);
};

const removeWorktree = (homeAppRoot, dest) => {
  childProcess.spawnSync("git", ["worktree", "remove", "--force", dest], {
    cwd: homeAppRoot,
    encoding: "utf8",
  });
  fs.rmSync(dest, { recursive: true, force: true });
};

/**
 * Runs one fixer. This must not be `spawnSync`: that blocks the event loop for
 * the whole 10-20 minute fixer, so every worker `mapWithConcurrency` starts
 * queues behind the first one and `--concurrency` silently does nothing. It also
 * leaves the timeout unenforceable, since the timer cannot fire while blocked.
 */
export const runFixer = ({ worktree, env, timeoutMs, spawnImpl = childProcess.spawn }) =>
  new Promise((resolve) => {
    const child = spawnImpl("bash", [healerScript], { cwd: worktree, env });
    const chunks = { stdout: [], stderr: [] };
    let size = 0;
    const cap = 20 * 1024 * 1024;
    const collect = (stream, key) => {
      child[stream]?.on("data", (data) => {
        if (size >= cap) return;
        size += data.length;
        chunks[key].push(data);
      });
    };
    collect("stdout", "stdout");
    collect("stderr", "stderr");

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    const finish = (status, error) => {
      clearTimeout(timer);
      resolve({
        status,
        stdout: Buffer.concat(chunks.stdout).toString("utf8"),
        stderr: Buffer.concat(chunks.stderr).toString("utf8"),
        error: timedOut ? new Error(`fixer exceeded ${timeoutMs}ms and was killed`) : error,
      });
    };
    child.on("error", (error) => finish(null, error));
    child.on("close", (code) => finish(timedOut ? null : code));
  });

const printTable = (rows) => {
  const pad = (value, width) => String(value).padEnd(width);
  console.log(
    `${pad("CASE", 28)} ${pad("DECISION", 9)} ${pad("PROCESS", 8)} ${pad("JUDGE", 8)} ${pad("WANT", 10)} ${pad("GOT", 10)} FAILURES`,
  );
  for (const row of rows) {
    const judge = row.judge ? (row.judge.pass ? "pass" : row.judge.label || "FAIL") : "-";
    const extra = [
      ...(row.decisionFailures || []).map((item) => `decision: ${item}`),
      ...(row.processFailures || []).map((item) => `process: ${item}`),
      row.judge && !row.judge.pass ? `judge: ${row.judge.reason}` : "",
    ]
      .filter(Boolean)
      .join("; ");
    const clipped = extra.length > 220 ? `${extra.slice(0, 220)}…` : extra;
    console.log(
      `${pad(row.id, 28)} ${pad(row.decisionOk ? "pass" : "FAIL", 9)} ${pad(row.processOk ? "pass" : "FAIL", 8)} ${pad(judge, 8)} ${pad(row.expected || "-", 10)} ${pad(row.artifact || "-", 10)} ${clipped}`,
    );
  }
  const rates = axisRates(rows);
  console.log(`\nrates  decision ${rates.decision}  process ${rates.process}  judge ${rates.judge}`);
};

export const axisRates = (rows = []) => {
  const n = rows.length;
  const judged = rows.filter((row) => row.judge);
  return {
    decision: `${rows.filter((row) => row.decisionOk).length}/${n}`,
    process: `${rows.filter((row) => row.processOk).length}/${n}`,
    judge: judged.length ? `${judged.filter((row) => row.judge.pass).length}/${judged.length}` : "off",
  };
};

/**
 * Judge every completed fixer only after all of them have finished, so LiteLLM
 * is not serving a 10–20 minute fixer and a reasoning judge at the same time.
 */
export const judgeReplayRows = async (rows, loadedById, { judgeMode, env = process.env } = {}) => {
  if (judgeMode === "off") return rows;
  for (const row of rows) {
    if (row.judge || !loadedById.has(row.id) || row.logText == null) continue;
    const loaded = loadedById.get(row.id);
    const trace = blobFromLogAndPrediction(row.logText, {
      id: row.id,
      artifact: row.artifact,
      artifactText: row.artifactText,
      diff: row.diff,
      resultingFiles: row.resultingFiles,
    });
    row.judge = await judgeTrace(loaded, trace, { judgeMode, env });
  }
  return rows;
};

export const replayCase = async (loaded, { homeAppRoot, env = process.env, runDir = "" } = {}) => {
  const caseId = loaded.json.id;
  const worktree = path.join(os.tmpdir(), `healer-eval-${caseId}-${process.pid}`);
  const binDir = path.join(worktree, ".eval-bin");
  const mcpConfigPath = path.join(os.tmpdir(), `healer-eval-mcp-${caseId}-${process.pid}.json`);
  let overlayed = false;
  const started = Date.now();
  try {
    await withGitWorktreeLock(() => addWorktree(homeAppRoot, loaded.json.checkoutSha, worktree, env));
    overlayCurrentHealer(coreRoot, path.join(worktree, "playwright/e2e-tests-core"));
    overlayed = true;
    writeCandidatesFile(
      path.join(loaded.fixturesDir, "group-slice.json"),
      path.join(worktree, "playwright/agent/.healing/ui-change-candidates.json"),
    );
    writeGhShim(binDir);
    writePlaywrightShim(binDir, worktree, loaded.json.cliMode || "pass");
    writeMcpConfig(mcpConfigPath, { caseDir: loaded.dir });

    const timeoutMs = Number(env.PW_HEALER_EVAL_TIMEOUT_MS || 45 * 60 * 1000);
    const fixerEnv = {
      ...env,
      PATH: `${binDir}${path.delimiter}${env.PATH || ""}`,
      EVAL_CASE_DIR: loaded.dir,
      TESTDINO_ACCESS_TOKEN: "eval",
      TESTDINO_MCP_CONFIG_PATH: mcpConfigPath,
      LLM_AGENT_USE_TESTDINO_MCP: "true",
      LLM_AGENT_ALLOWED_TOOLS: EVAL_ALLOWED_TOOLS,
      TESTDINO_UI_CHANGE_CANDIDATES_PATH: "playwright/agent/.healing/ui-change-candidates.json",
      LITELLM_MODEL: env.LITELLM_MODEL || PRODUCTION_MODEL,
    };
    delete fixerEnv.LLM_AGENT_SUPPRESS_TOOL_OUTPUT;
    if (runDir) {
      const caseRunDir = path.join(runDir, "cases", caseId);
      fs.mkdirSync(caseRunDir, { recursive: true });
      fixerEnv.LLM_AGENT_STREAM_JSON_PATH = path.join(caseRunDir, "stream.jsonl");
    }

    const fixer = await runFixer({ worktree, env: fixerEnv, timeoutMs });
    const logText = `${fixer.stdout}\n${fixer.stderr}`;
    const healing = readHealingArtifact(path.join(worktree, "playwright/agent/.healing"));
    const diff = gitDiffWorktree(worktree);
    const resultingFiles = collectResultingFiles(worktree, loaded.json, diff);
    const trace = blobFromLogAndPrediction(logText, {
      id: caseId,
      artifact: healing.artifact,
      artifactText: healing.artifactText,
      diff,
      writes: healing.writes,
      resultingFiles,
    });
    const scored = scoreCase(loaded, trace);
    const addRunFailure = (message, atFront = false) => {
      scored.ok = false;
      scored.decisionOk = false;
      if (atFront) {
        scored.failures.unshift(message);
        scored.decisionFailures.unshift(message);
      } else {
        scored.failures.push(message);
        scored.decisionFailures.push(message);
      }
    };
    if (fixer.error) addRunFailure(`fixer spawn: ${fixer.error.message}`);
    if (fixer.status !== 0 || healing.artifact === "none") {
      addRunFailure(`fixer exit ${fixer.status ?? "null"}`, true);
      const tail = clipLog(`${fixer.stderr}\n${fixer.stdout}`);
      if (tail) {
        console.error(`fixer exit ${fixer.status ?? "null"}`);
        console.error(tail);
      }
    }

    const logRelPath = runDir
      ? writeCaseRunFiles(runDir, caseId, {
          logText,
          diff,
          artifactText: healing.artifactText,
          artifact: healing.artifact,
          resultingFiles,
        })
      : "";
    return {
      ...scored,
      judge: null,
      logText,
      events: trace.events || [],
      artifactText: healing.artifactText,
      diff,
      resultingFiles,
      fixerStatus: fixer.status,
      durationMs: Date.now() - started,
      logRelPath,
      hasScreenshot: loaded.hasScreenshot,
      hasErrorContext: loaded.hasErrorContext,
    };
  } finally {
    fs.rmSync(mcpConfigPath, { force: true });
    if (overlayed || fs.existsSync(worktree)) {
      await withGitWorktreeLock(() => removeWorktree(homeAppRoot, worktree));
    }
  }
};

/** What production healing runs. A run on anything else is a stand-in, and summary.json says which. */
export const PRODUCTION_MODEL = "claude-sonnet-5";

/** Model ids the configured proxy actually serves; [] when it cannot be asked. */
export const listServedModels = async (apiUrl, apiKey, fetchImpl = globalThis.fetch) => {
  if (!apiUrl || !apiKey) return [];
  try {
    const response = await fetchImpl(`${String(apiUrl).replace(/\/$/, "")}/models`, {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return [];
    const body = await response.json();
    return (body?.data || []).map((item) => item?.id).filter(Boolean);
  } catch {
    return [];
  }
};

const main = async () => {
  loadAgentEnv();
  const args = parseReplayArgs(process.argv.slice(2));
  if (args.reportFrom) {
    if (args.judge !== "off" && (!process.env.LITELLM_API_KEY || !process.env.LITELLM_API_URL)) {
      console.error(
        "eval --report-from with a judge requires LITELLM_API_KEY and LITELLM_API_URL (or pass --judge off).",
      );
      process.exit(2);
    }
    const runDir = path.resolve(args.reportFrom);
    if (!fs.existsSync(path.join(runDir, "cases"))) {
      console.error(`No cases/ folder in ${runDir}`);
      process.exit(2);
    }
    console.error(`Scoring saved run ${runDir}`);
    const { rows, htmlPath } = await scoreSavedRun(runDir, {
      judgeMode: args.judge,
      caseId: args.caseId,
    });
    printTable(rows);
    console.error(`\nEval report: ${htmlPath}`);
    process.exit(replayExitCode(rows, args.judge));
  }
  if (!process.env.LITELLM_API_KEY || !process.env.LITELLM_API_URL) {
    console.error(
      "npm run eval requires LITELLM_API_KEY and LITELLM_API_URL in playwright/e2e-tests-core/agent/.env (see .env.example).",
    );
    process.exit(2);
  }
  const cliProblem = claudeCliProblem();
  if (cliProblem) {
    console.error(cliProblem);
    process.exit(2);
  }
  const homeAppRoot = resolveHomeAppRoot();
  const dirs = listCaseDirs()
    .map(loadCase)
    .filter((loaded) => !args.caseId || loaded.json.id === args.caseId);
  if (dirs.length === 0) {
    console.error("No eval cases found.");
    process.exit(2);
  }
  const fixtureErrors = [];
  for (const loaded of dirs) {
    for (const error of validateFixtures(loaded)) fixtureErrors.push(`${loaded.json.id}: ${error}`);
  }
  if (fixtureErrors.length) {
    console.error("Corpus invalid:");
    for (const error of fixtureErrors) console.error(`  ${error}`);
    process.exit(2);
  }

  const model = process.env.LITELLM_MODEL || PRODUCTION_MODEL;
  const served = await listServedModels(process.env.LITELLM_API_URL, process.env.LITELLM_API_KEY);
  // LiteLLM answers an unknown model by routing to one it does serve rather than
  // erroring, so the run completes and every verdict silently describes a model
  // nobody chose. Substituting is fine; substituting behind your back is not.
  if (served.length && !served.includes(model)) {
    console.error(
      `${process.env.LITELLM_API_URL} does not serve '${model}', and would quietly route the run to another model.\n` +
        `  served here: ${served.slice(0, 8).join(", ")}${served.length > 8 ? ", …" : ""}\n` +
        `  set LITELLM_MODEL to one of them to stand in for ${PRODUCTION_MODEL} deliberately.`,
    );
    process.exit(2);
  }

  const runDir = createRunDir(evalRoot);
  const concurrency = resolveConcurrency(args.concurrency);
  const standIn = model === PRODUCTION_MODEL ? "" : ` standing in for ${PRODUCTION_MODEL}`;
  console.error(`Saving replay logs to ${runDir} (concurrency ${concurrency}, model ${model}${standIn})`);
  const rows = await mapWithConcurrency(dirs, concurrency, async (loaded) => {
    console.error(`\n== replay ${loaded.json.id} ==`);
    return replayCase(loaded, { homeAppRoot, runDir });
  });
  if (args.judge !== "off") {
    console.error(`\nJudging ${rows.length} case(s) after all fixers finished`);
    const loadedById = new Map(dirs.map((loaded) => [loaded.json.id, loaded]));
    await judgeReplayRows(rows, loadedById, { judgeMode: args.judge });
  }
  const rates = axisRates(rows);
  const htmlPath = writeRunReport(runDir, {
    rows,
    gatePassed: replayExitCode(rows, args.judge) === 0,
    extra: { judge: args.judge, model: process.env.LITELLM_MODEL || PRODUCTION_MODEL, rates },
  });
  printTable(rows);
  console.error(`\nEval report: ${htmlPath}`);
  process.exit(replayExitCode(rows, args.judge));
};

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exit(2);
  });
}