#!/usr/bin/env bash
set -euo pipefail

# Shared LLM CLI runner for Playwright healing agents.
#
# Reads prompt text from stdin and invokes an LLM command.
#
# Env:
#   LLM_AGENT_USE_TESTDINO_MCP    true to configure TestDino MCP for Claude.
#   LLM_AGENT_ALLOWED_TOOLS       optional Claude Code allowed tools override.
#   LLM_AGENT_SUPPRESS_TOOL_OUTPUT true to hide tool-use markers from parsed output.
#   LLM_AGENT_STREAM_JSON_PATH     if set, tee Claude stream-json JSONL to this file
#                                  (must resolve under RUNNER_TEMP, TMPDIR, /tmp, or agent/eval/).
#   LITELLM_API_KEY / LITELLM_API_URL for LiteLLM.
#   LITELLM_MODEL                LiteLLM explicit model, default claude-sonnet-4-6.
#   TESTDINO_ACCESS_TOKEN / TESTDINO_MCP_CONFIG_PATH for MCP.

DEFAULT_TESTDINO_MCP_ALLOWED_TOOLS="mcp__TestDino__get_testcase_details,mcp__TestDino__debug_testcase,mcp__TestDino__get_run_details,mcp__TestDino__list_testcase,Bash(gh api:*),Bash(gh run download:*),Bash(gh pr view:*),Bash(gh pr diff:*),Bash(gh pr list:*),Bash(gh release:*),Bash(git tag:*),Bash(git log:*),Bash(ls:*),Bash(find:*),Bash(mkdir:*),Bash(npx playwright test:*),Bash(node_modules/.bin/playwright:*)"
# Agent must not read decrypted Playwright env files (CLI loads them itself).
DEFAULT_DISALLOWED_TOOLS="Read(playwright/.env*),Read(**/playwright/.env*),Read(**/.env.staging),Read(**/.env.production),Read(**/.env.staging.enc),Read(**/.env.production.enc),Grep(playwright/.env*),Grep(**/.env*),Bash(cat:*),Bash(head:*),Bash(tail:*),Bash(less:*),Bash(more:*),Bash(nl:*)"
GENERATED_MCP_CONFIG_PATH=""
GENERATED_SETTINGS_PATH=""
AGENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLAUDE_BIN="${AGENT_DIR}/node_modules/.bin/claude"
TESTDINO_MCP_BIN="${AGENT_DIR}/node_modules/.bin/testdino-mcp"
LLM_MODEL="${LITELLM_MODEL:-claude-sonnet-4-6}"

cleanup() {
  if [[ -n "${GENERATED_MCP_CONFIG_PATH}" && -f "${GENERATED_MCP_CONFIG_PATH}" ]]; then
    rm -f "${GENERATED_MCP_CONFIG_PATH}"
  fi
  if [[ -n "${GENERATED_SETTINGS_PATH}" && -f "${GENERATED_SETTINGS_PATH}" ]]; then
    rm -f "${GENERATED_SETTINGS_PATH}"
  fi
}
trap cleanup EXIT

if [[ ! -x "${CLAUDE_BIN}" ]]; then
  echo "Missing Claude Code CLI at ${CLAUDE_BIN}. Run npm ci --prefix ${AGENT_DIR} first." >&2
  exit 1
fi

export CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS="1"

if [[ -n "${LITELLM_API_KEY:-}" ]]; then
  export ANTHROPIC_API_KEY="${LITELLM_API_KEY}"
  export ANTHROPIC_AUTH_TOKEN="${LITELLM_API_KEY}"
fi

if [[ -n "${LITELLM_API_URL:-}" ]]; then
  export ANTHROPIC_BASE_URL="${LITELLM_API_URL}"
  export ANTHROPIC_API_URL="${LITELLM_API_URL}"
fi

LLM_CMD_ARRAY=("${CLAUDE_BIN}" -p --verbose --model "${LLM_MODEL}" --permission-mode acceptEdits)

# BSD mktemp (macOS) only substitutes XXXXXX when it ends the template, so a
# `.XXXXXX.json` template creates that name literally and every later run then
# fails with "File exists". Claude needs the .json suffix, so mint the unique
# name first and rename, keeping mktemp's exclusive create.
mktemp_json() {
  local base
  base="$(mktemp "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/$1.XXXXXX")"
  mv "${base}" "${base}.json"
  printf '%s' "${base}.json"
}

# Resolve LLM_AGENT_STREAM_JSON_PATH and refuse paths outside an allowlist so a
# mis-set env var cannot mkdir/tee over arbitrary files (e.g. agent/.env).
confine_stream_json_path() {
  local requested="$1"
  local resolved root
  local -a allowed=()
  if [[ -n "${RUNNER_TEMP:-}" && -d "${RUNNER_TEMP}" ]]; then
    allowed+=("$(cd "${RUNNER_TEMP}" && pwd)")
  fi
  if [[ -n "${TMPDIR:-}" && -d "${TMPDIR}" ]]; then
    allowed+=("$(cd "${TMPDIR}" && pwd)")
  fi
  allowed+=("/tmp")
  allowed+=("${AGENT_DIR}/eval")

  resolved="$(node -e 'console.log(require("node:path").resolve(process.argv[1]))' "${requested}")"
  for root in "${allowed[@]}"; do
    if [[ "${resolved}" == "${root}" || "${resolved}" == "${root}/"* ]]; then
      printf '%s' "${resolved}"
      return 0
    fi
  done
  echo "LLM_AGENT_STREAM_JSON_PATH must resolve under RUNNER_TEMP, TMPDIR, /tmp, or ${AGENT_DIR}/eval (got ${resolved})." >&2
  exit 1
}

