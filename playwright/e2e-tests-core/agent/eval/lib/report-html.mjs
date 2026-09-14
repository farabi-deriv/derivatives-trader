/**
 * Self-contained HTML eval report (assertions + timeline), matching the
 * core-automation pydantic-evals HTML writer used on the QA branch.
 */
import fs from "node:fs";
import path from "node:path";

const SECRET_RE = /tdstorage[^ \n]*sig=|sk-[a-z0-9]+|x-functions-key[^\s]*/gi;

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const redact = (value) => String(value ?? "").replace(SECRET_RE, "[redacted]");

const pre = (value) => `<pre>${escapeHtml(redact(value))}</pre>`;

const FAILURE_CATALOG = [
  ["skill_fix_testdino", /fix-testdino-test-case skill/i],
  ["skill_playwright", /playwright skill/i],
  ["get_testcase_details", /get_testcase_details/i],
  ["debug_testcase", /debug_testcase/i],
  ["gh_artifacts", /gh api artifacts|gh run download/i],
  ["read_error_context", /error-context/i],
  ["read_screenshot", /screenshot \/ test-failed/i],
  ["gh_pr_list", /gh pr list/i],
  ["artifact_one_of", /artifact must be exactly one of/i],
  ["artifact_match", /artifact want /i],
  // Case-specific checks: shown only when they actually fired, since the
  // report cannot tell "no hints declared" from "all hints satisfied".
  ["hint_read_paths", /did not open hinted path/i, true],
  ["required_tool", /missing required tool/i, true],
  ["required_command", /missing required command/i, true],
  ["diff_hints", /missing required diff hint|forbidden diff hint/i, true],
  ["no_patch_on_stop", /produced a patch/i],
  ["ban_list", /ban-list/i],
  ["no_env_read", /playwright \.env/i],
  ["no_git_commit", /git add or git commit/i],
  ["no_secrets", /signed URL or secret/i],
];

const axisOf = (row, failure) => {
  if ((row.decisionFailures || []).includes(failure)) return "decision";
  if ((row.processFailures || []).includes(failure)) return "process";
  return "";
};

export const assertionRows = (row) => {
  const failures = [...(row.failures || [])];
  const skip = new Set();
  if (!row.hasScreenshot) skip.add("read_screenshot");
  if (!row.hasErrorContext) skip.add("read_error_context");
  if (row.expected !== "no-change") skip.add("no_patch_on_stop");
  const used = new Set();
  const rows = [];
  for (const [name, pattern, conditional] of FAILURE_CATALOG) {
    if (skip.has(name)) continue;
    const hits = failures.filter((item) => pattern.test(item));
    if (conditional && hits.length === 0) continue;
    for (const hit of hits) used.add(hit);
    rows.push({
      name,
      pass: hits.length === 0,
      reason: hits.join("; "),
      axis: hits.length ? axisOf(row, hits[0]) : "",
    });
  }
  for (const leftover of failures.filter((item) => !used.has(item))) {
    rows.push({ name: leftover.slice(0, 80), pass: false, reason: leftover, axis: axisOf(row, leftover) });
  }
  if (row.judge) {
    rows.push({
      name: "judge",
      pass: Boolean(row.judge.pass),
      reason: [row.judge.label, row.judge.reason, (row.judge.violations || []).join(", ")]
        .filter(Boolean)
        .join(" — "),
      axis: "judge",
    });
  }
  return rows;
};

const renderAssertion = (item) => {
  const label = item.pass ? "PASS" : "FAIL";
  const css = item.pass ? "pass" : "fail";
  return `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.axis || "—")}</td><td><span class="badge ${css}">${label}</span></td><td>${escapeHtml(item.reason)}</td></tr>`;
};

const verdictBadge = (label, ok) =>
  `<span class="badge ${ok ? "pass" : "fail"}">${escapeHtml(label)} ${ok ? "PASS" : "FAIL"}</span>`;

const judgeEvidence = (judge) => {
  const evidence = judge?.evidence;
  if (!evidence) return "";
  const items = Object.entries(evidence)
    .map(([key, value]) => `<li>${escapeHtml(key)}: ${value ? "yes" : "no"}</li>`)
    .join("");
  return `<h3>Judge evidence</h3><ul>${items}</ul>`;
};

