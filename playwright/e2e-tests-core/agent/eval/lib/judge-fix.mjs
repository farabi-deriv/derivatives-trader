/**
 * Bounded LiteLLM judge for healer eval replay (axis 4: applied fix).
 * Deterministic axes remain authoritative; this never sees verbose logs or secrets.
 */
const MAX_DIFF_CHARS = 20_000;
const MAX_ARTIFACT_CHARS = 8_000;
const SECRET_RE = /tdstorage[^ \n]*sig=|sk-[a-z0-9]+|x-functions-key[^\s]*/gi;

export const JUDGE_SYSTEM_PROMPT = `You judge one Playwright auto-healer eval case: did the healer reach the RIGHT OUTCOME for the right reason?

Return ONLY JSON:
{"pass":boolean,"label":"PASS"|"PARTIAL"|"FAIL","reason":string,"violations":string[],"evidence":{"artifact_matches":boolean,"intent_matches":boolean,"guardrails_clean":boolean,"reasoning_supported":boolean}}

Decide in this order, and say which step decided it in "reason":
1. artifact_matches — got.artifact === expected.artifact. If not, label FAIL and stop.
2. guardrails_clean — none of expected.must_not appears in got.diff added lines or got.artifactText. Any hit is FAIL.
3. intent_matches — got.diff achieves the same behavioural change as goldDiff. Byte-identical is NOT required: different selector spelling, helper extraction, added waits and reordered assertions are all fine when the assertion's meaning is preserved. A polarity flip (assert-visible becoming assert-hidden), a weakened assertion (toBeVisible -> toBeAttached / .catch / soft), a skip/fixme, an added fixed timeout, or an edit under src/ is FAIL.
   For expected.artifact === "no-change" there is no diff to compare: judge whether got.artifactText names a concrete non-UI-change root cause consistent with expected.outcome (infra, flake, backend, data), not a vague "could not reproduce".
4. reasoning_supported — got.artifactText cites the specific evidence it acted on (the failing assertion, the error text, the PR that moved the selector). Unsupported assertion, or a claim contradicted by got.diff, caps the case at PARTIAL.

Labels: PASS = 1-4 all true. PARTIAL = right direction, incomplete or unsupported; PARTIAL always sets pass=false. FAIL = any of 1-3 violated.

"reason" must be one or two sentences quoting the deciding detail, never a restatement of the rules. "violations" lists short machine-readable slugs, e.g. ["polarity-flip"], ["weakened-assertion"], ["unsupported-claim"]. Empty array on PASS.
Judge outcome only: ignore prose style, formatting and PR-body wording.`;

