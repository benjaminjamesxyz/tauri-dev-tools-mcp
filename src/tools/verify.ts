import fs from "node:fs";
import path from "node:path";

export interface VerificationCheck {
  category: "config" | "security" | "release_profile" | "lockfiles";
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
}

export interface VerificationScorecard {
  projectPath: string;
  readyForProduction: boolean;
  score: number;
  checks: VerificationCheck[];
  recommendations: string[];
}

export function verifyTauriProductionReadiness(projectPath: string): VerificationScorecard {
  const absPath = path.resolve(projectPath);
  const checks: VerificationCheck[] = [];
  const recommendations: string[] = [];

  if (!fs.existsSync(absPath)) {
    throw new Error(`Project directory does not exist: ${absPath}`);
  }

  // 1. Check tauri.conf.json
  const tauriConfPath = path.join(absPath, "src-tauri", "tauri.conf.json");
  if (!fs.existsSync(tauriConfPath)) {
    checks.push({
      category: "config",
      name: "Tauri Configuration File",
      status: "fail",
      message: "src-tauri/tauri.conf.json not found.",
    });
    recommendations.push("Create a valid tauri.conf.json using tauri_scaffold.");
  } else {
    try {
      const confRaw = fs.readFileSync(tauriConfPath, "utf8");
      const conf = JSON.parse(confRaw);

      // Identifier check
      if (!conf.identifier || conf.identifier === "com.tauri.dev") {
        checks.push({
          category: "config",
          name: "Bundle Identifier",
          status: "fail",
          message: `Identifier is unset or default '${conf.identifier}'. Must be unique (e.g. com.company.app).`,
        });
        recommendations.push("Set a unique bundle identifier in tauri.conf.json.");
      } else {
        checks.push({
          category: "config",
          name: "Bundle Identifier",
          status: "pass",
          message: `Valid identifier: ${conf.identifier}`,
        });
      }

      // CSP Security check
      const csp = conf.app?.security?.csp;
      if (!csp) {
        checks.push({
          category: "security",
          name: "Content Security Policy (CSP)",
          status: "warn",
          message: "No CSP defined in app.security.csp. Production apps should restrict remote origins.",
        });
        recommendations.push("Configure app.security.csp in tauri.conf.json.");
      } else {
        checks.push({
          category: "security",
          name: "Content Security Policy (CSP)",
          status: "pass",
          message: "CSP configured.",
        });
      }

      // App version
      if (conf.version && typeof conf.version === "string") {
        checks.push({
          category: "config",
          name: "Semantic Version",
          status: "pass",
          message: `Version defined: ${conf.version}`,
        });
      } else {
        checks.push({
          category: "config",
          name: "Semantic Version",
          status: "fail",
          message: "Missing or invalid version in tauri.conf.json.",
        });
      }
    } catch {
      checks.push({
        category: "config",
        name: "Tauri Configuration Syntax",
        status: "fail",
        message: "Failed to parse src-tauri/tauri.conf.json as valid JSON.",
      });
    }
  }

  // 2. Check Cargo.toml release profile
  const cargoTomlPath = path.join(absPath, "src-tauri", "Cargo.toml");
  if (fs.existsSync(cargoTomlPath)) {
    const cargoToml = fs.readFileSync(cargoTomlPath, "utf8");
    const hasReleaseProfile = cargoToml.includes("[profile.release]");
    const hasCodegenUnits = cargoToml.includes("codegen-units = 1");
    const hasLto = cargoToml.includes('lto = "fat"') || cargoToml.includes("lto = true");
    const hasStrip = cargoToml.includes('strip = "symbols"') || cargoToml.includes("strip = true");

    if (hasReleaseProfile && hasCodegenUnits && hasLto && hasStrip) {
      checks.push({
        category: "release_profile",
        name: "Deterministic Release Profile",
        status: "pass",
        message: "Cargo.toml defines optimized deterministic release profile (lto, codegen-units=1, strip).",
      });
    } else {
      checks.push({
        category: "release_profile",
        name: "Deterministic Release Profile",
        status: "warn",
        message: "Cargo.toml lacks full deterministic release flags (codegen-units = 1, lto = 'fat', strip = 'symbols').",
      });
      recommendations.push("Add deterministic [profile.release] settings to src-tauri/Cargo.toml.");
    }
  }

  // 3. Check Lockfiles
  const hasCargoLock = fs.existsSync(path.join(absPath, "src-tauri", "Cargo.lock")) || fs.existsSync(path.join(absPath, "Cargo.lock"));
  const hasJsLock = fs.existsSync(path.join(absPath, "package-lock.json"))
    || fs.existsSync(path.join(absPath, "pnpm-lock.yaml"))
    || fs.existsSync(path.join(absPath, "bun.lock"))
    || fs.existsSync(path.join(absPath, "bun.lockb"));

  if (hasCargoLock) {
    checks.push({
      category: "lockfiles",
      name: "Cargo Lockfile",
      status: "pass",
      message: "Cargo.lock is present.",
    });
  } else {
    checks.push({
      category: "lockfiles",
      name: "Cargo Lockfile",
      status: "warn",
      message: "Cargo.lock is missing. Builds may experience dependency drift.",
    });
    recommendations.push("Commit Cargo.lock to ensure reproducible Rust builds.");
  }

  if (hasJsLock) {
    checks.push({
      category: "lockfiles",
      name: "Frontend Lockfile",
      status: "pass",
      message: "Frontend package lockfile is present.",
    });
  } else {
    checks.push({
      category: "lockfiles",
      name: "Frontend Lockfile",
      status: "warn",
      message: "Frontend lockfile missing. Commit package-lock.json, pnpm-lock.yaml, or bun.lock.",
    });
    recommendations.push("Generate and commit a frontend lockfile.");
  }

  const failures = checks.filter(c => c.status === "fail").length;
  const warnings = checks.filter(c => c.status === "warn").length;
  const passes = checks.filter(c => c.status === "pass").length;

  const total = checks.length;
  const score = total > 0 ? Math.round(((passes * 100) + (warnings * 50)) / total) : 0;
  const readyForProduction = failures === 0 && score >= 80;

  return {
    projectPath: absPath,
    readyForProduction,
    score,
    checks,
    recommendations,
  };
}
