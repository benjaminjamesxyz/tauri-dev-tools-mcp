import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { runTauriDoctor } from "./tools/doctor.js";
import { scaffoldTauriApp } from "./tools/scaffold.js";
import { buildTauriApp } from "./tools/build.js";
import { runTauriTests } from "./tools/testing.js";
import { generateIpcMockHarness } from "./tools/ipc_mock.js";
import {
  compareUiScreenshots,
  auditUiAccessibility,
  generateDeterministicSnapshot,
} from "./tools/visual.js";
import { verifyTauriProductionReadiness } from "./tools/verify.js";
import { setupTauriUi } from "./tools/ui_setup.js";
import {
  listAndroidEmulators,
  startAndroidEmulator,
  createAndroidAvd,
  installApkOnAndroid,
  runAndroidAppTest,
} from "./tools/android_emulator.js";

const DoctorSchema = z.object({
  androidHome: z.string().optional(),
  ndkHome: z.string().optional(),
  javaHome: z.string().optional(),
});

const ScaffoldSchema = z.object({
  projectName: z.string(),
  targetDir: z.string(),
  appTitle: z.string().optional(),
  identifier: z.string().optional(),
  enableMobile: z.boolean().optional(),
});

const UiSetupSchema = z.object({
  projectPath: z.string(),
  framework: z.enum(["react", "svelte"]).optional(),
  designSystem: z.enum(["tailwind-shadcn", "minimal"]).optional(),
  includeIcons: z.boolean().optional(),
});

const BuildSchema = z.object({
  projectPath: z.string(),
  target: z.enum(["desktop", "android", "linux", "windows"]).optional(),
  debug: z.boolean().optional(),
  bundles: z.array(z.string()).optional(),
  androidHome: z.string().optional(),
  ndkHome: z.string().optional(),
  javaHome: z.string().optional(),
});

const TestRunSchema = z.object({
  projectPath: z.string(),
  scope: z.enum(["frontend", "backend", "all"]).optional(),
  testPattern: z.string().optional(),
});

const IpcMockSchema = z.object({
  commands: z.array(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      defaultResponse: z.unknown(),
      simulateError: z.boolean().optional(),
    })
  ),
  outputPath: z.string().optional(),
});

const UiDiffSchema = z.object({
  baselinePath: z.string(),
  candidatePath: z.string(),
  outputPath: z.string().optional(),
  threshold: z.number().optional(),
});

const UiAuditSchema = z.object({
  html: z.string().optional(),
  htmlPath: z.string().optional(),
});

const UiSnapshotSchema = z.object({
  outputPath: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  theme: z.enum(["dark", "light"]).optional(),
});

const VerifySchema = z.object({
  projectPath: z.string(),
});

const AndroidEmulatorListSchema = z.object({
  androidHome: z.string().optional(),
  ndkHome: z.string().optional(),
  javaHome: z.string().optional(),
});

const AndroidEmulatorStartSchema = z.object({
  avdName: z.string().optional(),
  headless: z.boolean().optional(),
  timeoutSeconds: z.number().optional(),
  autoCreate: z.boolean().optional(),
  packagePath: z.string().optional(),
  device: z.string().optional(),
  androidHome: z.string().optional(),
});

const AvdCreateSchema = z.object({
  name: z.string().describe("Name of the AVD to create."),
  packagePath: z.string().optional().describe("System image package path (e.g. system-images;android-34;google_apis;x86_64)."),
  device: z.string().optional().describe("Hardware device profile (default 'medium_phone')."),
  abi: z.string().optional().describe("Target ABI (e.g. 'x86_64')."),
  force: z.boolean().optional().describe("Overwrite if already exists (default true)."),
  androidHome: z.string().optional(),
});

const AndroidAppInstallSchema = z.object({
  apkPath: z.string(),
  deviceId: z.string().optional(),
  androidHome: z.string().optional(),
});

