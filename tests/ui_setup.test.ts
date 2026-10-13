import { describe, it, expect, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { setupTauriUi } from "../src/tools/ui_setup.js";
import { scaffoldTauriApp } from "../src/tools/scaffold.js";

describe("Tauri UI Setup Tool", () => {
  const tmpDir = path.resolve("./tmp_ui_setup_test");

  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("sets up complete modular UI architecture in standalone directory", () => {
    const projectPath = path.join(tmpDir, "StandaloneUi");
    const result = setupTauriUi({ projectPath });

    expect(result.success).toBe(true);
    expect(result.components).toContain("Button");
    expect(result.components).toContain("Titlebar");
    expect(result.components).toContain("AppLayout");
    expect(result.hooks).toContain("useWindowControls");
    expect(result.hooks).toContain("useIpc");

    // Check files on disk
    expect(fs.existsSync(path.join(projectPath, "src/components/ui/button.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, "src/components/ui/card.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, "src/components/ui/badge.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, "src/components/ui/input.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, "src/components/layout/titlebar.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, "src/components/layout/sidebar.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, "src/components/layout/mobile-nav.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, "src/components/layout/app-layout.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, "src/hooks/use-window-controls.ts"))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, "src/hooks/use-theme.ts"))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, "src/hooks/use-ipc.ts"))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, "src/lib/utils.ts"))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, "src/styles/theme.css"))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, "src/types/ui.ts"))).toBe(true);

    // Verify titlebar contains data-tauri-drag-region
    const titlebarContent = fs.readFileSync(
      path.join(projectPath, "src/components/layout/titlebar.tsx"),
      "utf8"
    );
    expect(titlebarContent).toContain("data-tauri-drag-region");

    // Verify useWindowControls handles Tauri safely
    const controlsContent = fs.readFileSync(
      path.join(projectPath, "src/hooks/use-window-controls.ts"),
      "utf8"
    );
    expect(controlsContent).toContain("__TAURI_INTERNALS__");
  });

  it("integrates modular UI structure directly into scaffoldTauriApp", () => {
    const scaffoldPath = path.join(tmpDir, "FullScaffold");
    const result = scaffoldTauriApp({
      projectName: "FullScaffold",
      targetDir: tmpDir,
      identifier: "com.acme.fullscaffold",
    });

    expect(result.success).toBe(true);
    expect(fs.existsSync(path.join(scaffoldPath, "src/components/ui/button.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(scaffoldPath, "src/components/layout/app-layout.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(scaffoldPath, "src/hooks/use-window-controls.ts"))).toBe(true);
  });
});
