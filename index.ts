#!/usr/bin/env node
/**
 * DocuProx MCP Server
 *
 * Exposes DocuProx document-processing API as MCP tools so any
 * MCP-compatible AI client (Claude Desktop, Cursor, etc.) can call them.
 *
 * Required env vars:
 *   DOCUPROX_API_KEY   – your DocuProx API key
 *   DOCUPROX_BASE_URL  – base URL of your Flask API (default: https://api.docuprox.com)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

import { loadConfig } from "./config.js";
import { DocuProxClient } from "./client.js";
import { TOOL_DEFINITIONS } from "./tools.js";
import { handleTool } from "./handlers.js";

async function main() {
  // ── Config & Client ────────────────────────────────────────────────────────
  let config;
  try {
    config = loadConfig();
  } catch (e) {
    process.stderr.write(`[docuprox-mcp] Configuration error: ${(e as Error).message}\n`);
    process.exit(1);
  }

  const client = new DocuProxClient(config);

  // ── MCP Server ─────────────────────────────────────────────────────────────
  const server = new Server(
    {
      name: "docuprox-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // ── List Tools ─────────────────────────────────────────────────────────────
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS,
  }));

  // ── Call Tool ──────────────────────────────────────────────────────────────
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (!name) {
      throw new McpError(ErrorCode.InvalidParams, "Tool name is required");
    }

    const result = await handleTool(client, name, args ?? {});
    return result;
  });

  // ── Transport ──────────────────────────────────────────────────────────────
  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write("[docuprox-mcp] Server running on stdio\n");
}

main().catch((e) => {
  process.stderr.write(`[docuprox-mcp] Fatal error: ${(e as Error).message}\n`);
  process.exit(1);
});
