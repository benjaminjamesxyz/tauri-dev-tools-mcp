#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createTauriMcpServer } from "./server.js";

// Critical: Redirect stdout logs to stderr to preserve pristine JSON-RPC stdio transport
const originalLog = console.log;
console.log = (...args: unknown[]) => {
  console.error(...args);
};

async function main() {
  const server = createTauriMcpServer();
  const transport = new StdioServerTransport();

  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await server.close();
    process.exit(0);
  });

  await server.connect(transport);
  console.error("[tauri-dev-tools] MCP server connected via stdio transport");
}

main().catch((err) => {
  console.error("[tauri-dev-tools] Fatal server error:", err);
  process.exit(1);
});
