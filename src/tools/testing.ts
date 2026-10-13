import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface TestRunOptions {
  projectPath: string;
  scope?: "frontend" | "backend" | "all";
  testPattern?: string;
}

export interface TestResultSummary {
  scope: "frontend" | "backend" | "all";
  passed: boolean;
  totalDurationMs: number;
  frontend?: {
    passed: boolean;
    output: string;
  };
  backend?: {
    passed: boolean;
    output: string;
  };
  summary: string;
}

export function runTauriTests(options: TestRunOptions): TestResultSummary {
  const { projectPath, scope = "all", testPattern } = options;
  const absPath = path.resolve(projectPath);

  if (!fs.existsSync(absPath)) {
    throw new Error(`Project directory not found: ${absPath}`);
  }

  const startTime = Date.now();
  let frontendSuccess = true;
  let backendSuccess = true;
  let frontendOutput = "";
  let backendOutput = "";

  // 1. Frontend Test Run (Vitest / npm test)
  if (scope === "frontend" || scope === "all") {
    const pkgPath = path.join(absPath, "package.json");
    if (fs.existsSync(pkgPath)) {
      const patternArg = testPattern ? ` ${testPattern}` : "";
      const cmd = `npm test -- --run${patternArg}`;
      try {
        frontendOutput = execSync(cmd, {
          cwd: absPath,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          timeout: 120_000,
        });
      } catch (error: unknown) {
        frontendSuccess = false;
        if (error && typeof error === "object") {
          const execError = error as { stdout?: string; stderr?: string; message?: string };
          frontendOutput = (execError.stdout || "") + "\n" + (execError.stderr || execError.message || "");
        } else {
          frontendOutput = String(error);
        }
      }
    } else {
      frontendOutput = "No package.json found; skipped frontend tests.";
    }
  }

  // 2. Backend Test Run (cargo test)
  if (scope === "backend" || scope === "all") {
    const cargoTomlPath = path.join(absPath, "src-tauri", "Cargo.toml");
    if (fs.existsSync(cargoTomlPath)) {
      const patternArg = testPattern ? ` ${testPattern}` : "";
      const cmd = `cargo test --manifest-path src-tauri/Cargo.toml${patternArg}`;
      try {
        backendOutput = execSync(cmd, {
          cwd: absPath,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          timeout: 300_000,
        });
      } catch (error: unknown) {
        backendSuccess = false;
        if (error && typeof error === "object") {
          const execError = error as { stdout?: string; stderr?: string; message?: string };
          backendOutput = (execError.stdout || "") + "\n" + (execError.stderr || execError.message || "");
        } else {
          backendOutput = String(error);
        }
      }
    } else {
      backendOutput = "No src-tauri/Cargo.toml found; skipped backend tests.";
    }
  }

  const totalDurationMs = Date.now() - startTime;
  const overallPassed = (scope === "frontend" ? frontendSuccess : scope === "backend" ? backendSuccess : frontendSuccess && backendSuccess);

  return {
    scope,
    passed: overallPassed,
    totalDurationMs,
    frontend: scope !== "backend" ? { passed: frontendSuccess, output: frontendOutput } : undefined,
    backend: scope !== "frontend" ? { passed: backendSuccess, output: backendOutput } : undefined,
    summary: `Tests ${overallPassed ? "PASSED" : "FAILED"} in ${totalDurationMs}ms (scope: ${scope})`,
  };
}
