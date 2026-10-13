---
name: tauri-dev-tools
description: >
  Manage, build, scaffold, test, and visually inspect Tauri v2 desktop and mobile
  applications deterministically. Use when building, testing, auditing, or configuring
  Tauri applications (Linux, Windows, Android). Triggers: "tauri", "tauri app",
  "tauri build", "tauri test", "tauri ui", "tauri verify", "desktop app".
argument-hint: "[scaffold|ui|build|test|visual|verify]"
license: MIT
---

# Tauri Dev Tools Skill

Operate the `tauri-dev-tools` Model Context Protocol (MCP) server to develop, test, visually validate, and verify production-grade Tauri v2 applications across Linux, Windows, and Android.

## Tool Inventory & Call Signatures

| Tool | Purpose | Primary Parameters |
|---|---|---|
| `tauri_doctor` | Inspect host toolchain readiness | `{ projectPath?: string, androidHome?: string, ndkHome?: string, javaHome?: string }` |
| `tauri_scaffold` | Scaffold complete Tauri v2 project | `{ projectName: string, targetDir: string, appTitle?: string, identifier?: string, enableMobile?: boolean }` |
| `tauri_ui_setup` | Inject modern modular UI architecture | `{ projectPath: string, framework?: "react"|"svelte", designSystem?: "tailwind-shadcn"|"minimal" }` |
| `tauri_build` | Execute deterministic non-interactive build | `{ projectPath: string, target?: "desktop"|"android"|"linux"|"windows", debug?: boolean, bundles?: string[], androidHome?: string, ndkHome?: string, javaHome?: string }` |
| `tauri_ipc_mock_generate` | Generate typed IPC mock router | `{ commands: Array<{ name: string, defaultResponse: any, simulateError?: boolean }>, outputPath?: string }` |
| `tauri_ui_snapshot` | Generate deterministic baseline PNG | `{ outputPath: string, width?: number, height?: number, theme?: "dark"|"light" }` |
| `tauri_ui_diff` | Visual pixel diff between PNG screenshots | `{ baselinePath: string, candidatePath: string, outputPath?: string, threshold?: number }` |
| `tauri_ui_audit` | WCAG 2.1 AA accessibility & DOM audit | `{ html?: string, htmlPath?: string }` |
| `tauri_verify` | Production readiness audit scorecard | `{ projectPath: string }` |
| `tauri_android_emulator_list` | List available AVDs & attached devices | `{ androidHome?: string, ndkHome?: string, javaHome?: string }` |
| `tauri_android_emulator_start` | Start Android emulator (headless/windowed) | `{ avdName?: string, headless?: boolean, timeoutSeconds?: number, autoCreate?: boolean }` |
| `tauri_android_avd_create` | Create/configure AVD via avdmanager | `{ name: string, packagePath?: string, device?: string, force?: boolean }` |
| `tauri_android_app_install` | Install APK onto emulator or device | `{ apkPath: string, deviceId?: string }` |
| `tauri_android_test_run` | Launch Android app & inspect logcat | `{ packageName: string, activityName?: string, deviceId?: string }` |

## Standard Workflows

### 1. New Production Application Lifecycle
When asked to create a new Tauri desktop or mobile application:
1. **Pre-flight Check**: Call `tauri_doctor` to verify host toolchains (Rust, Cargo, WebKitGTK / WebView2, Node).
2. **Scaffolding**: Call `tauri_scaffold` with a unique reverse-DNS identifier (e.g. `com.company.myapp`).
   - Generates frameless titlebar with `data-tauri-drag-region`.
   - Generates deterministic release profile in `Cargo.toml` (`codegen-units = 1`, `lto = "fat"`, `panic = "abort"`).
   - Generates safe-area insets for Android and modular UI directory tree.
3. **Verify Configuration**: Call `tauri_verify({ projectPath: "<path>" })`. Ensure score $\ge 80$.