const prettyToolArgs = (text) => {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
};

const toolSummary = (name, text) => {
  try {
    const input = JSON.parse(text);
    const hint = input.file_path || input.path || input.command || input.skill || "";
    if (hint) return `Tool call · ${name} — ${hint}`;
  } catch {
    /* fall through */
  }
  return `Tool call · ${name}`;
};

const renderEvent = (event, index) => {
  const kind = event.kind || "message";
  const name = event.name || "";
  const text = event.text || "";
  const isTool = kind === "tool_call" || kind === "skill";
  const toolBlock = isTool
    ? `<details class="tool"><summary>${escapeHtml(toolSummary(name, text))}</summary><h4>Arguments</h4>${pre(prettyToolArgs(text))}</details>`
    : "";
  const messageBlock = !isTool && text ? pre(text) : "";
  return `<div class="event">
  <strong>#${index} · ${escapeHtml(kind)}</strong>
  <span class="muted"> — ${escapeHtml(name || "fixer")}</span>
  ${messageBlock}
  ${toolBlock}
</div>`;
};

const renderCase = (row) => {
  const assertions = assertionRows(row);
  const assertionTable = assertions.map(renderAssertion).join("");
  const events = Array.isArray(row.events) ? row.events : [];
  const timeline = events.length
    ? events.map((event, index) => renderEvent(event, index)).join("")
    : '<p class="muted">No parsed tool/skill events. See fixer.log.</p>';
  const decisionOk = row.decisionOk ?? row.ok;
  const processOk = row.processOk ?? row.ok;
  const judgeOk = row.judge ? Boolean(row.judge.pass) : null;
  const badges = [
    verdictBadge("decision", decisionOk),
    verdictBadge("process", processOk),
    judgeOk === null ? "" : verdictBadge("judge", judgeOk),
  ]
    .filter(Boolean)
    .join(" ");
  const logLink = row.logRelPath
    ? `<p><a href="${escapeHtml(row.logRelPath)}">fixer.log</a></p>`
    : "";
  // Collapsed by default; failures start open so the report opens on what broke.
  const open = decisionOk && processOk && judgeOk !== false ? "" : " open";
  return `<article>
  <details${open}>
  <summary><strong>${escapeHtml(row.id)}</strong> ${badges}</summary>
  <p><strong>Duration:</strong> ${escapeHtml(row.durationMs ?? "—")} ms ·
     <strong>Want:</strong> ${escapeHtml(row.expected || "—")} ·
     <strong>Got:</strong> ${escapeHtml(row.artifact || "—")} ·
     <strong>Fixer exit:</strong> ${escapeHtml(row.fixerStatus ?? "—")}</p>
  ${logLink}
  <h3>Assertions</h3>
  <table><thead><tr><th>Check</th><th>Axis</th><th>Result</th><th>Detail</th></tr></thead><tbody>${assertionTable}</tbody></table>
  ${judgeEvidence(row.judge)}
  <h3>Final artifact</h3>
  ${pre((row.artifactText || "").slice(0, 8_000) || "(empty)")}
  <h3>Event timeline</h3>
  <div class="timeline">${timeline}</div>
  <h3>Diff</h3>
  ${pre((row.diff || "").slice(0, 20_000) || "(none)")}
  </details>
</article>`;
};

