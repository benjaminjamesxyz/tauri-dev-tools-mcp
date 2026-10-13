import fs from "node:fs";
import path from "node:path";
import { setupTauriUi } from "./ui_setup.js";
export interface ScaffoldOptions {
  projectName: string;
  targetDir: string;
  appTitle?: string;
  identifier?: string;
  enableMobile?: boolean;
}

export interface ScaffoldResult {
  success: boolean;
  projectPath: string;
  createdFiles: string[];
}

export function scaffoldTauriApp(options: ScaffoldOptions): ScaffoldResult {
  const {
    projectName,
    targetDir,
    appTitle = "Production Tauri App",
    identifier = `com.tauri.${projectName.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
    enableMobile = true,
  } = options;

  const projectPath = path.resolve(targetDir, projectName);
  const createdFiles: string[] = [];

  function writeFile(relPath: string, content: string) {
    const fullPath = path.join(projectPath, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content.trimStart(), "utf8");
    createdFiles.push(relPath);
  }

  // 1. package.json
  writeFile("package.json", JSON.stringify({
    name: projectName,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: {
      dev: "vite",
      build: "tsc && vite build",
      preview: "vite preview",
      test: "vitest run",
      "tauri": "tauri"
    },
    dependencies: {
      "@tauri-apps/api": "^2.0.0",
      "@tauri-apps/plugin-opener": "^2.0.0",
      "clsx": "^2.1.1",
      "lucide-react": "^0.475.0",
      "react": "^19.0.0",
      "react-dom": "^19.0.0",
      "tailwind-merge": "^3.0.2"
    },
    devDependencies: {
      "@tailwindcss/vite": "^4.0.0",
      "@tauri-apps/cli": "^2.0.0",
      "@types/node": "^22.0.0",
      "@types/react": "^19.0.0",
      "@types/react-dom": "^19.0.0",
      "@vitejs/plugin-react": "^4.3.4",
      "tailwindcss": "^4.0.0",
      "typescript": "^5.7.0",
      "vite": "^6.2.0",
      "vitest": "^3.0.0"
    }
  }, null, 2));

  // 2. tsconfig.json
  writeFile("tsconfig.json", JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      useDefineForClassFields: true,
      lib: ["ES2022", "DOM", "DOM.Iterable"],
      module: "ESNext",
      skipLibCheck: true,
      moduleResolution: "bundler",
      allowImportingTsExtensions: true,
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
      jsx: "react-jsx",
      strict: true,
      noUnusedLocals: false,
      noUnusedParameters: false,
      noFallthroughCasesInSwitch: true
    },
    include: ["src"]
  }, null, 2));

  // 3. vite.config.ts
  writeFile("vite.config.ts", `
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: {
      ignored: ["**/src-tauri/**"]
    }
  }
});
`);

  // 4. index.html
  writeFile("index.html", `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>${appTitle}</title>
  </head>
  <body class="bg-neutral-950 text-neutral-100 antialiased select-none overflow-hidden m-0 p-0 font-sans">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`);

  // 5. src/main.tsx
  writeFile("src/main.tsx", `
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`);

  // 6. src/index.css
  writeFile("src/index.css", `
@import "tailwindcss";

:root {
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
}

html, body, #root {
  height: 100%;
  width: 100%;
}
`);

  // 7. src/tauri-ipc.ts (Type-safe IPC with deterministic mock fallback)
  writeFile("src/tauri-ipc.ts", `
import { invoke } from "@tauri-apps/api/core";

export interface SystemInfo {
  os: string;
  arch: string;
  appVersion: string;
}

export function isTauriEnvironment(): boolean {
  return typeof window !== "undefined" && window !== null && "__TAURI_INTERNALS__" in window && Boolean(window.__TAURI_INTERNALS__);
}

export async function getSystemInfo(): Promise<SystemInfo> {
  if (!isTauriEnvironment()) {
    // Deterministic mock for headless test and web preview
    return {
      os: "SimulatedOS",
      arch: "x86_64",
      appVersion: "0.1.0-mock",
    };
  }
  return await invoke<SystemInfo>("get_system_info");
}

