import { describe, it, expect, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { scaffoldTauriApp } from "../src/tools/scaffold.js";
import { verifyTauriProductionReadiness } from "../src/tools/verify.js";

describe("Tauri Verification Tool", () => {
  const tmpDir = path.resolve("./tmp_verify_test");

  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("verifies production readiness of scaffolded app", () => {
    scaffoldTauriApp({
      projectName: "VerifyApp",
      targetDir: tmpDir,
      identifier: "com.acme.verify",
    });

    const projectRoot = path.join(tmpDir, "VerifyApp");

    // Add lockfiles for full production score
    fs.writeFileSync(path.join(projectRoot, "package-lock.json"), "{}");
    fs.writeFileSync(path.join(projectRoot, "src-tauri", "Cargo.lock"), "");

    const scorecard = verifyTauriProductionReadiness(projectRoot);

    expect(scorecard.readyForProduction).toBe(true);
    expect(scorecard.score).toBeGreaterThanOrEqual(80);
    expect(scorecard.checks.length).toBeGreaterThanOrEqual(5);
  });
});
