# Tauri Dev Tools MCP - Sprint Plan

## Sprint Objective
Deliver a production-ready Model Context Protocol (MCP) server named `tauri-dev-tools` that equips AI agents and developers to scaffold, build, test, and visually inspect high-quality Tauri v2 applications deterministically across desktop and mobile targets.

---

## 1. System Architecture

```
                       MCP Client (Claude / Cursor / omp)
                                     │
                     JSON-RPC 2.0 (stdio transport)
                                     ▼
                   ┌───────────────────────────────────┐
                   │   tauri-dev-tools MCP Server      │
                   │   (@modelcontextprotocol/sdk)     │
                   └─┬──────────────┬───────────────┬──┘
                     │              │               │
        ┌────────────┴───┐   ┌──────┴─────────┐   ┌─┴────────────────┐
        │ Scaffolding &  │   │ Testing & IPC  │   │ Visual Analysis  │
        │ Build Engine   │   │ Engine         │   │ Engine           │
        └─┬──────────────┘   └──────┬─────────┘   └──┬───────────────┘
          │                         │                │
     Cargo / Tauri CLI         Vitest / Cargo    Playwright / Puppeteer
     Toolchain Doctor          IPC Mock Bridge   PNG Diff & Axe A11y
```

---

## 2. Tool Inventory & Contracts

### Category A: Environment & Scaffolding
1. **`tauri_doctor`**
   - Inputs: none or `projectPath?: string`
   - Checks: Rust, Cargo, Tauri CLI, Node/npm/pnpm/bun, Android SDK/NDK, Linux WebKitGTK / Windows WebView2.
   - Outputs: Diagnostic health check with actionable fix instructions.

2. **`tauri_scaffold`**
   - Inputs: `projectName: string`, `targetDir: string`, `template: "react-tailwind" | "svelte-tailwind"`, `appTitle: string`, `identifier: string`, `enableMobile: boolean`
   - Actions: Generates clean production-grade Tauri v2 project structure:
     - Frameless custom titlebar for desktop with `data-tauri-drag-region`
     - Responsive mobile layout with safe-area insets
     - Modern design system (dark/light theme, modern typography, glassmorphism/borders)
     - Mocked Tauri IPC harness for browser/test environments
     - Deterministic release profiles in `Cargo.toml` and `tauri.conf.json`

3. **`tauri_build`**
   - Inputs: `projectPath: string`, `target?: "desktop" | "android" | "linux" | "windows"`, `debug?: boolean`, `bundles?: string[]`
   - Actions: Executes non-interactive production/debug build with deterministic flags.

### Category B: Testing & IPC
4. **`tauri_test_run`**
   - Inputs: `projectPath: string`, `scope: "frontend" | "backend" | "all"`, `testPattern?: string`
   - Actions: Runs Vitest or `cargo test` with structured test outcome parsing (pass/fail/duration/traces).

5. **`tauri_ipc_mock_generate`**
   - Inputs: `commands: Array<{ name: string, inputSchema?: object, outputExample: any }>`
   - Actions: Generates type-safe TypeScript IPC mock router and Vitest setup file for deterministic tests.

### Category C: Visual Analysis & UI Auditing
6. **`tauri_ui_screenshot`**
   - Inputs: `urlOrPath: string`, `viewport?: { width: number, height: number }`, `deviceScaleFactor?: number`, `mockIpc?: boolean`
   - Actions: Captures deterministic screenshot (frozen animations, fixed fonts, transparent caret) as Base64 PNG.

7. **`tauri_ui_diff`**
   - Inputs: `baselineImagePath: string`, `candidateImagePath: string`, `threshold?: number`
   - Actions: Computes pixel-by-pixel diff via `pixelmatch`, returns diff percentage, bounding boxes, and base64 diff image artifact.

8. **`tauri_ui_audit`**
   - Inputs: `htmlOrUrl: string`
   - Actions: Executes automated accessibility (WCAG 2.1 AA) and DOM analysis (contrast, labels, landmarks, touch targets).

### Category D: Production Verification
9. **`tauri_verify`**
   - Inputs: `projectPath: string`
   - Actions: Runs full production scorecard (typecheck, linting, security audit, tauri.conf.json validation, asset integrity).

---

## 3. Sprint Phases

### Phase 1: Environment & Project Setup
- Setup package.json, TypeScript, dependencies (`@modelcontextprotocol/sdk`, `zod`, `pngjs`, `pixelmatch`).
- Establish stdio isolation (redirect `console.log` to stderr).

### Phase 2: Core Tool Implementation
- Scaffolding templates & file generator.
- Build & doctor execution manager.
- Testing & IPC mock generator.
- Visual analysis & pixel diff engine.
- Production scorecard verifier.

### Phase 3: Testing & Verification
- Unit & integration tests for all tools.
- End-to-end verification running the server via stdio JSON-RPC.
- Smoke test generating an app, testing visual diffing, and verifying production score.