export const renderHtmlReport = ({ name = "Healer eval replay", rows = [], gatePassed = false } = {}) => {
  const gateClass = gatePassed ? "pass" : "fail";
  const gateLabel = gatePassed ? "PASSED" : "FAILED";
  const failed = rows.filter((row) => !row.ok);
  const count = (predicate) => rows.filter(predicate).length;
  const judged = rows.filter((row) => row.judge);
  const tally = [
    `decision ${count((row) => row.decisionOk ?? row.ok)}/${rows.length}`,
    `process ${count((row) => row.processOk ?? row.ok)}/${rows.length}`,
    judged.length ? `judge ${judged.filter((row) => row.judge.pass).length}/${judged.length}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const violations = failed
    .map((row) => `<li>${escapeHtml(row.id)}: ${escapeHtml((row.failures || []).join("; ") || "failed")}</li>`)
    .join("");
  const violationSection = violations
    ? `<section><h2>Gate violations</h2><ul>${violations}</ul></section>`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'unsafe-inline'">
  <title>${escapeHtml(name)}</title>
  <style>
    :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { max-width: 1100px; margin: 0 auto; padding: 2rem; line-height: 1.5; }
    header, section, article { border: 1px solid #8885; border-radius: .75rem; padding: 1rem; margin: 1rem 0; }
    h1, h2, h3 { margin-top: 0; }
    .badge { border-radius: 999px; padding: .2rem .65rem; font-weight: 700; }
    .pass { background: #16803a; color: white; }
    .fail { background: #b42318; color: white; }
    .muted { opacity: .7; }
    .timeline { border-left: 3px solid #8885; margin-left: .75rem; padding-left: 1.25rem; }
    .event { position: relative; border: 1px solid #8884; border-radius: .6rem; margin: 1rem 0; padding: .8rem; }
    .event::before { background: #4f8cff; border: 3px solid Canvas; border-radius: 50%; content: ""; height: .7rem; left: -1.72rem; position: absolute; top: 1rem; width: .7rem; }
    .tool { background: #8881; border-radius: .5rem; margin-top: .6rem; padding: .5rem; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #8882; padding: .8rem; border-radius: .5rem; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; vertical-align: top; border-bottom: 1px solid #8884; padding: .5rem; }
    summary { cursor: pointer; font-weight: 650; }
    a { color: inherit; }
  </style>
</head>
<body>
  <header>
    <span class="badge ${gateClass}">${gateLabel}</span>
    <h1>${escapeHtml(name)}</h1>
    <p class="muted">${rows.length} case(s) · ${escapeHtml(tally)}</p>
    <p class="muted">decision = right outcome · process = followed the investigation workflow · judge = LLM review of the applied fix</p>
  </header>
  ${violationSection}
  ${rows.map(renderCase).join("\n")}
</body>
</html>
`;
};

export const createRunDir = (evalRoot, now = new Date()) => {
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const dir = path.join(evalRoot, "runs", stamp);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

export const writeCaseRunFiles = (
  runDir,
  caseId,
  { logText = "", diff = "", artifactText = "", artifact = "none", resultingFiles = null } = {},
) => {
  const dir = path.join(runDir, "cases", caseId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "fixer.log"), logText);
  if (diff) fs.writeFileSync(path.join(dir, "got.diff"), diff);
  // Kept so --report-from can re-score preserved-assertion checks without the
  // worktree, which is deleted as soon as the case finishes.
  if (resultingFiles && Object.keys(resultingFiles).length) {
    fs.writeFileSync(path.join(dir, "resulting-files.json"), `${JSON.stringify(resultingFiles, null, 2)}\n`);
  }
  if (artifactText) {
    const name = artifact === "pr-body" || artifact === "no-change" ? `${artifact}.md` : "artifact.md";
    fs.writeFileSync(path.join(dir, name), artifactText);
  }
  return path.posix.join("cases", caseId, "fixer.log");
};

export const writeRunReport = (runDir, { rows, gatePassed, extra = {} } = {}) => {
  const htmlPath = path.join(runDir, "report.html");
  const jsonPath = path.join(runDir, "summary.json");
  fs.writeFileSync(htmlPath, renderHtmlReport({ rows, gatePassed }));
  fs.writeFileSync(
    jsonPath,
    `${JSON.stringify(
      {
        name: "Healer eval replay",
        gatePassed,
        cases: rows.map((row) => ({
          id: row.id,
          ok: row.ok,
          decisionOk: row.decisionOk ?? row.ok,
          processOk: row.processOk ?? row.ok,
          expected: row.expected,
          artifact: row.artifact,
          failures: row.failures || [],
          decisionFailures: row.decisionFailures || [],
          processFailures: row.processFailures || [],
          judge: row.judge || null,
          fixerStatus: row.fixerStatus ?? null,
          durationMs: row.durationMs ?? null,
          log: row.logRelPath || null,
        })),
        ...extra,
      },
      null,
      2,
    )}\n`,
  );
  return htmlPath;
};
