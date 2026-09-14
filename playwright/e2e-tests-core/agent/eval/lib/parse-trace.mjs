/**
 * Parse the healer log into a typed scoring trace.
 *
 * The healer runs claude with --output-format stream-json piped through
 * stream-healing-output.mjs, which emits exactly one line shape per tool call:
 *
 *   [→ <ClaudeToolName> <JSON.stringify(input)>]
 *
 * file_path / command / skill are complete. Only Write/Edit bodies
 * (content, old_string, new_string) may be clipped with a trailing "…".
 * Assistant prose appears on ordinary lines between those markers.
 *
 * Scoring reads the typed buckets below — never a flattened text blob, so
 * prose inside no-change.md can never satisfy a "did you call X" check.
 */

const UNIFIED_DIFF = /^(?:diff --git |--- |\+\+\+ |@@ )/m;

const uniq = (items) => [...new Set(items.filter(Boolean))];

const inferArtifact = (writes) => {
  const haystack = writes.join("\n");
  const hasPr = /pr-body\.md/.test(haystack);
  const hasNo = /no-change\.md/.test(haystack);
  if (hasPr && hasNo) return "both";
  if (hasPr) return "pr-body";
  if (hasNo) return "no-change";
  return "none";
};

const tryParseJson = (text) => {
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * Claude reports a tool call whose arguments it could not parse as
 * `{ __unparsedToolInput: { raw, len } }`, which in practice is two JSON objects
 * concatenated in one emission. The calls did run, so treating the input as
 * empty under-reports the trace — a `gh pr list` inside one would score as
 * "never ran gh pr list". Split the raw text back into its objects.
 */
export const splitConcatenatedJson = (raw = "") => {
  const text = String(raw);
  const objects = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") {
      if (depth === 0) start = i;
      depth += 1;
    } else if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        const parsed = tryParseJson(text.slice(start, i + 1));
        if (parsed) objects.push(parsed);
        start = -1;
      }
    }
  }
  return objects;
};

/** Claude tool name -> which typed bucket the call belongs in. */
const classifyTool = (toolName) => {
  const name = String(toolName || "");
  if (/^Skill$/i.test(name)) return "skill";
  if (/^Bash$/i.test(name)) return "bash";
  if (/^(Read|NotebookRead)$/i.test(name)) return "read";
  if (/^(Write|Edit|MultiEdit|NotebookEdit)$/i.test(name)) return "write";
  if (/^(Grep|Glob)$/i.test(name)) return "search";
  if (/^mcp__/i.test(name)) return "mcp";
  return "other";
};

/** mcp__TestDino__debug_testcase -> debug_testcase */
export const mcpToolName = (toolName) => {
  const parts = String(toolName || "").split("__");
  return parts.length > 1 ? parts[parts.length - 1] : String(toolName || "");
};

const skillNameFrom = (input) => {
  if (!input) return "";
  const raw = input.skill || input.name || input.command || "";
  const text = String(raw).trim();
  if (!text) return "";
  // "fix-testdino-test-case" or a path like skills/playwright/SKILL.md
  const viaPath = text.match(/skills\/([\w.-]+)/i);
  return viaPath ? viaPath[1] : text;
};

/** Skills can also be loaded by reading their SKILL.md directly. */
const skillNameFromPath = (filePath) => {
  const match = String(filePath || "").match(/skills\/([\w.-]+)\/SKILL\.md$/i);
  return match ? match[1] : "";
};

const extractFromInput = (toolName, input, acc) => {
  const kind = classifyTool(toolName);
  acc.tools.push(toolName);
  acc.toolCalls.push({ name: toolName, kind, input: input || null });

  if (kind === "mcp") acc.mcpTools.push(mcpToolName(toolName));

  if (!input) return;

  if (kind === "skill") {
    const skill = skillNameFrom(input);
    if (skill) acc.skills.push(skill);
    return;
  }

  if (kind === "bash" && input.command) {
    acc.commands.push(String(input.command));
    return;
  }

  const filePath = input.file_path || input.path || input.notebook_path;

  if (kind === "read" && filePath) {
    acc.reads.push(String(filePath));
    const skill = skillNameFromPath(filePath);
    if (skill) acc.skills.push(skill);
    return;
  }

  if (kind === "write" && filePath) {
    acc.writes.push(String(filePath));
    if (typeof input.content === "string" && /pr-body\.md|no-change\.md/.test(filePath)) {
      acc.artifactText += `${input.content}\n`;
    }
    return;
  }

  if (kind === "search" && (input.pattern || filePath)) {
    acc.searches.push(String(input.pattern || filePath));
  }
};

export const parseVerboseLog = (text = "") => {
  const acc = {
    tools: [],
    toolCalls: [],
    skills: [],
    mcpTools: [],
    commands: [],
    reads: [],
    writes: [],
    searches: [],
    artifactText: "",
    diff: "",
    events: [],
  };

  let messageBuf = [];

  const flushMessage = () => {
    const chunk = messageBuf.join("\n").trim();
    messageBuf = [];
    if (chunk) acc.events.push({ kind: "message", name: "assistant", text: chunk });
  };

  for (const line of String(text).split(/\r?\n/)) {
    const toolMatch = line.match(/^\[→ (\S+) (.*)\]\s*$/);
    if (toolMatch) {
      flushMessage();
      const toolName = toolMatch[1];
      const preview = toolMatch[2];
      const input = tryParseJson(preview);
      const recovered = input?.__unparsedToolInput?.raw
        ? splitConcatenatedJson(input.__unparsedToolInput.raw)
        : [];
      if (recovered.length) for (const one of recovered) extractFromInput(toolName, one, acc);
      else extractFromInput(toolName, input, acc);
      acc.events.push({ kind: classifyTool(toolName) === "skill" ? "skill" : "tool_call", name: toolName, text: preview });
      continue;
    }
    if (line.trim()) messageBuf.push(line);
  }
  flushMessage();

  if (UNIFIED_DIFF.test(text)) {
    const start = text.search(UNIFIED_DIFF);
    if (start >= 0) acc.diff = text.slice(start);
  }

  return {
    tools: uniq(acc.tools),
    toolCalls: acc.toolCalls,
    skills: uniq(acc.skills),
    mcpTools: uniq(acc.mcpTools),
    commands: uniq(acc.commands),
    reads: uniq(acc.reads),
    writes: uniq(acc.writes),
    searches: uniq(acc.searches),
    artifact: inferArtifact(acc.writes),
    artifactText: acc.artifactText,
    diff: acc.diff,
    events: acc.events,
  };
};

export const blobFromLogAndPrediction = (logText = "", prediction = null) => {
  const fromLog = parseVerboseLog(logText);
  if (!prediction) return fromLog;
  return {
    ...fromLog,
    tools: uniq([...fromLog.tools, ...(prediction.tools || [])]),
    skills: uniq([...fromLog.skills, ...(prediction.skills || [])]),
    mcpTools: uniq([...fromLog.mcpTools, ...(prediction.mcpTools || [])]),
    commands: uniq([...fromLog.commands, ...(prediction.commands || [])]),
    reads: uniq([...fromLog.reads, ...(prediction.reads || [])]),
    writes: uniq([...fromLog.writes, ...(prediction.writes || [])]),
    artifact: prediction.artifact || fromLog.artifact,
    artifactText: prediction.artifactText ?? fromLog.artifactText,
    diff: prediction.diff ?? fromLog.diff,
    resultingFiles: prediction.resultingFiles || {},
    events: fromLog.events || [],
  };
};