# Deny reading Playwright env files even under acceptEdits / broad Read access.
GENERATED_SETTINGS_PATH="$(mktemp_json claude-healing-settings)"
cat > "${GENERATED_SETTINGS_PATH}" <<'EOF'
{
  "permissions": {
    "deny": [
      "Read(playwright/.env*)",
      "Read(**/playwright/.env*)",
      "Read(**/.env.staging)",
      "Read(**/.env.production)",
      "Read(**/.env.staging.enc)",
      "Read(**/.env.production.enc)",
      "Grep(playwright/.env*)",
      "Grep(**/.env.staging)",
      "Grep(**/.env.production)"
    ]
  }
}
EOF
chmod 600 "${GENERATED_SETTINGS_PATH}"
LLM_CMD_ARRAY+=(--settings "${GENERATED_SETTINGS_PATH}")
LLM_CMD_ARRAY+=(--disallowedTools "${DEFAULT_DISALLOWED_TOOLS}")

TESTDINO_MCP_CONFIG_PATH_ARG=""
# An explicit override always wins over the MCP default below; the flag is
# appended once, after both have had a chance to set it.
ALLOWED_TOOLS_VALUE="${LLM_AGENT_ALLOWED_TOOLS:-}"
if [[ "${LLM_AGENT_USE_TESTDINO_MCP:-false}" == "true" ]]; then
  TESTDINO_MCP_TOKEN="${TESTDINO_ACCESS_TOKEN:-}"
  if [[ -z "${TESTDINO_MCP_TOKEN}" ]]; then
    echo "TESTDINO_ACCESS_TOKEN is required when LLM_AGENT_USE_TESTDINO_MCP=true." >&2
    exit 1
  fi

  if [[ -n "${TESTDINO_MCP_CONFIG_PATH:-}" ]]; then
    TESTDINO_MCP_CONFIG_PATH_ARG="${TESTDINO_MCP_CONFIG_PATH}"
  else
    GENERATED_MCP_CONFIG_PATH="$(mktemp_json testdino-mcp)"
    MCP_CONFIG_PATH="${GENERATED_MCP_CONFIG_PATH}" TESTDINO_PAT_VALUE="${TESTDINO_MCP_TOKEN}" TESTDINO_MCP_BIN="${TESTDINO_MCP_BIN}" node -e '
const fs = require("node:fs");
const configPath = process.env.MCP_CONFIG_PATH;
const token = process.env.TESTDINO_PAT_VALUE;
const command = process.env.TESTDINO_MCP_BIN;
const config = {
  mcpServers: {
    TestDino: {
      command,
      args: [],
      env: {
        TESTDINO_PAT: token
      }
    }
  }
};
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
'
    chmod 600 "${GENERATED_MCP_CONFIG_PATH}"
    TESTDINO_MCP_CONFIG_PATH_ARG="${GENERATED_MCP_CONFIG_PATH}"
  fi

  if [[ -n "${TESTDINO_MCP_CONFIG_PATH_ARG}" && " ${LLM_CMD_ARRAY[*]} " != *" --mcp-config "* ]]; then
    LLM_CMD_ARRAY+=(--mcp-config "${TESTDINO_MCP_CONFIG_PATH_ARG}")
  fi

  if [[ -n "${TESTDINO_MCP_CONFIG_PATH_ARG}" && -z "${ALLOWED_TOOLS_VALUE}" ]]; then
    ALLOWED_TOOLS_VALUE="${DEFAULT_TESTDINO_MCP_ALLOWED_TOOLS}"
  fi
fi

if [[ -n "${ALLOWED_TOOLS_VALUE}" ]]; then
  LLM_CMD_ARRAY+=(--allowedTools "${ALLOWED_TOOLS_VALUE}")
fi

if [[ -n "${LLM_AGENT_DISALLOWED_TOOLS:-}" ]]; then
  # Replace default deny list when explicitly overridden.
  for i in "${!LLM_CMD_ARRAY[@]}"; do
    if [[ "${LLM_CMD_ARRAY[$i]}" == "--disallowedTools" ]]; then
      LLM_CMD_ARRAY[$((i + 1))]="${LLM_AGENT_DISALLOWED_TOOLS}"
      break
    fi
  done
fi

STREAM_JSON_PATH=""
if [[ -n "${LLM_AGENT_STREAM_JSON_PATH:-}" ]]; then
  STREAM_JSON_PATH="$(confine_stream_json_path "${LLM_AGENT_STREAM_JSON_PATH}")"
  mkdir -p "$(dirname "${STREAM_JSON_PATH}")"
fi

set +e
if [[ -n "${STREAM_JSON_PATH}" ]]; then
  "${LLM_CMD_ARRAY[@]}" --output-format stream-json | \
    tee "${STREAM_JSON_PATH}" | \
    node "${AGENT_DIR}/scripts/stream-healing-output.mjs"
else
  "${LLM_CMD_ARRAY[@]}" --output-format stream-json | \
    node "${AGENT_DIR}/scripts/stream-healing-output.mjs"
fi
pipeline_status=("${PIPESTATUS[@]}")
claude_exit="${pipeline_status[0]}"
stream_exit="${pipeline_status[$(( ${#pipeline_status[@]} - 1 ))]}"
if [[ "${stream_exit}" -ne 0 ]]; then
  echo "Warning: stream-healing-output.mjs exited with status ${stream_exit}; preserving Claude exit status ${claude_exit}." >&2
fi
exit "$claude_exit"
