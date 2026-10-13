import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";
import {
  findAdbBinary,
  findEmulatorBinary,
  findAvdmanagerBinary,
  listAndroidEmulators,
  createAndroidAvd,
  startAndroidEmulator,
  installApkOnAndroid,
  runAndroidAppTest,
} from "../src/tools/android_emulator.js";

describe("Tauri Android Emulator Tools", () => {
  it("locates adb binary on host system", () => {
    const adbPath = findAdbBinary();
    expect(adbPath).toBeDefined();
    expect(typeof adbPath).toBe("string");
  });

  it("locates avdmanager binary on host system", () => {
    const avdPath = findAvdmanagerBinary();
    expect(avdPath).toBeDefined();
    expect(typeof avdPath).toBe("string");
  });

  it("lists available AVDs and running devices", () => {
    const result = listAndroidEmulators();
    expect(result).toBeDefined();
    expect(Array.isArray(result.avds)).toBe(true);
    expect(Array.isArray(result.runningDevices)).toBe(true);
    expect(result.adbPath).toBeDefined();
  });

  it("invokes avdmanager create avd with graceful output handling", () => {
    const result = createAndroidAvd({
      name: "test_avd_mock",
      packagePath: "system-images;android-34;google_apis;x86_64",
      device: "medium_phone",
      force: true,
    });

    expect(result.name).toBe("test_avd_mock");
    expect(result.output).toBeDefined();
  });

  it("handles non-existent AVD start with graceful error", () => {
    const result = startAndroidEmulator({
      avdName: "NonExistentAvdForTesting_12345",
      timeoutSeconds: 1,
      autoCreate: false,
    });

    expect(result.success).toBe(false);
    expect(result.avdName).toBe("NonExistentAvdForTesting_12345");
    expect(result.message).toBeDefined();
  });

  it("fails fast with clear error when installing missing APK", () => {
    expect(() => {
      installApkOnAndroid({
        apkPath: "/tmp/non_existent_app_12345.apk",
      });
    }).toThrow("APK file not found");
  });

  it("formats activity launch and inspects logcat without crashing", () => {
    const result = runAndroidAppTest({
      packageName: "com.test.nonexistent",
      activityName: ".MainActivity",
    });

    expect(result.packageName).toBe("com.test.nonexistent");
    expect(result.logSummary).toBeDefined();
  });
});
