import { describe, it, expect, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { scaffoldTauriApp } from "../src/tools/scaffold.js";

describe("Tauri Scaffold Tool", () => {
  const tmpDir = path.resolve("./tmp_scaffold_test");

  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("scaffolds a complete production-grade Tauri v2 project", () => {
    const result = scaffoldTauriApp({
      projectName: "TestDesktopApp",
      targetDir: tmpDir,
      appTitle: "My Test App",
      identifier: "com.test.desktop",
      enableMobile: true,
    });

    expect(result.success).toBe(true);
    expect(result.createdFiles.length).toBeGreaterThanOrEqual(10);

    const projectRoot = path.join(tmpDir, "TestDesktopApp");

    // Verify key files exist
    expect(fs.existsSync(path.join(projectRoot, "package.json"))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, "src-tauri", "tauri.conf.json"))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, "src-tauri", "Cargo.toml"))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, "src-tauri", "src", "main.rs"))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, "src", "App.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, "src", "tauri-ipc.ts"))).toBe(true);

    // Verify tauri.conf.json content
    const tauriConf = JSON.parse(fs.readFileSync(path.join(projectRoot, "src-tauri", "tauri.conf.json"), "utf8"));
    expect(tauriConf.identifier).toBe("com.test.desktop");
    expect(tauriConf.productName).toBe("TestDesktopApp");
    expect(tauriConf.app.security.csp).toBeDefined();

    // Verify Cargo.toml release profile
    const cargoToml = fs.readFileSync(path.join(projectRoot, "src-tauri", "Cargo.toml"), "utf8");
    expect(cargoToml).toContain("[profile.release]");
    expect(cargoToml).toContain("codegen-units = 1");
    expect(cargoToml).toContain('lto = "fat"');
  });
});
