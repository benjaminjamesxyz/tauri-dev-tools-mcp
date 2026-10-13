import { describe, it, expect } from "vitest";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { createTauriMcpServer } from "../src/server.js";

describe("Tauri MCP Server End-to-End Protocol", () => {
  it("connects client and executes tools through MCP protocol", async () => {
    const server = createTauriMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    const client = new Client({ name: "e2e-test-client", version: "1.0.0" }, { capabilities: {} });

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    // 1. List tools
    const toolsResult = await client.listTools();
    const toolNames = toolsResult.tools.map(t => t.name);

    expect(toolNames).toContain("tauri_doctor");
    expect(toolNames).toContain("tauri_scaffold");
    expect(toolNames).toContain("tauri_build");
    expect(toolNames).toContain("tauri_test_run");
    expect(toolNames).toContain("tauri_ipc_mock_generate");
    expect(toolNames).toContain("tauri_ui_diff");
    expect(toolNames).toContain("tauri_ui_audit");
    expect(toolNames).toContain("tauri_ui_snapshot");
    expect(toolNames).toContain("tauri_verify");
    expect(toolNames).toContain("tauri_ui_setup");
    expect(toolNames).toContain("tauri_android_emulator_list");
    expect(toolNames).toContain("tauri_android_emulator_start");
    expect(toolNames).toContain("tauri_android_app_install");
    expect(toolNames).toContain("tauri_android_test_run");
    expect(toolNames).toContain("tauri_android_avd_create");
    expect(toolNames).toContain("tauri_android_deps_install");

    // 2. Call tauri_doctor
    const doctorCall = await client.callTool({
      name: "tauri_doctor",
      arguments: {},
    });

    expect(doctorCall.content).toBeDefined();
    expect(doctorCall.content.length).toBeGreaterThan(0);
    const firstContent = doctorCall.content[0];
    if (firstContent.type === "text") {
      const parsed = JSON.parse(firstContent.text);
      expect(parsed.platform).toBe(process.platform);
    } else {
      throw new Error("Expected text response");
    }

    await client.close();
    await server.close();
  });
});
