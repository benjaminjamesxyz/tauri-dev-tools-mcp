import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface ResolvedAndroidEnvironment {
  androidHome?: string;
  ndkHome?: string;
  javaHome?: string;
  sources: {
    androidHome?: string;
    ndkHome?: string;
    javaHome?: string;
  };
}

export interface AndroidPathOverrides {
  androidHome?: string;
  ndkHome?: string;
  javaHome?: string;
}

export function resolveAndroidEnvironment(overrides?: AndroidPathOverrides): ResolvedAndroidEnvironment {
  const sources: ResolvedAndroidEnvironment["sources"] = {};

  // 1. Resolve ANDROID_HOME / ANDROID_SDK_ROOT
  let resolvedSdk: string | undefined;

  if (overrides?.androidHome && fs.existsSync(overrides.androidHome)) {
    resolvedSdk = path.resolve(overrides.androidHome);
    sources.androidHome = "tool-override";
  } else if (process.env.ANDROID_HOME && fs.existsSync(process.env.ANDROID_HOME)) {
    resolvedSdk = path.resolve(process.env.ANDROID_HOME);
    sources.androidHome = "env:ANDROID_HOME";
  } else if (process.env.ANDROID_SDK_ROOT && fs.existsSync(process.env.ANDROID_SDK_ROOT)) {
    resolvedSdk = path.resolve(process.env.ANDROID_SDK_ROOT);
    sources.androidHome = "env:ANDROID_SDK_ROOT";
  } else {
    // Check standard host paths
    const home = os.homedir();
    const candidateSdkPaths = [
      path.join(home, "Android/Sdk"),
      path.join(home, "Library/Android/sdk"),
      "/opt/android-sdk",
      "/usr/lib/android-sdk",
      "/usr/local/android-sdk",
      path.join(process.env.LOCALAPPDATA || "", "Android/Sdk"),
    ];

    for (const cand of candidateSdkPaths) {
      if (cand && fs.existsSync(cand) && fs.statSync(cand).isDirectory()) {
        resolvedSdk = cand;
        sources.androidHome = `auto-detected: ${cand}`;
        break;
      }
    }
  }

  // 2. Resolve NDK_HOME
  let resolvedNdk: string | undefined;

  if (overrides?.ndkHome && fs.existsSync(overrides.ndkHome)) {
    resolvedNdk = path.resolve(overrides.ndkHome);
    sources.ndkHome = "tool-override";
  } else if (process.env.NDK_HOME && fs.existsSync(process.env.NDK_HOME)) {
    resolvedNdk = path.resolve(process.env.NDK_HOME);
    sources.ndkHome = "env:NDK_HOME";
  } else if (resolvedSdk) {
    // Check inside SDK ndk directory
    const ndkDir = path.join(resolvedSdk, "ndk");
    if (fs.existsSync(ndkDir) && fs.statSync(ndkDir).isDirectory()) {
      const versions = fs.readdirSync(ndkDir).filter(v => {
        const full = path.join(ndkDir, v);
        return fs.statSync(full).isDirectory() && !v.startsWith(".");
      });

      if (versions.length > 0) {
        // Pick latest semver / directory name
        versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
        resolvedNdk = path.join(ndkDir, versions[0]);
        sources.ndkHome = `auto-detected: ${resolvedNdk}`;
      }
    } else {
      const ndkBundle = path.join(resolvedSdk, "ndk-bundle");
      if (fs.existsSync(ndkBundle) && fs.statSync(ndkBundle).isDirectory()) {
        resolvedNdk = ndkBundle;
        sources.ndkHome = `auto-detected: ${ndkBundle}`;
      }
    }
  }

  if (!resolvedNdk) {
    // Host system NDK candidates
    const candidateNdks = [
      "/opt/android-ndk",
      "/usr/lib/android-ndk",
      "/usr/local/android-ndk",
    ];
    for (const cand of candidateNdks) {
      if (fs.existsSync(cand) && fs.statSync(cand).isDirectory()) {
        resolvedNdk = cand;
        sources.ndkHome = `auto-detected: ${cand}`;
        break;
      }
    }
  }

  // 3. Resolve JAVA_HOME
  let resolvedJava: string | undefined;

  if (overrides?.javaHome && fs.existsSync(overrides.javaHome)) {
    resolvedJava = path.resolve(overrides.javaHome);
    sources.javaHome = "tool-override";
  } else if (process.env.JAVA_HOME && fs.existsSync(process.env.JAVA_HOME)) {
    resolvedJava = path.resolve(process.env.JAVA_HOME);
    sources.javaHome = "env:JAVA_HOME";
  } else {
    // Check standard JVM installations
    const jvmCandidates = [
      "/usr/lib/jvm/java-17-openjdk",
      "/usr/lib/jvm/java-21-openjdk",
      "/usr/lib/jvm/default",
      "/usr/lib/jvm/default-runtime",
      "/usr/lib/jvm/java-27-openjdk",
    ];

    for (const cand of jvmCandidates) {
      if (fs.existsSync(cand) && fs.statSync(cand).isDirectory()) {
        resolvedJava = cand;
        sources.javaHome = `auto-detected: ${cand}`;
        break;
      }
    }
  }

  return {
    androidHome: resolvedSdk,
    ndkHome: resolvedNdk,
    javaHome: resolvedJava,
    sources,
  };
}
