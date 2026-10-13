import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createTauriMcpServer } from "../src/server.js";

describe("Tauri Dev Tools Skill Specification", () => {
  const rootSkillPath = path.resolve("./SKILL.md");
  const agentSkillPath = path.resolve("./.agents/skills/tauri-dev-tools/SKILL.md");

  it("verifies SKILL.md exists and has valid frontmatter", () => {
    expect(fs.existsSync(rootSkillPath)).toBe(true);
    expect(fs.existsSync(agentSkillPath)).toBe(true);

    const rootContent = fs.readFileSync(rootSkillPath, "utf8");
    const agentContent = fs.readFileSync(agentSkillPath, "utf8");

    expect(rootContent).toBe(agentContent);
    expect(rootContent).toContain("name: tauri-dev-tools");
    expect(rootContent).toContain("license: MIT");
  });

  it("verifies all MCP server tools are documented in SKILL.md", async () => {
    const server = createTauriMcpServer();
    const skillContent = fs.readFileSync(rootSkillPath, "utf8");

    const expectedTools = [
      "tauri_doctor",
      "tauri_scaffold",
      "tauri_ui_setup",
      "tauri_build",
      "tauri_test_run",
      "tauri_ipc_mock_generate",
      "tauri_ui_snapshot",
      "tauri_ui_diff",
      "tauri_ui_audit",
      "tauri_verify",
      "tauri_android_emulator_list",
      "tauri_android_emulator_start",
      "tauri_android_avd_create",
      "tauri_android_app_install",
      "tauri_android_test_run",
      "tauri_android_deps_install",
    ];
    for (const tool of expectedTools) {
      expect(skillContent).toContain(tool);
    }
  });
});
