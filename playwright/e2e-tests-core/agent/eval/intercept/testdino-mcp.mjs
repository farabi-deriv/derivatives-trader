#!/usr/bin/env node
/**
 * Fail-closed TestDino MCP stdio server for healer eval replay.
 * Serves frozen fixtures via testdinoResponse. Unknown tools error.
 *
 * EVAL_CASE_DIR=/path/to/cases/<id> node eval/intercept/testdino-mcp.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TESTDINO_TOOLS, testdinoResponse } from "./testdino.mjs";

const PROTOCOL_VERSION = "2024-11-05";

const toolDescriptors = () =>
  TESTDINO_TOOLS.map((name) => ({
    name,
    description: `Eval fixture replay for ${name}`,
    inputSchema: { type: "object", additionalProperties: true },
  }));

const textResult = (payload, isError = false) => {
  const result = {
    content: [{ type: "text", text: typeof payload === "string" ? payload : JSON.stringify(payload) }],
  };
  if (isError) result.isError = true;
  return result;
};

export const handleMcpMessage = (message, { caseDir = process.env.EVAL_CASE_DIR || "" } = {}) => {
  if (!message || message.jsonrpc !== "2.0") return null;
  if (typeof message.method === "string" && message.method.startsWith("notifications/")) return null;

  const reply = (result, error) => {
    if (message.id === undefined || message.id === null) return null;
    if (error) return { jsonrpc: "2.0", id: message.id, error };
    return { jsonrpc: "2.0", id: message.id, result };
  };

  switch (message.method) {
    case "initialize":
      return reply({
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "testdino-eval", version: "0.0.0" },
      });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: toolDescriptors() });
    case "tools/call": {
      const toolName = String(message.params?.name || "").trim();
      if (!caseDir) {
        return reply(textResult("EVAL_CASE_DIR is required", true));
      }
      const body = testdinoResponse(caseDir, toolName);
      if (body?.error) return reply(textResult(body.error, true));
      return reply(textResult(body));
    }
    default:
      if (message.id === undefined || message.id === null) return null;
      return reply(undefined, { code: -32601, message: `Method not found: ${message.method}` });
  }
};

export const decodeContentLengthFrame = (buffer) => {
  const headerEnd = buffer.indexOf("\r\n\r\n");
  if (headerEnd < 0) return null;
  const header = buffer.slice(0, headerEnd).toString("utf8");
  const match = header.match(/Content-Length:\s*(\d+)/i);
  if (!match) return null;
  const length = Number(match[1]);
  const bodyStart = headerEnd + 4;
  if (buffer.length < bodyStart + length) return null;
  const json = buffer.slice(bodyStart, bodyStart + length).toString("utf8");
  return { message: JSON.parse(json), rest: buffer.slice(bodyStart + length) };
};

export const encodeContentLengthFrame = (payload) => {
  const json = JSON.stringify(payload);
  return Buffer.from(`Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n\r\n${json}`, "utf8");
};

const serveStdio = () => {
  if (!process.env.EVAL_CASE_DIR) {
    console.error("EVAL_CASE_DIR is required");
    process.exit(2);
  }
  let buffer = Buffer.alloc(0);
  process.stdin.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length > 0) {
      if (buffer.includes(Buffer.from("Content-Length:", "utf8")) || buffer.includes(Buffer.from("content-length:", "utf8"))) {
        let decoded;
        try {
          decoded = decodeContentLengthFrame(buffer);
        } catch {
          break;
        }
        if (!decoded) break;
        buffer = decoded.rest;
        const response = handleMcpMessage(decoded.message);
        if (response) process.stdout.write(encodeContentLengthFrame(response));
        continue;
      }
      const newline = buffer.indexOf("\n");
      if (newline < 0) break;
      const line = buffer.slice(0, newline).toString("utf8").trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      try {
        const response = handleMcpMessage(JSON.parse(line));
        if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
      } catch {
        /* incomplete / invalid */
      }
    }
  });
};

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  serveStdio();
}