const clip = (value, max) => {
  const text = String(value || "");
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n…truncated…`;
};

const redact = (value) => String(value || "").replace(SECRET_RE, "[redacted]");

const MAX_LIST = 24;

const addedLines = (diff = "") =>
  String(diff)
    .split(/\r?\n/)
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .join("\n");

export const buildJudgePacket = (caseJson, got = {}, goldDiff = "") => {
  const judge = caseJson.judge || {};
  return {
    id: caseJson.id,
    expected: {
      artifact: caseJson.expected?.artifact,
      outcome: judge.outcome || caseJson.notes || "",
      must_not: [...(judge.must_not || []), ...(caseJson.forbidden_diff_hints || [])],
      required_diff_hints: caseJson.required_diff_hints || [],
      coversRules: caseJson.coversRules || [],
      notes: caseJson.notes || "",
    },
    goldDiff: clip(redact(goldDiff), MAX_DIFF_CHARS),
    got: {
      artifact: got.artifact || "none",
      diff: clip(redact(got.diff || ""), MAX_DIFF_CHARS),
      // Guardrail hits only count on lines the healer added.
      addedLines: clip(redact(addedLines(got.diff)), MAX_DIFF_CHARS),
      artifactText: clip(redact(got.artifactText || ""), MAX_ARTIFACT_CHARS),
      // Compact investigation summary (no prose, no log) so the judge can tell
      // an evidence-backed claim from an unsupported one.
      investigated: {
        skills: (got.skills || []).slice(0, MAX_LIST),
        mcpTools: (got.mcpTools || []).slice(0, MAX_LIST),
        reads: (got.reads || []).slice(0, MAX_LIST).map(redact),
        commands: (got.commands || []).slice(0, MAX_LIST).map(redact),
      },
    },
  };
};

export const parseJudgeResponse = (raw) => {
  const text = String(raw || "").trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = (fenced ? fenced[1] : text).trim();
  const start = jsonText.indexOf("{");
  const end = jsonText.lastIndexOf("}");
  if (start < 0 || end < start) {
    return { pass: false, label: "FAIL", reason: "judge returned no JSON", violations: ["no-json"] };
  }
  let parsed;
  try {
    parsed = JSON.parse(jsonText.slice(start, end + 1));
  } catch {
    return { pass: false, label: "FAIL", reason: "judge JSON parse failed", violations: ["invalid-json"] };
  }
  const label = String(parsed.label || (parsed.pass ? "PASS" : "FAIL")).toUpperCase();
  const normalizedLabel = ["PASS", "PARTIAL", "FAIL"].includes(label) ? label : "FAIL";
  const pass = normalizedLabel === "PASS" && parsed.pass === true;
  const evidence = parsed.evidence && typeof parsed.evidence === "object" ? parsed.evidence : {};
  return {
    pass,
    label: normalizedLabel,
    reason: String(parsed.reason || "").trim() || "no reason",
    violations: Array.isArray(parsed.violations) ? parsed.violations.map(String) : [],
    evidence: {
      artifact_matches: Boolean(evidence.artifact_matches),
      intent_matches: Boolean(evidence.intent_matches),
      guardrails_clean: Boolean(evidence.guardrails_clean),
      reasoning_supported: Boolean(evidence.reasoning_supported),
    },
  };
};

export const messagesUrl = (apiUrl) => {
  const root = String(apiUrl || "").replace(/\/$/, "");
  if (!root) return "";
  return root.endsWith("/v1") ? `${root}/messages` : `${root}/v1/messages`;
};

export const summarizeHttpError = (status, detail) => {
  const text = String(detail || "");
  if (/Cloudflare Access/i.test(text)) {
    return `judge HTTP ${status}: Cloudflare Access blocked the request (no SSO cookie on this fetch)`;
  }
  if (/^\s*</.test(text)) return `judge HTTP ${status}: HTML error page`;
  return `judge HTTP ${status}: ${text.replace(/\s+/g, " ").trim().slice(0, 240)}`;
};

/**
 * The verdict text out of a `/v1/messages` body. A reasoning model answers with
 * a `thinking` block first, so `content[0]` is its scratchpad and the JSON is
 * further down — taking index 0 reads the reasoning and reports "no JSON".
 */
export const judgeText = (body) => {
  const blocks = Array.isArray(body?.content) ? body.content : [];
  const thinking = new Set(["thinking", "redacted_thinking", "reasoning"]);
  const text = blocks
    .filter((block) => typeof block?.text === "string" && !thinking.has(block?.type))
    .map((block) => block.text)
    .join("\n")
    .trim();
  if (text) return text;
  const choice = body?.choices?.[0]?.message?.content;
  return typeof choice === "string" ? choice : "";
};

export const judgeFix = async (packet, { env = process.env, fetchImpl = globalThis.fetch } = {}) => {
  const apiKey = String(env.LITELLM_API_KEY || "").trim();
  const apiUrl = String(env.LITELLM_API_URL || "").trim();
  const model = String(env.PW_HEALER_EVAL_JUDGE_MODEL || env.LITELLM_MODEL || "claude-sonnet-5").trim();
  if (!apiKey || !apiUrl) {
    throw new Error("judge requires LITELLM_API_KEY and LITELLM_API_URL");
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch is not available");
  }
  const response = await fetchImpl(messagesUrl(apiUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
      authorization: `Bearer ${apiKey}`,
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 800,
      system: JUDGE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(packet) }],
    }),
    // A reasoning model spends most of its budget before the first token, and
    // 60s was short enough that grok-4.6 aborted mid-thought every time.
    signal: AbortSignal.timeout(Number(env.PW_HEALER_EVAL_JUDGE_TIMEOUT_MS) || 240_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(summarizeHttpError(response.status, detail));
  }
  const body = await response.json();
  return parseJudgeResponse(judgeText(body));
};
