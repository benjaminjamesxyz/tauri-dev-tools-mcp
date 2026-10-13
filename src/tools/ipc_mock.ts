import fs from "node:fs";
import path from "node:path";

export interface IpcCommandMock {
  name: string;
  description?: string;
  defaultResponse?: unknown;
  simulateError?: boolean;
}

export interface IpcMockGeneratorOptions {
  commands: IpcCommandMock[];
  outputPath?: string;
}

export interface IpcMockGeneratorResult {
  code: string;
  writtenPath?: string;
}

export function generateIpcMockHarness(options: IpcMockGeneratorOptions): IpcMockGeneratorResult {
  const { commands, outputPath } = options;

  const commandCases = commands.map(cmd => {
    const serializedResponse = JSON.stringify(cmd.defaultResponse, null, 2);
    if (cmd.simulateError) {
      return `      case "${cmd.name}":
        throw new Error("Simulated IPC error for ${cmd.name}");`;
    }
    return `      case "${cmd.name}":
        return ${serializedResponse};`;
  }).join("\n");

  const code = `/**
 * Generated Deterministic Tauri v2 IPC Mock Harness
 * Provides full window.__TAURI_INTERNALS__ mocking for browser and test runners.
 */

export interface TauriMockState {
  invocations: Array<{ cmd: string; args: unknown }>;
  customHandlers: Map<string, (args: unknown) => unknown>;
}

export const mockState: TauriMockState = {
  invocations: [],
  customHandlers: new Map(),
};

export function setupTauriIpcMock(): void {
  if (typeof window === "undefined") {
    return;
  }

  const internals = {
    invoke: async (cmd: string, args?: unknown): Promise<unknown> => {
      mockState.invocations.push({ cmd, args });

      if (mockState.customHandlers.has(cmd)) {
        const handler = mockState.customHandlers.get(cmd)!;
        return handler(args);
      }

      switch (cmd) {
${commandCases}
        default:
          console.warn("[Tauri IPC Mock] Unhandled command:", cmd, args);
          return null;
      }
    },
    metadata: {
      currentWindow: { label: "main" },
    },
  };

  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    value: internals,
    writable: true,
    configurable: true,
  });
}

export function registerMockCommand(cmd: string, handler: (args: unknown) => unknown): void {
  mockState.customHandlers.set(cmd, handler);
}

export function clearMockInvocations(): void {
  mockState.invocations = [];
}
`;

  let writtenPath: string | undefined;
  if (outputPath) {
    const absOut = path.resolve(outputPath);
    fs.mkdirSync(path.dirname(absOut), { recursive: true });
    fs.writeFileSync(absOut, code, "utf8");
    writtenPath = absOut;
  }

  return {
    code,
    writtenPath,
  };
}
