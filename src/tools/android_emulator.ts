import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { resolveAndroidEnvironment, type AndroidPathOverrides } from "./android.js";

export interface EmulatorDevice {
  id: string;
  state: string;
  model?: string;
  product?: string;
  isEmulator: boolean;
}

export interface EmulatorListResult {
  avds: string[];
  runningDevices: EmulatorDevice[];
  adbPath: string;
  emulatorPath?: string;
}
function findExecutableOnPath(name: string): string | undefined {
  try {
    const finder = process.platform === "win32" ? "where" : "which";
    const out = execSync(`${finder} ${name}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 3000 }).trim();
    return out.split(/\r?\n/)[0]?.trim() || undefined;
  } catch {
    return undefined;
  }
}

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function findAdbBinary(androidHome?: string): string {
  const home = androidHome || resolveAndroidEnvironment().androidHome;
  if (home) {
    const localAdb = path.join(home, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb");
    if (fs.existsSync(localAdb)) return localAdb;
  }
  return findExecutableOnPath("adb") || "adb";
}

export function findEmulatorBinary(androidHome?: string): string | undefined {
  const home = androidHome || resolveAndroidEnvironment().androidHome;
  if (home) {
    const localEmulator = path.join(home, "emulator", process.platform === "win32" ? "emulator.exe" : "emulator");
    if (fs.existsSync(localEmulator)) return localEmulator;
  }
  return findExecutableOnPath("emulator");
}

export function findAvdmanagerBinary(androidHome?: string): string | undefined {
  const home = androidHome || resolveAndroidEnvironment().androidHome;
  if (home) {
    const cand = path.join(home, "cmdline-tools", "latest", "bin", process.platform === "win32" ? "avdmanager.bat" : "avdmanager");
    if (fs.existsSync(cand)) return cand;
  }
  return findExecutableOnPath("avdmanager");
}

export function findSdkmanagerBinary(androidHome?: string): string | undefined {
  const home = androidHome || resolveAndroidEnvironment().androidHome;
  if (home) {
    const cand = path.join(home, "cmdline-tools", "latest", "bin", process.platform === "win32" ? "sdkmanager.bat" : "sdkmanager");
    if (fs.existsSync(cand)) return cand;
  }
  return findExecutableOnPath("sdkmanager");
}

export interface AvdCreateOptions extends AndroidPathOverrides {
  name: string;
  packagePath?: string;
  device?: string;
  force?: boolean;
  abi?: string;
}

export interface AvdCreateResult {
  success: boolean;
  name: string;
  output: string;
}

export function createAndroidAvd(options: AvdCreateOptions): AvdCreateResult {
  const {
    name,
    packagePath = "system-images;android-34;google_apis;x86_64",
    device = "medium_phone",
    force = true,
    abi,
  } = options;

  const env = resolveAndroidEnvironment(options);
  const avdmanager = findAvdmanagerBinary(env.androidHome);

  if (!avdmanager) {
    return {
      success: false,
      name,
      output: "avdmanager binary not found. Install Android SDK command-line tools: cmdline-tools;latest",
    };
  }

  const abiArg = abi ? `--abi "${abi}"` : "";
  const forceArg = force ? "--force" : "";
  const deviceArg = device ? `--device "${device}"` : "";
  const cmd = `"${avdmanager}" create avd -n "${name}" -k "${packagePath}" ${deviceArg} ${abiArg} ${forceArg}`;

  try {
    // Echo "no" to decline custom hardware profile prompt
    const out = execSync(cmd, {
      input: "no\n",
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 30_000,
      env: {
        ...process.env,
        ...(env.androidHome ? { ANDROID_HOME: env.androidHome, ANDROID_SDK_ROOT: env.androidHome } : {}),
      },
    });

    return {
      success: true,
      name,
      output: out.trim() || `AVD '${name}' created successfully.`,
    };
  } catch (err: unknown) {
    const stdout = err && typeof err === "object" && "stdout" in err ? String(err.stdout) : "";
    const stderr = err && typeof err === "object" && "stderr" in err ? String(err.stderr) : "";
    const message = (stdout + "\n" + stderr).trim() || String(err);

    return {
      success: false,
      name,
      output: message,
    };
  }
}

export interface AndroidDepsInstallOptions extends AndroidPathOverrides {
  packages?: string[];
  acceptLicenses?: boolean;
}

export interface AndroidDepsInstallResult {
  success: boolean;
  installedPackages: string[];
  output: string;
}

export function installAndroidDependencies(options?: AndroidDepsInstallOptions): AndroidDepsInstallResult {
  const env = resolveAndroidEnvironment(options);
  const sdkmanager = findSdkmanagerBinary(env.androidHome);

  if (!sdkmanager) {
    return {
      success: false,
      installedPackages: [],
      output: "sdkmanager binary not found. Install Android SDK Command-line Tools first.",
    };
  }

  const packages = options?.packages ?? [
    "platform-tools",
    "emulator",
    "system-images;android-34;google_apis;x86_64",
    "platforms;android-34",
    "build-tools;34.0.0",
  ];

  if (options?.acceptLicenses !== false) {
    try {
      execSync(`yes | "${sdkmanager}" --licenses`, {
        stdio: "ignore",
        timeout: 30_000,
        env: {
          ...process.env,
          ...(env.androidHome ? { ANDROID_HOME: env.androidHome, ANDROID_SDK_ROOT: env.androidHome } : {}),
        },
      });
    } catch {
      // Ignore license command error
    }
  }

  const cmd = `yes | "${sdkmanager}" ${packages.map(p => `"${p}"`).join(" ")}`;
  try {
    const out = execSync(cmd, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 300_000,
      env: {
        ...process.env,
        ...(env.androidHome ? { ANDROID_HOME: env.androidHome, ANDROID_SDK_ROOT: env.androidHome } : {}),
      },
    });

    return {
      success: true,
      installedPackages: packages,
      output: out.trim(),
    };
  } catch (err: unknown) {
    const stdout = err && typeof err === "object" && "stdout" in err ? String(err.stdout) : "";
    const stderr = err && typeof err === "object" && "stderr" in err ? String(err.stderr) : "";
    return {
      success: false,
      installedPackages: [],
      output: (stdout + "\n" + stderr).trim() || String(err),
    };
  }
}

export function listAndroidEmulators(overrides?: AndroidPathOverrides): EmulatorListResult {
  const env = resolveAndroidEnvironment(overrides);
  const adb = findAdbBinary(env.androidHome);
  const emulatorBin = findEmulatorBinary(env.androidHome);
  const avdmanager = findAvdmanagerBinary(env.androidHome);

  const avds: string[] = [];

  // 1. List defined AVDs
  if (emulatorBin) {
    try {
      const out = execSync(`"${emulatorBin}" -list-avds`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5000 });
      out.split("\n").map(l => l.trim()).filter(Boolean).forEach(a => avds.push(a));
    } catch {
      // Fallback to avdmanager
    }
  }

  if (avds.length === 0 && avdmanager) {
    try {
      const out = execSync(`"${avdmanager}" list avd -c`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5000 });
      out.split("\n").map(l => l.trim()).filter(Boolean).forEach(a => avds.push(a));
    } catch {
      // Ignore
    }
  }

  // Also check ~/.android/avd directory directly
  const homeAvdDir = path.join(process.env.HOME || "", ".android", "avd");
  if (fs.existsSync(homeAvdDir)) {
    try {
      const iniFiles = fs.readdirSync(homeAvdDir).filter(f => f.endsWith(".ini"));
      for (const ini of iniFiles) {
        const name = path.basename(ini, ".ini");
        if (!avds.includes(name)) avds.push(name);
      }
    } catch {
      // Ignore
    }
  }

  // 2. List running devices via ADB
  const runningDevices: EmulatorDevice[] = [];
  try {
    const adbDevicesOut = execSync(`"${adb}" devices -l`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5000 });
    const lines = adbDevicesOut.split("\n").slice(1); // skip "List of devices attached"

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split(/\s+/);
      const id = parts[0];
      const state = parts[1] || "unknown";

      const modelMatch = trimmed.match(/model:(\S+)/);
      const productMatch = trimmed.match(/product:(\S+)/);

      runningDevices.push({
        id,
        state,
        model: modelMatch ? modelMatch[1] : undefined,
        product: productMatch ? productMatch[1] : undefined,
        isEmulator: id.startsWith("emulator-"),
      });
    }
  } catch {
    // ADB server not yet started or failed
  }

  return {
    avds,
    runningDevices,
    adbPath: adb,
    emulatorPath: emulatorBin,
  };
}

export interface EmulatorStartOptions extends AndroidPathOverrides {
  avdName?: string;
  headless?: boolean;
  timeoutSeconds?: number;
  autoCreate?: boolean;
  packagePath?: string;
  device?: string;
}

export interface EmulatorStartResult {
  success: boolean;
  avdName: string;
  deviceId?: string;
  pid?: number;
  message: string;
}

export function startAndroidEmulator(options: EmulatorStartOptions): EmulatorStartResult {
  const { avdName = "tauri_test_device", headless = true, timeoutSeconds = 60, autoCreate = true } = options;
  const env = resolveAndroidEnvironment(options);
  const emulatorBin = findEmulatorBinary(env.androidHome);
  const adb = findAdbBinary(env.androidHome);

  // If autoCreate enabled, check if AVD exists and create with avdmanager if missing
  if (autoCreate) {
    const current = listAndroidEmulators(options);
    if (!current.avds.includes(avdName)) {
      const created = createAndroidAvd({
        name: avdName,
        packagePath: options.packagePath,
        device: options.device,
        androidHome: options.androidHome,
        ndkHome: options.ndkHome,
        javaHome: options.javaHome,
      });
      if (!created.success) {
        return {
          success: false,
          avdName,
          message: `Failed to auto-create AVD with avdmanager: ${created.output}`,
        };
      }
    }
  }

  if (!emulatorBin) {
    return {
      success: false,
      avdName,
      message: "Android Emulator binary not found. Install emulator via SDK manager: sdkmanager --install 'emulator'",
    };
  }

  const args = ["-avd", avdName];
  if (headless) {
    args.push("-no-window", "-no-audio", "-no-boot-anim", "-gpu", "swiftshader_indirect");
  }

  const child = spawn(emulatorBin, args, {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      ...(env.androidHome ? { ANDROID_HOME: env.androidHome, ANDROID_SDK_ROOT: env.androidHome } : {}),
    },
  });
  child.unref();

  // Wait for device to connect to adb
  let connectedDeviceId: string | undefined;
  const start = Date.now();
  const maxWait = timeoutSeconds * 1000;

  while (Date.now() - start < maxWait) {
    try {
      const out = execSync(`"${adb}" devices`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 3000 });
      const match = out.match(/(emulator-\d+)\s+device/);
      if (match) {
        connectedDeviceId = match[1];
        break;
      }
    } catch {
      // Continue polling
    }
    sleepSync(1000);
  }

  // Wait until full userspace boot completion
  while (connectedDeviceId && Date.now() - start < maxWait) {
    try {
      const bootOut = execSync(`"${adb}" -s "${connectedDeviceId}" shell getprop sys.boot_completed`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 3000,
      }).trim();
      if (bootOut === "1") break;
    } catch {
      // Continue polling
    }
    sleepSync(1000);
  }
  if (!connectedDeviceId) {
    return {
      success: false,
      avdName,
      pid: child.pid,
      message: `Emulator spawned (PID: ${child.pid}) but did not reach ready state within ${timeoutSeconds}s`,
    };
  }

  return {
    success: true,
    avdName,
    deviceId: connectedDeviceId,
    pid: child.pid,
    message: `Emulator ${avdName} successfully started and connected as ${connectedDeviceId}`,
  };
}

export interface AppInstallOptions extends AndroidPathOverrides {
  apkPath: string;
  deviceId?: string;
}

export interface AppInstallResult {
  success: boolean;
  apkPath: string;
  deviceId?: string;
  output: string;
}

export function installApkOnAndroid(options: AppInstallOptions): AppInstallResult {
  const { apkPath, deviceId } = options;
  const absApk = path.resolve(apkPath);

  if (!fs.existsSync(absApk)) {
    throw new Error(`APK file not found: ${absApk}`);
  }

  const env = resolveAndroidEnvironment(options);
  const adb = findAdbBinary(env.androidHome);

  const deviceArg = deviceId ? `-s "${deviceId}"` : "";
  const cmd = `"${adb}" ${deviceArg} install -r "${absApk}"`;

  try {
    const out = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60_000 });
    const success = out.includes("Success");
    return {
      success,
      apkPath: absApk,
      deviceId,
      output: out.trim(),
    };
  } catch (err: unknown) {
    const stdout = err && typeof err === "object" && "stdout" in err ? String(err.stdout) : "";
    const stderr = err && typeof err === "object" && "stderr" in err ? String(err.stderr) : "";
    const errText = (stdout + "\n" + stderr).trim() || String(err);
    return {
      success: false,
      apkPath: absApk,
      deviceId,
      output: errText.trim(),
    };
  }
}

export interface AndroidTestRunOptions extends AndroidPathOverrides {
  packageName: string;
  activityName?: string;
  deviceId?: string;
  waitLaunchMs?: number;
}

export interface AndroidTestRunResult {
  success: boolean;
  packageName: string;
  deviceId?: string;
  launchTimeMs?: number;
  passed: boolean;
  logSummary: string;
}

export function runAndroidAppTest(options: AndroidTestRunOptions): AndroidTestRunResult {
  const { packageName, activityName = ".MainActivity", deviceId, waitLaunchMs = 5000 } = options;
  const env = resolveAndroidEnvironment(options);
  const adb = findAdbBinary(env.androidHome);
  const deviceArg = deviceId ? `-s "${deviceId}"` : "";
  // Check if target device or any device is currently online
  try {
    const devicesOut = execSync(`"${adb}" devices`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 2000 });
    const lines = devicesOut.split("\n").slice(1);
    const isDeviceReady = deviceId
      ? lines.some(line => line.startsWith(deviceId) && line.includes("\tdevice"))
      : lines.some(line => line.includes("\tdevice"));

    if (!isDeviceReady) {
      return {
        success: false,
        packageName,
        deviceId,
        passed: false,
        logSummary: deviceId ? `Device ${deviceId} is not online.` : "No online Android devices or emulators attached.",
      };
    }
  } catch {
    return {
      success: false,
      packageName,
      deviceId,
      passed: false,
      logSummary: "ADB server unreachable.",
    };
  }

  // 1. Clear logcat before start
  try {
    execSync(`"${adb}" ${deviceArg} logcat -c`, { stdio: "ignore", timeout: 2000 });
  } catch {
    // Ignore
  }
  // 2. Launch Activity via am start -W (wait for launch completion)
  const component = activityName.startsWith(".") ? `${packageName}/${activityName}` : `${packageName}/${packageName}${activityName}`;
  const startCmd = `"${adb}" ${deviceArg} shell am start -W -n "${component}"`;

  let launchSuccess = false;
  let launchTimeMs: number | undefined;

  try {
    const startOut = execSync(startCmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30_000 });
    launchSuccess = startOut.includes("Status: ok") || startOut.includes("Complete");

    const timeMatch = startOut.match(/TotalTime:\s*(\d+)/);
    if (timeMatch) {
      launchTimeMs = Number(timeMatch[1]);
    }
  } catch {
    launchSuccess = false;
  }

  // 3. Inspect recent logcat output for fatal exceptions or crashes
  let logSummary = "";
  try {
    const logs = execSync(`"${adb}" ${deviceArg} logcat -d -t 200`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5000 });
    const crashMatch = logs.match(/FATAL EXCEPTION[\s\S]{1,500}/);
    if (crashMatch) {
      launchSuccess = false;
      logSummary = `Application crashed:\n${crashMatch[0]}`;
    } else {
      logSummary = "No fatal crashes detected in application logcat stream.";
    }
  } catch {
    logSummary = "Logcat inspection unavailable.";
  }

  return {
    success: launchSuccess,
    packageName,
    deviceId,
    launchTimeMs,
    passed: launchSuccess,
    logSummary,
  };
}
