#!/usr/bin/env node
/**
 * Parse claude --output-format stream-json and emit human-readable live output.
 * Receives JSONL on stdin; writes readable lines to stdout.
 *
 * Tool-call lines are:
 *   [→ <name> <JSON.stringify(input)>]
 *
 * Paths, commands, and skill names are never truncated (eval scoring and
 * the HTML timeline need the real file_path). Only bulky write/edit bodies
 * (content / old_string / new_string) are clipped so CI stdout stays readable.
 */
import readline from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BULK_KEYS = new Set(["content", "old_string", "new_string"]);
const BULK_MAX = 400;

export const formatToolInput = (input) => {
  if (input == null || typeof input !== "object") {
    return JSON.stringify(input ?? "");
  }
  const out = Array.isArray(input) ? input : { ...input };
  if (!Array.isArray(out)) {
    for (const key of BULK_KEYS) {
      if (typeof out[key] === "string" && out[key].length > BULK_MAX) {
        out[key] = `${out[key].slice(0, BULK_MAX)}…`;
      }
    }
  }
  return JSON.stringify(out);
};

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  const suppressToolOutput = process.env.LLM_AGENT_SUPPRESS_TOOL_OUTPUT === "true";

  for await (const line of rl) {
    if (!line.trim()) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }

    if (event.type === "assistant") {
      for (const block of event.message?.content ?? []) {
        if (block.type === "text" && block.text) {
          process.stdout.write(block.text);
        } else if (block.type === "tool_use" && !suppressToolOutput) {
          console.log(`\n[→ ${block.name} ${formatToolInput(block.input)}]`);
        }
      }
    }
  }
}
