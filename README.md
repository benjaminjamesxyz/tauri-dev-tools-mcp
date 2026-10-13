# Tauri Dev Tools MCP Server

Production-ready Model Context Protocol (MCP) tool suite designed to build, test, and visually inspect Tauri v2 applications deterministically across desktop (Linux, Windows, macOS) and mobile (Android) platforms.

## Capabilities & Tools

| Tool | Description |
|---|---|
| `tauri_doctor` | Inspects host toolchains (Rust, Cargo, Tauri CLI, Node, Android SDK/NDK, Linux WebKitGTK). |
| `tauri_scaffold` | Scaffolds production-grade Tauri v2 app with modern React/Tailwind design, frameless titlebar, mobile safe areas, and test harness. |
| `tauri_ui_setup` | Sets up modular UI architecture: UI primitives (`Button`, `Card`, `Badge`, `Input`), layout primitives (`Titlebar`, `Sidebar`, `MobileNav`, `AppLayout`), and hooks (`useWindowControls`, `useTheme`, `useIpc`). |
| `tauri_build` | Executes non-interactive, deterministic builds for desktop or Android targets with pinned timestamps and release flags. |
| `tauri_test_run` | Runs Vitest frontend and/or Cargo backend test suites with structured error and duration reporting. |
| `tauri_ipc_mock_generate` | Generates type-safe `window.__TAURI_INTERNALS__` mock routers for headless tests and browser previews. |
| `tauri_ui_diff` | Computes pixel-by-pixel visual regression between baseline and candidate PNGs via `pixelmatch`, returning base64 diff images. |
| `tauri_ui_audit` | Evaluates UI accessibility (WCAG 2.1 AA) and DOM quality for Tauri webviews using `axe-core` and JSDOM. |
| `tauri_ui_snapshot` | Generates deterministic layout snapshot artifacts for visual regression testing. |
| `tauri_verify` | Runs comprehensive production scorecard (bundle IDs, CSP security, release profiles, lockfiles). |
| `tauri_android_emulator_list` | Discovers available Android Virtual Devices (AVDs) and active ADB devices. |
| `tauri_android_emulator_start` | Boots Android emulator in headless or windowed mode and waits for ready status. |
| `tauri_android_avd_create` | Creates/configures an Android Virtual Device (AVD) using host `avdmanager`. |
| `tauri_android_app_install` | Installs built Tauri APK onto running emulator or device via ADB. |
| `tauri_android_test_run` | Launches installed Android app, measures startup performance, and scans logcat for fatal exceptions. |

### Installation & Build
```bash
bun install
bun run build
```

### Running Tests
```bash
bun test
```

### Adding to MCP Clients (Claude Desktop / Cursor / omp)
Add to your client MCP configuration:

```json
{
  "mcpServers": {
    "tauri-dev-tools": {
      "command": "node",
      "args": ["/home/simson/omp/tauri-dev-tools/dist/index.js"]
    }
  }
}
```

## Associated Agent Skill
- Skill Specification: [`SKILL.md`](./SKILL.md) (mirrored to [`.agents/skills/tauri-dev-tools/SKILL.md`](./.agents/skills/tauri-dev-tools/SKILL.md)).
- Provides AI agents with decision trees, failure remediation, and step-by-step operating recipes for all 10 MCP tools.

## Research Board & Architecture
- Research findings across 6 parallel streams: `RESEARCH_BOARD.md`
- Sprint backlog & technical specifications: `SPRINT_PLAN.md`