const AndroidTestRunSchema = z.object({
  packageName: z.string(),
  activityName: z.string().optional(),
  deviceId: z.string().optional(),
  waitLaunchMs: z.number().optional(),
  androidHome: z.string().optional(),
});
export function createTauriMcpServer(): Server {
  const server = new Server(
    {
      name: "tauri-dev-tools",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "tauri_doctor",
          description: "Inspect local toolchains: Rust, Cargo, Tauri CLI, Android SDK/NDK, Linux WebKitGTK prerequisites.",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: { type: "string", description: "Optional path to existing Tauri project to validate configuration." },
              androidHome: { type: "string", description: "Optional explicit path to Android SDK root." },
              ndkHome: { type: "string", description: "Optional explicit path to Android NDK root." },
              javaHome: { type: "string", description: "Optional explicit path to JDK 17+ root." },
            },
          },
        },
        {
          name: "tauri_scaffold",
          description: "Scaffold a production-ready Tauri v2 desktop & mobile application with modern frameless titlebar, safe areas, and test harness.",
          inputSchema: {
            type: "object",
            properties: {
              projectName: { type: "string", description: "Project directory name." },
              targetDir: { type: "string", description: "Target parent directory." },
              appTitle: { type: "string", description: "Window title." },
              identifier: { type: "string", description: "Bundle identifier (e.g. com.company.app)." },
              enableMobile: { type: "boolean", description: "Include mobile configuration." },
            },
            required: ["projectName", "targetDir"],
          },
        },
        {
          name: "tauri_ui_setup",
          description: "Set up a modern, production-grade UI architecture with components (Button, Card, Badge, Input, Titlebar), responsive layouts, safe areas, and IPC hooks.",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: { type: "string", description: "Path to frontend or Tauri project root." },
              framework: { type: "string", enum: ["react", "svelte"], description: "UI framework (default 'react')." },
              designSystem: { type: "string", enum: ["tailwind-shadcn", "minimal"], description: "Design system pattern." },
              includeIcons: { type: "boolean", description: "Include icon support." },
            },
            required: ["projectPath"],
          },
        },
        {
          name: "tauri_build",
          description: "Execute deterministic non-interactive Tauri application builds for desktop or Android targets.",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: { type: "string", description: "Path to the Tauri project directory." },
              target: { type: "string", enum: ["desktop", "android", "linux", "windows"] },
              debug: { type: "boolean", description: "Build in debug mode." },
              bundles: { type: "array", items: { type: "string" }, description: "Target bundle formats (e.g. deb, appimage, apk)." },
              androidHome: { type: "string", description: "Optional explicit path to Android SDK root." },
              ndkHome: { type: "string", description: "Optional explicit path to Android NDK root." },
              javaHome: { type: "string", description: "Optional explicit path to JDK 17+ root." },
            },
            required: ["projectPath"],
          },
        },
        {
          name: "tauri_test_run",
          description: "Run automated frontend Vitest tests and/or backend Rust tests with structured pass/fail reporting.",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: { type: "string", description: "Path to Tauri project." },
              scope: { type: "string", enum: ["frontend", "backend", "all"] },
              testPattern: { type: "string", description: "Optional filter pattern." },
            },
            required: ["projectPath"],
          },
        },
        {
          name: "tauri_ipc_mock_generate",
          description: "Generate a deterministic Tauri v2 IPC mock harness for browser, Playwright, or Vitest testing environments.",
          inputSchema: {
            type: "object",
            properties: {
              commands: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    defaultResponse: {},
                    simulateError: { type: "boolean" },
                  },
                  required: ["name", "defaultResponse"],
                },
              },
              outputPath: { type: "string" },
            },
            required: ["commands"],
          },
        },
        {
          name: "tauri_ui_diff",
          description: "Perform deterministic visual regression analysis comparing a baseline screenshot and candidate screenshot with pixelmatch.",
          inputSchema: {
            type: "object",
            properties: {
              baselinePath: { type: "string", description: "Path to baseline PNG." },
              candidatePath: { type: "string", description: "Path to candidate PNG." },
              outputPath: { type: "string", description: "Optional path to write diff PNG." },
              threshold: { type: "number", description: "Diff threshold between 0.0 and 1.0 (default 0.1)." },
            },
            required: ["baselinePath", "candidatePath"],
          },
        },
        {
          name: "tauri_ui_audit",
          description: "Audit UI accessibility (WCAG 2.1 AA) and DOM quality for Tauri webviews using axe-core and JSDOM.",
          inputSchema: {
            type: "object",
            properties: {
              html: { type: "string", description: "Raw HTML markup." },
              htmlPath: { type: "string", description: "Path to HTML file." },
            },
          },
        },
        {
          name: "tauri_ui_snapshot",
          description: "Generate a deterministic UI screenshot snapshot artifact for visual regression baseline or mock testing.",
          inputSchema: {
            type: "object",
            properties: {
              outputPath: { type: "string", description: "Output PNG path." },
              width: { type: "number", description: "Viewport width (default 1280)." },
              height: { type: "number", description: "Viewport height (default 800)." },
              theme: { type: "string", enum: ["dark", "light"] },
            },
            required: ["outputPath"],
          },
        },
        {
          name: "tauri_verify",
          description: "Run comprehensive production-readiness verification scorecard on Tauri application configuration, release profiles, and lockfiles.",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: { type: "string", description: "Path to Tauri project." },
            },
            required: ["projectPath"],
          },
        },
        {
          name: "tauri_android_emulator_list",
          description: "List available Android Virtual Devices (AVDs) and attached emulators/devices via host SDK.",
          inputSchema: {
            type: "object",
            properties: {
              androidHome: { type: "string", description: "Optional path to Android SDK root." },
              ndkHome: { type: "string", description: "Optional path to Android NDK root." },
              javaHome: { type: "string", description: "Optional path to Java JDK root." },
            },
          },
        },
        {
          name: "tauri_android_emulator_start",
          description: "Start an Android Virtual Device (AVD) in headless or windowed mode and wait for device readiness.",
          inputSchema: {
            type: "object",
            properties: {
              avdName: { type: "string", description: "Name of the AVD to start." },
              headless: { type: "boolean", description: "Run headless without display window (default true)." },
              timeoutSeconds: { type: "number", description: "Timeout in seconds waiting for device ready." },
              androidHome: { type: "string", description: "Optional path to Android SDK root." },
            },
            required: ["avdName"],
          },
        },
        {
          name: "tauri_android_app_install",
          description: "Install a built Tauri Android APK onto running emulator or connected device via ADB.",
          inputSchema: {
            type: "object",
            properties: {
              apkPath: { type: "string", description: "Path to APK file." },
              deviceId: { type: "string", description: "Optional target device ID (e.g. emulator-5554)." },
              androidHome: { type: "string", description: "Optional path to Android SDK root." },
            },
            required: ["apkPath"],
          },
        },
        {
          name: "tauri_android_test_run",
          description: "Launch installed Android app on emulator/device, measure startup time, and check logcat for runtime crashes.",
          inputSchema: {
            type: "object",
            properties: {
              packageName: { type: "string", description: "Application package name (e.g. com.company.app)." },
              activityName: { type: "string", description: "Activity name (default '.MainActivity')." },
              deviceId: { type: "string", description: "Optional target device ID." },
              waitLaunchMs: { type: "number", description: "Wait duration in ms." },
              androidHome: { type: "string", description: "Optional path to Android SDK root." },
            },
            required: ["packageName"],
          },
        },
        {
          name: "tauri_android_avd_create",
          description: "Create and configure an Android Virtual Device (AVD) using avdmanager.",
          inputSchema: {
            type: "object",
            properties: {
              name: { type: "string", description: "Name of the AVD to create." },
              packagePath: { type: "string", description: "System image package path." },
              device: { type: "string", description: "Hardware device definition (e.g. 'medium_phone', 'pixel')." },
              abi: { type: "string", description: "Target ABI (e.g. 'x86_64')." },
              force: { type: "boolean", description: "Overwrite existing AVD." },
              androidHome: { type: "string", description: "Optional path to Android SDK root." },
            },
            required: ["name"],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs } = request.params;
    const safeArgs = rawArgs ?? {};

    switch (name) {
      case "tauri_doctor": {
        const args = DoctorSchema.parse(safeArgs);
        const report = runTauriDoctor(args);
        return {
          content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
        };
      }

      case "tauri_scaffold": {
        const args = ScaffoldSchema.parse(safeArgs);
        const result = scaffoldTauriApp(args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "tauri_ui_setup": {
        const args = UiSetupSchema.parse(safeArgs);
        const result = setupTauriUi(args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }
      case "tauri_build": {
        const args = BuildSchema.parse(safeArgs);
        const result = buildTauriApp(args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "tauri_test_run": {
        const args = TestRunSchema.parse(safeArgs);
        const result = runTauriTests(args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "tauri_ipc_mock_generate": {
        const args = IpcMockSchema.parse(safeArgs);
        const result = generateIpcMockHarness(args);
        return {
          content: [
            {
              type: "text",
              text: result.writtenPath
                ? `Generated mock harness written to: ${result.writtenPath}`
                : result.code,
            },
          ],
        };
      }

      case "tauri_ui_diff": {
        const args = UiDiffSchema.parse(safeArgs);
        const result = compareUiScreenshots(args);
        const contents: Array<
          { type: "text"; text: string } | { type: "image"; data: string; mimeType: "image/png" }
        > = [
          {
            type: "text",
            text: JSON.stringify(
              {
                match: result.match,
                totalPixels: result.totalPixels,
                diffPixels: result.diffPixels,
                diffPercentage: `${result.diffPercentage}%`,
                width: result.width,
                height: result.height,
                writtenPath: result.writtenPath,
              },
              null,
              2
            ),
          },
        ];

        if (result.diffImageBase64) {
          contents.push({
            type: "image",
            data: result.diffImageBase64,
            mimeType: "image/png",
          });
        }
        return { content: contents };
      }

      case "tauri_ui_audit": {
        const args = UiAuditSchema.parse(safeArgs);
        const result = await auditUiAccessibility(args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "tauri_ui_snapshot": {
        const args = UiSnapshotSchema.parse(safeArgs);
        const writtenPath = generateDeterministicSnapshot(args);
        return {
          content: [{ type: "text", text: `Snapshot successfully generated at: ${writtenPath}` }],
        };
      }

      case "tauri_verify": {
        const args = VerifySchema.parse(safeArgs);
        const result = verifyTauriProductionReadiness(args.projectPath);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "tauri_android_emulator_list": {
        const args = AndroidEmulatorListSchema.parse(safeArgs);
        const result = listAndroidEmulators(args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "tauri_android_emulator_start": {
        const args = AndroidEmulatorStartSchema.parse(safeArgs);
        const result = startAndroidEmulator(args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "tauri_android_avd_create": {
        const args = AvdCreateSchema.parse(safeArgs);
        const result = createAndroidAvd(args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "tauri_android_app_install": {
        const args = AndroidAppInstallSchema.parse(safeArgs);
        const result = installApkOnAndroid(args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "tauri_android_test_run": {
        const args = AndroidTestRunSchema.parse(safeArgs);
        const result = runAndroidAppTest(args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  });

  return server;
}