### 2. Upgrading Existing Frontend with Tauri UI Architecture
When asked to enhance or structure the UI for an existing Tauri project:
1. **UI Injection**: Call `tauri_ui_setup({ projectPath: "<path>" })`.
2. **Components Installed**:
   - Primitives: `src/components/ui/` (`button.tsx`, `card.tsx`, `badge.tsx`, `input.tsx`).
   - Layouts: `src/components/layout/` (`titlebar.tsx`, `sidebar.tsx`, `mobile-nav.tsx`, `app-layout.tsx`).
   - Hooks: `src/hooks/` (`use-window-controls.ts`, `use-theme.ts`, `use-ipc.ts`).
   - Tokens: `src/styles/theme.css` with CSS variables for light/dark and safe areas.
3. **Custom Window Drag**: Ensure headers use `data-tauri-drag-region` and window buttons set `data-tauri-drag-region="false"`.

### 3. Deterministic Testing & IPC Mocking
When testing without launching native webviews:
1. **Generate Mock Router**: Call `tauri_ipc_mock_generate` specifying command names and responses.
2. **Headless Execution**: Use generated harness in Vitest or Playwright. Intercepts `window.__TAURI_INTERNALS__.invoke` without OS display dependencies.
3. **Run Test Suites**: Call `tauri_test_run({ projectPath: "<path>", scope: "all" })` to capture structured pass/fail results.

### 4. Visual Analysis & Accessibility Gate
Before releasing or merging UI changes:
1. **Capture Baseline / Candidate**: Use `tauri_ui_snapshot` or capture webview screenshots.
2. **Pixel Diffing**: Call `tauri_ui_diff({ baselinePath: "<base>", candidatePath: "<cand>", threshold: 0.1 })`.
   - If `match` is false, inspect returned `diffPercentage` and `diffImageBase64` highlighting changes in neon pink.
3. **Accessibility Audit**: Call `tauri_ui_audit({ htmlPath: "<dist/index.html>" })`.
   - Flags critical violations (missing `alt` tags, broken button names, unlabeled forms).
   - Target accessibility score: $100$.

### 5. Multi-Platform Build Pipeline
1. **Linux Build**:
   - `tauri_build({ projectPath: "<path>", target: "linux", bundles: ["deb", "appimage"] })`.
2. **Android Build**:
   - Check `tauri_doctor`. Ensure `ANDROID_HOME` and `NDK_HOME` are present.
   - `tauri_build({ projectPath: "<path>", target: "android" })`.

### 6. Android Virtual Emulator Testing & Pre-Shipping Validation
1. **Discover Devices**: Call `tauri_android_emulator_list` to list configured AVDs and active adb targets.
2. **Configure/Create AVD**: Call `tauri_android_avd_create({ name: "tauri_test_device", device: "medium_phone" })` or pass `autoCreate: true` to `tauri_android_emulator_start`.
3. **Start Emulator**: Call `tauri_android_emulator_start({ avdName: "<avd>", headless: true, autoCreate: true })` to boot headless target in background.
4. **Validate & Smoke Test**: Call `tauri_android_test_run({ packageName: "com.company.app" })` to measure launch time and inspect logcat stream for crashes.
---

## Decision Trees & Remediation

```
Issue: Window Dragging Fails
├─ Cause: Missing drag attribute on header container
│  └─ Fix: Add `data-tauri-drag-region` to titlebar container.
└─ Cause: Window buttons trigger drag instead of clicks
   └─ Fix: Wrap control buttons in `data-tauri-drag-region="false"`.

Issue: Tauri IPC Fails in Headless Test
├─ Cause: `window.__TAURI_INTERNALS__` undefined in test runner
└─ Fix: Run `tauri_ipc_mock_generate` and import mock harness before tests.

Issue: Build Fails with "identifier must be unique"
├─ Cause: `tauri.conf.json` still uses default "com.tauri.dev"
└─ Fix: Run `tauri_verify` to audit; replace identifier with production domain.

Issue: Visual Diff Reports False Positives
├─ Cause: Font anti-aliasing or active animations
└─ Fix: Freeze animations (`animation-duration: 0s !important`), wait for fonts, or set `threshold: 0.15`.
```
