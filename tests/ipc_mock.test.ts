import { describe, it, expect, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { generateIpcMockHarness } from "../src/tools/ipc_mock.js";

describe("Tauri IPC Mock Generator Tool", () => {
  const tmpOut = path.resolve("./tmp_mock_test.ts");

  afterAll(() => {
    if (fs.existsSync(tmpOut)) {
      fs.unlinkSync(tmpOut);
    }
  });

  it("generates deterministic TypeScript mock router code", () => {
    const result = generateIpcMockHarness({
      commands: [
        {
          name: "get_user",
          defaultResponse: { id: "usr_123", name: "Alice" },
        },
        {
          name: "fail_action",
          defaultResponse: null,
          simulateError: true,
        },
      ],
      outputPath: tmpOut,
    });

    expect(result.code).toContain('case "get_user":');
    expect(result.code).toContain('"usr_123"');
    expect(result.code).toContain('throw new Error("Simulated IPC error for fail_action");');
    expect(result.code).toContain("window.__TAURI_INTERNALS__");
    expect(fs.existsSync(tmpOut)).toBe(true);
  });
});