export async function calculateSum(a: number, b: number): Promise<number> {
  return isTauriEnvironment() ? await invoke<number>("calculate_sum", { a, b }) : a + b;
}
`);

  // 8. src/App.tsx (Modern, production UI with desktop titlebar and mobile safe areas)
  writeFile("src/App.tsx", `
import React, { useState, useEffect } from "react";
import { getSystemInfo, calculateSum, isTauriEnvironment } from "./tauri-ipc";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Shield, Cpu, Activity, Minus, Square, X, RefreshCw } from "lucide-react";

export default function App() {
  const [sysInfo, setSysInfo] = useState({ os: "Loading...", arch: "", appVersion: "" });
  const [sum, setSum] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"dashboard" | "system">("dashboard");
  const isTauri = isTauriEnvironment();

  useEffect(() => {
    getSystemInfo().then(setSysInfo);
    calculateSum(40, 2).then(setSum);
  }, []);

  const handleMinimize = () => isTauri && getCurrentWindow().minimize();
  const handleMaximize = () => isTauri && getCurrentWindow().toggleMaximize();
  const handleClose = () => isTauri && getCurrentWindow().close();

  return (
    <div className="flex flex-col h-screen w-screen bg-neutral-950 text-neutral-100">
      {/* Frameless Desktop Titlebar */}
      <header
        data-tauri-drag-region
        className="h-10 flex items-center justify-between px-3 bg-neutral-900/90 border-b border-neutral-800 select-none"
      >
        <div data-tauri-drag-region className="flex items-center space-x-2 text-xs font-semibold tracking-wide text-neutral-300">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span>${appTitle}</span>
        </div>
        <div className="flex items-center space-x-1" data-tauri-drag-region="false">
          <button onClick={handleMinimize} aria-label="Minimize" className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-neutral-200">
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleMaximize} aria-label="Maximize" className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-neutral-200">
            <Square className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleClose} aria-label="Close" className="p-1 hover:bg-rose-900 rounded text-neutral-400 hover:text-rose-200">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 flex overflow-hidden">
        {/* Navigation Rail */}
        <nav className="w-48 bg-neutral-900/40 border-r border-neutral-800/80 p-3 space-y-1">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={\`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors \${
              activeTab === "dashboard" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "text-neutral-400 hover:bg-neutral-800/50"
            }\`}
          >
            <Activity className="w-4 h-4" />
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab("system")}
            className={\`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors \${
              activeTab === "system" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "text-neutral-400 hover:bg-neutral-800/50"
            }\`}
          >
            <Cpu className="w-4 h-4" />
            <span>System State</span>
          </button>
        </nav>

        {/* Viewport Content */}
        <section className="flex-1 p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-3">
              <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">Tauri IPC Status</h2>
              <div className="flex items-center space-x-2">
                <span className={\`w-2.5 h-2.5 rounded-full \${isTauri ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-amber-400 shadow-[0_0_8px_#fbbf24]"}\`} />
                <span className="text-base font-medium">{isTauri ? "Native IPC Connected" : "Headless Mock Active"}</span>
              </div>
              <p className="text-xs text-neutral-400">Calculation verification: 40 + 2 = {sum ?? "..."}</p>
            </div>

            <div className="p-5 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-3">
              <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">Target Metrics</h2>
              <div className="text-sm space-y-1 text-neutral-300">
                <p>Platform: <span className="font-mono text-emerald-400">{sysInfo.os}</span></p>
                <p>Architecture: <span className="font-mono text-emerald-400">{sysInfo.arch || "unknown"}</span></p>
                <p>Build Version: <span className="font-mono text-emerald-400">{sysInfo.appVersion}</span></p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
`);

  // 9. src/tauri-ipc.test.ts (Deterministic Vitest test)
  writeFile("src/tauri-ipc.test.ts", `
import { describe, it, expect } from "vitest";
import { getSystemInfo, calculateSum } from "./tauri-ipc";

describe("Tauri IPC Fallback Layer", () => {
  it("provides deterministic system info in test harness", async () => {
    const info = await getSystemInfo();
    expect(info.os).toBe("SimulatedOS");
    expect(info.appVersion).toBe("0.1.0-mock");
  });

  it("calculates sums deterministically", async () => {
    const result = await calculateSum(15, 25);
    expect(result).toBe(40);
  });
});
`);

  // 10. src-tauri/tauri.conf.json
  writeFile("src-tauri/tauri.conf.json", JSON.stringify({
    "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/refs/heads/v2/crates/tauri-cli/schema.json",
    "productName": projectName,
    "version": "0.1.0",
    "identifier": identifier,
    "build": {
      "beforeDevCommand": "npm run dev",
      "devUrl": "http://localhost:1420",
      "beforeBuildCommand": "npm run build",
      "frontendDist": "../dist"
    },
    "app": {
      "withGlobalTauri": true,
      "windows": [
        {
          "title": appTitle,
          "width": 1280,
          "height": 800,
          "minWidth": 400,
          "minHeight": 600,
          "resizable": true,
          "decorations": false,
          "transparent": false
        }
      ],
      "security": {
        "csp": "default-src 'self' 'unsafe-inline' style-src 'self' 'unsafe-inline';"
      }
    },
    "bundle": {
      "active": true,
      "targets": "all",
      "icon": [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/128x128@2x.png",
        "icons/icon.icns",
        "icons/icon.ico"
      ]
    }
  }, null, 2));

  // 11. src-tauri/Cargo.toml (With deterministic release profile)
  writeFile("src-tauri/Cargo.toml", `
[package]
name = "${projectName.toLowerCase().replace(/[^a-z0-9_]/g, "_")}"
version = "0.1.0"
description = "Production Tauri Application"
authors = ["Engineer"]
edition = "2021"

[lib]
name = "${projectName.toLowerCase().replace(/[^a-z0-9_]/g, "_")}_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2.0.0", features = [] }

[dependencies]
tauri = { version = "2.0.0", features = [] }
tauri-plugin-opener = "2.0.0"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

[profile.release]
opt-level = 3
lto = "fat"
codegen-units = 1
panic = "abort"
strip = "symbols"
overflow-checks = true
`);

  // 12. src-tauri/src/main.rs & src-tauri/src/lib.rs
  writeFile("src-tauri/src/main.rs", `
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    ${projectName.toLowerCase().replace(/[^a-z0-9_]/g, "_")}_lib::run()
}
`);

  writeFile("src-tauri/src/lib.rs", `
use serde::Serialize;

#[derive(Serialize)]
pub struct SystemInfo {
    os: String,
    arch: String,
    #[serde(rename = "appVersion")]
    app_version: String,
}

#[tauri::command]
fn get_system_info() -> SystemInfo {
    SystemInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
    }
}

#[tauri::command]
fn calculate_sum(a: i64, b: i64) -> i64 {
    a + b
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_system_info, calculate_sum])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_sum() {
        assert_eq!(calculate_sum(20, 22), 42);
    }
}
`);

  // 13. src-tauri/capabilities/default.json
  writeFile("src-tauri/capabilities/default.json", JSON.stringify({
    "$schema": "../gen/schemas/desktop-schema.json",
    "identifier": "default",
    "description": "Default capability set for production app",
    "windows": ["main"],
    "permissions": [
      "core:default",
      "opener:default"
    ]
  }, null, 2));

  // 14. src-tauri/build.rs
  writeFile("src-tauri/build.rs", `
fn main() {
    tauri_build::build()
}
`);

  // 15. Modular UI structure (components, layouts, hooks, styles, types)
  const uiResult = setupTauriUi({ projectPath });
  createdFiles.push(...uiResult.createdFiles);

  return {
    success: true,
    projectPath,
    createdFiles,
  };
}
