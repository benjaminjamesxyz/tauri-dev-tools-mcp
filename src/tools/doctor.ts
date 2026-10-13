import { execSync } from "node:child_process";
import fs from "node:fs";
import { resolveAndroidEnvironment, type AndroidPathOverrides } from "./android.js";

export interface ToolchainCheck {
  name: string;
  installed: boolean;
  version?: string;
  path?: string;
  source?: string;
  required: boolean;
  recommendation?: string;
}

export interface DoctorReport {
  timestamp: string;
  platform: NodeJS.Platform;
  readyForDesktop: boolean;
  readyForAndroid: boolean;
  androidEnvironment: {
    androidHome?: string;
    ndkHome?: string;
    javaHome?: string;
    sources: Record<string, string | undefined>;
  };
  checks: ToolchainCheck[];
}

export interface DoctorOptions extends AndroidPathOverrides {
  projectPath?: string;
}

function checkCmd(name: string, cmd: string, required = true, recommendation?: string): ToolchainCheck {
  try {
    const version = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5000 }).trim();
    return { name, installed: true, version, required };
  } catch {
    return { name, installed: false, required, recommendation };
  }
}

export function runTauriDoctor(optionsOrPath?: DoctorOptions | string): DoctorReport {
  const options: DoctorOptions = typeof optionsOrPath === "string" ? { projectPath: optionsOrPath } : (optionsOrPath ?? {});
  const { projectPath, androidHome, ndkHome, javaHome } = options;

  const checks: ToolchainCheck[] = [];

  // Core compilers
  checks.push(checkCmd("Rust Compiler", "rustc --version", true, "Install Rust via https://rustup.rs"));
  checks.push(checkCmd("Cargo", "cargo --version", true, "Install Cargo via https://rustup.rs"));
  checks.push(checkCmd("Tauri CLI", "cargo tauri --version", false, "Install via: cargo install tauri-cli --version '^2.0.0' or use npx @tauri-apps/cli"));
  checks.push(checkCmd("Node.js", "node --version", true, "Install Node.js 18+ or Bun"));

  // Platform-specific Webview & toolchain dependencies
  if (process.platform === "linux") {
    checks.push(checkCmd("WebKitGTK (webkit2gtk-4.1)", "pkg-config --modversion webkit2gtk-4.1", true, "Install libwebkit2gtk-4.1-dev or webkit2gtk-4.1"));
  } else if (process.platform === "win32") {
    const hasWebView2 = fs.existsSync(`${process.env.LOCALAPPDATA || ""}\\Microsoft\\EdgeWebView`)
      || fs.existsSync(`${process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)"}\\Microsoft\\EdgeWebView\\Application`);
    checks.push({
      name: "Microsoft Edge WebView2 Runtime",
      installed: hasWebView2,
      required: true,
      recommendation: "Install Evergreen WebView2 Runtime from https://developer.microsoft.com/microsoft-edge/webview2",
    });
  } else if (process.platform === "darwin") {
    checks.push(checkCmd("Xcode Command Line Tools", "xcode-select -p", true, "Install via: xcode-select --install"));
  }
  // Android Toolchain Auto-detection & Resolution
  const androidEnv = resolveAndroidEnvironment({ androidHome, ndkHome, javaHome });

  checks.push({
    name: "Android SDK (ANDROID_HOME)",
    installed: Boolean(androidEnv.androidHome),
    path: androidEnv.androidHome,
    source: androidEnv.sources.androidHome,
    required: false,
    recommendation: "Install Android SDK to ~/Android/Sdk or pass androidHome override",
  });

  checks.push({
    name: "Android NDK (NDK_HOME)",
    installed: Boolean(androidEnv.ndkHome),
    path: androidEnv.ndkHome,
    source: androidEnv.sources.ndkHome,
    required: false,
    recommendation: "Install NDK via Android Studio SDK Manager or pass ndkHome override",
  });

  checks.push({
    name: "Java JDK 17+ (JAVA_HOME)",
    installed: Boolean(androidEnv.javaHome),
    path: androidEnv.javaHome,
    source: androidEnv.sources.javaHome,
    required: false,
    recommendation: "Install JDK 17+ or set JAVA_HOME pointing to JDK root",
  });

  // Project check
  if (projectPath && fs.existsSync(projectPath)) {
    const tauriConf = fs.existsSync(`${projectPath}/src-tauri/tauri.conf.json`);
    checks.push({
      name: "Tauri Project Configuration",
      installed: tauriConf,
      path: `${projectPath}/src-tauri/tauri.conf.json`,
      required: true,
      recommendation: "Run tauri_scaffold to generate a valid Tauri v2 project",
    });
  }

  const readyForDesktop = checks.filter(c => c.required).every(c => c.installed);
  const readyForAndroid = readyForDesktop && Boolean(androidEnv.androidHome && androidEnv.ndkHome && androidEnv.javaHome);

  return {
    timestamp: new Date().toISOString(),
    platform: process.platform,
    readyForDesktop,
    readyForAndroid,
    androidEnvironment: {
      androidHome: androidEnv.androidHome,
      ndkHome: androidEnv.ndkHome,
      javaHome: androidEnv.javaHome,
      sources: androidEnv.sources,
    },
    checks,
  };
}
