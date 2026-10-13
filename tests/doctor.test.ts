import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { runTauriDoctor } from "../src/tools/doctor.js";
import { resolveAndroidEnvironment } from "../src/tools/android.js";
describe("Tauri Doctor Tool", () => {
  it("generates a structured toolchain report", () => {
    const report = runTauriDoctor();
    expect(report).toBeDefined();
    expect(report.platform).toBe(process.platform);
    expect(Array.isArray(report.checks)).toBe(true);
    expect(report.checks.length).toBeGreaterThanOrEqual(4);

    const rustCheck = report.checks.find(c => c.name === "Rust Compiler");
    expect(rustCheck).toBeDefined();
    expect(rustCheck?.required).toBe(true);

    const cargoCheck = report.checks.find(c => c.name === "Cargo");
    expect(cargoCheck).toBeDefined();
  });

  it("auto-detects host Android SDK and NDK when available", () => {
    const report = runTauriDoctor();
    expect(report.androidEnvironment).toBeDefined();

    // Check if host has Android SDK
    const hostSdk = path.resolve(os.homedir(), "Android/Sdk");
    if (fs.existsSync(hostSdk)) {
      expect(report.androidEnvironment.androidHome).toBe(hostSdk);
      expect(report.readyForAndroid).toBe(true);

      const sdkCheck = report.checks.find(c => c.name === "Android SDK (ANDROID_HOME)");
      expect(sdkCheck?.installed).toBe(true);
      expect(sdkCheck?.source).toContain("auto-detected");
    }
  });

  it("honors explicit tool overrides for Android SDK, NDK, and Java", () => {
    const tmpOverrideDir = path.resolve("./tmp_android_override");
    const fakeSdk = path.join(tmpOverrideDir, "sdk");
    const fakeNdk = path.join(tmpOverrideDir, "ndk");
    const fakeJava = path.join(tmpOverrideDir, "java");

    fs.mkdirSync(fakeSdk, { recursive: true });
    fs.mkdirSync(fakeNdk, { recursive: true });
    fs.mkdirSync(fakeJava, { recursive: true });

    try {
      const resolved = resolveAndroidEnvironment({
        androidHome: fakeSdk,
        ndkHome: fakeNdk,
        javaHome: fakeJava,
      });

      expect(resolved.androidHome).toBe(fakeSdk);
      expect(resolved.ndkHome).toBe(fakeNdk);
      expect(resolved.javaHome).toBe(fakeJava);
      expect(resolved.sources.androidHome).toBe("tool-override");
      expect(resolved.sources.ndkHome).toBe("tool-override");
      expect(resolved.sources.javaHome).toBe("tool-override");

      const report = runTauriDoctor({
        androidHome: fakeSdk,
        ndkHome: fakeNdk,
        javaHome: fakeJava,
      });

      expect(report.androidEnvironment.androidHome).toBe(fakeSdk);
      expect(report.androidEnvironment.sources.androidHome).toBe("tool-override");
    } finally {
      fs.rmSync(tmpOverrideDir, { recursive: true, force: true });
    }
  });
});
