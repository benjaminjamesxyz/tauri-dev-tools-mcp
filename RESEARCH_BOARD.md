# Tauri Dev Tools MCP - Consolidated Research Board

Comprehensive findings across 6 research streams for building a production-ready Tauri v2 MCP developer tool.

---

## Stream 1: Multi-Platform Build Pipelines (Windows, Linux, Android)

### 1. Tauri v2 CLI Workflow
- Non-interactive flags: `--ci` or `CI=true` must be set for all CLI executions to suppress interactive prompts.
- Scaffolding: `cargo tauri init --ci --app-name <name> --window-title <title> --frontend-dist <path> --dev-url <url>`.
- Desktop Build: `cargo tauri build --ci [--debug] [--target <triple>] [--bundles deb,appimage,msi,nsis]`.
- Android Scaffolding: `cargo tauri android init --ci --skip-targets-install`.
- Android Build: `cargo tauri android build --ci [--apk] [--aab] [--target aarch64|x86_64] [--split-per-abi]`.

### 2. Platform Toolchains & System Dependencies
- **Linux**: Requires `libwebkit2gtk-4.1-dev` (or WebKitGTK 6.0), `build-essential`, `libssl-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `squashfs-tools`.
- **Windows**: Requires MSVC C++ build tools (Visual Studio 2022), WebView2 Runtime (evergreen).
- **Android**: Requires JDK 17 (`JAVA_HOME`), Android SDK command-line tools (`ANDROID_HOME`), NDK (r25c-r27b, `NDK_HOME`), target rust triples (`aarch64-linux-android`, `x86_64-linux-android`).

### 3. Non-Interactive Automation in MCP
- MCP tool should provide environment diagnostics (`doctor` tool) validating CLI versions, rustup targets, compiler toolchains, and environment paths.
- Execution should run via streaming sub-processes with ring-buffered stdout/stderr and explicit cancellation (`AbortController` / process tree kill).

---

## Stream 2: Deterministic Testing Frameworks & IPC Mocking

### 1. Test Layering
1. **Frontend Unit Tests (Vitest + JSDOM)**: Fast (~10-50ms), validates UI components with mocked `@tauri-apps/api/core` via `window.__TAURI_INTERNALS__`.
2. **Backend Unit Tests (Cargo Test)**: Rust unit tests separating business logic from `AppHandle`. Uses `tauri::test::MockRuntime` for IPC commands.
3. **Headless Integration Tests (Playwright + Mocked IPC)**: Full frontend DOM and routing in headless Chromium/WebKit. `page.addInitScript()` intercepts `invoke`, `listen`, `emit` deterministically.
4. **Native E2E Tests (`tauri-driver` + WebdriverIO)**: True binary testing on WebKitGTK/WebView2 via W3C WebDriver (ports 4444 -> 4445). Uses `Xvfb` on headless Linux.

### 2. Deterministic IPC Interception Spec
- Mocking wire protocol: `window.__TAURI_INTERNALS__.invoke(cmd, payload)` returns controlled JSON responses or throws simulated errors.
- Event mocking: `window.__TAURI_INTERNALS__.transformCallback(callback, once)` enables unit testing of Tauri event listeners.

---

## Stream 3: Visual Analysis & Deterministic UI Validation

### 1. Deterministic Screenshot Capture
- **Harness Mode**: Headless browser (Chromium/WebKit) serving the frontend build or dev server with mocked IPC. 100% deterministic, no OS GPU/display quirks.
- **Native Snapshot Mode**: `Xvfb` + Tauri binary or DevTools remote CDP port (`--remote-debugging-port=9222`).
- **Determinism Enforcement Rules**:
  - Lock viewport dimensions (`1280x800`) and device pixel ratio (`1.0`).
  - Disable all animations and transitions (`*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }`).
  - Await font loading (`document.fonts.ready`) with bundled webfonts.
  - Freeze virtual clock (`Date.now()`, `performance.now()`).

### 2. Visual Regression & Analysis Pipeline
- Pixel comparison via `pixelmatch` algorithm with configurable threshold (default `0.1`) and anti-aliasing detection.
- Return structured diff metrics: `totalPixels`, `diffPixels`, `diffPercentage`, and base64 diff image with highlighted mismatch zones.
- Accessibility & DOM audit via `axe-core`: extract WCAG 2.1 AA violations, contrast failures, missing aria labels, and DOM structure.

---

## Stream 4: MCP Server Architecture & Tool Interface Design

### 1. Protocol & Transport
- Built on `@modelcontextprotocol/sdk` over `StdioServerTransport`.
- Critical: `console.log` redirected to `process.stderr` to prevent JSON-RPC corruption on stdout.
- Structured tool responses: text payloads (JSON/markdown) and visual artifacts (Base64 PNG images with `type: "image"`).

### 2. Core Tool Portfolio
1. `tauri_doctor`: Inspect host environment, Rust/Node/Android toolchains, prerequisites.
2. `tauri_scaffold`: Generate production-ready Tauri v2 app with modern template (React/Tailwind, custom titlebar, responsive layout, mocked IPC).
3. `tauri_build`: Execute and monitor desktop/mobile builds with deterministic flags.
4. `tauri_test_run`: Execute frontend unit/integration tests or Rust backend tests with structured failure reports.
5. `tauri_ui_screenshot`: Deterministic screenshot capture of app viewports or components.
6. `tauri_ui_diff`: Compare current visual output against baseline image with pixelmatch analysis.
7. `tauri_ui_audit`: Run automated accessibility (WCAG) and DOM layout analysis on UI views.
8. `tauri_verify`: Run comprehensive production-readiness scorecard (linter, types, security, bundle check).

---

## Stream 5: Modern Frontend Architecture & Design Systems for Tauri

### 1. Recommended Stacks
- **Desktop/Mobile Pro**: React 19 + TypeScript + Vite + Tailwind CSS.
- Component architecture: Frameless custom titlebar (`data-tauri-drag-region`) for desktop; responsive drawer/tabs with safe-area insets (`env(safe-area-inset-*)`) for Android.
- Dark/light system theme synchronization with `@tauri-apps/api/window` theme listeners.
- Typed IPC bridge pattern isolating raw `invoke` calls into typed service clients with mock fallbacks.

---

## Stream 6: Deterministic Build, Release & Verification Strategies

### 1. Reproducibility Configuration
- Rust: `codegen-units = 1`, `lto = "fat"`, `panic = "abort"`, `--remap-path-prefix` to strip host filesystem paths.
- Locked dependency versions: `Cargo.lock` and `package-lock.json` / `pnpm-lock.yaml`.
- Timestamps: set `SOURCE_DATE_EPOCH` to normalize archive and binary build timestamps.

### 2. Production Verification Scorecard
- Static checks: TypeScript `tsc --noEmit`, ESLint, `cargo clippy -- -D warnings`.
- Security audit: `cargo audit` / `npm audit`.
- Configuration validation: Validate `tauri.conf.json` bundle identifiers, security capabilities, CSP permissions.
- Artifact scorecard: Inspect generated bundle size, permissions, and dependencies.
