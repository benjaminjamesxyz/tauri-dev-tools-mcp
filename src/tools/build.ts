import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { resolveAndroidEnvironment, type AndroidPathOverrides } from "./android.js";

export interface BuildOptions extends AndroidPathOverrides {
  projectPath: string;
  target?: "desktop" | "android" | "linux" | "windows";
  debug?: boolean;
  bundles?: string[];
  offline?: boolean;
}

export interface BuildResult {
  success: boolean;
  target: string;
  durationMs: number;
  command: string;
  stdout: string;
  stderr: string;
  artifacts: Array<{ path: string; sizeBytes: number }>;
}

export function buildTauriApp(options: BuildOptions): BuildResult {
  const {
    projectPath,
    target = "desktop",
    debug = false,
    bundles,
    offline = false,
  } = options;

  const startTime = Date.now();
  const absPath = path.resolve(projectPath);

  if (!fs.existsSync(absPath)) {
    throw new Error(`Project directory not found: ${absPath}`);
  }

  const isAndroid = target === "android";
  const cmdParts = ["cargo", "tauri", isAndroid ? "android" : "", "build", "--ci"];

  if (debug) {
    cmdParts.push("--debug");
  }

  if (bundles && bundles.length > 0 && !isAndroid) {
    cmdParts.push("--bundles", bundles.join(","));
  }

  const command = cmdParts.filter(Boolean).join(" ");

  const androidEnv = resolveAndroidEnvironment({
    androidHome: options.androidHome,
    ndkHome: options.ndkHome,
    javaHome: options.javaHome,
  });

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CI: "true",
    SOURCE_DATE_EPOCH: process.env.SOURCE_DATE_EPOCH || "1704067200",
    ...(androidEnv.androidHome ? { ANDROID_HOME: androidEnv.androidHome, ANDROID_SDK_ROOT: androidEnv.androidHome } : {}),
    ...(androidEnv.ndkHome ? { NDK_HOME: androidEnv.ndkHome } : {}),
    ...(androidEnv.javaHome ? { JAVA_HOME: androidEnv.javaHome } : {}),
  };
  let stdout = "";
  let stderr = "";
  let success = false;

  try {
    stdout = execSync(command, {
      cwd: absPath,
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 10 * 60 * 1000, // 10 minutes max
    });
    success = true;
  } catch (error: unknown) {
    if (error && typeof error === "object") {
      const execError = error as { stdout?: string; stderr?: string; message?: string };
      stdout = execError.stdout || "";
      stderr = execError.stderr || execError.message || String(error);
    } else {
      stderr = String(error);
    }
  }

  const durationMs = Date.now() - startTime;
  const artifacts: Array<{ path: string; sizeBytes: number }> = [];

  // Discover compiled artifacts
  const targetDir = path.join(absPath, "src-tauri", "target", debug ? "debug" : "release");
  const bundleDir = path.join(targetDir, "bundle");

  if (fs.existsSync(bundleDir)) {
    const walkDir = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDir(full);
        } else if (entry.isFile() && !entry.name.endsWith(".d") && !entry.name.endsWith(".rlib")) {
          const stats = fs.statSync(full);
          artifacts.push({ path: path.relative(absPath, full), sizeBytes: stats.size });
        }
      }
    };
    walkDir(bundleDir);
  }

  return {
    success,
    target,
    durationMs,
    command,
    stdout,
    stderr,
    artifacts,
  };
}
