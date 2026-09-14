/**
 * Fixture-backed TestDino MCP responses for healer eval.
 * Replay JSON only — never signed blob URLs.
 */
import fs from "node:fs";
import path from "node:path";

export const TESTDINO_TOOLS = [
  "get_testcase_details",
  "debug_testcase",
  "get_run_details",
  "list_testcase",
];

const FIXTURE_BY_TOOL = {
  get_testcase_details: "mcp/get_testcase_details.json",
  debug_testcase: "mcp/debug_testcase.json",
  get_run_details: "mcp/get_run_details.json",
  list_testcase: "mcp/list_testcase.json",
};

const readFixture = (caseDir, relative) => {
  const filePath = path.join(caseDir, "fixtures", relative);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
};

/**
 * `list_testcase` is on the allowlist but is not a scored tool. Shipping a
 * seventh MCP dump per case just to keep the call from fail-closing is waste.
 * When the dedicated fixture is absent, wrap `get_testcase_details` as a list
 * so a healer that lists before debugging still sees this case — not "tool down".
 */
export const listTestcaseFromDetails = (details) => {
  if (!details || details.error) return null;
  if (Array.isArray(details)) return details;
  if (Array.isArray(details.items)) return details;
  return { items: [details] };
};

export const testdinoResponse = (caseDir, toolName) => {
  const relative = FIXTURE_BY_TOOL[toolName];
  if (!relative) return { error: `unknown TestDino tool ${toolName}` };
  const body = readFixture(caseDir, relative);
  if (body) return body;
  if (toolName === "list_testcase") {
    const details = testdinoResponse(caseDir, "get_testcase_details");
    const wrapped = listTestcaseFromDetails(details);
    if (wrapped) return wrapped;
  }
  return { error: `missing fixture ${relative}` };
};
