import { describe, it, expect, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  generateDeterministicSnapshot,
  compareUiScreenshots,
  auditUiAccessibility,
} from "../src/tools/visual.js";

describe("Tauri Visual Analysis Tools", () => {
  const tmpDir = path.resolve("./tmp_visual_test");
  const baselinePng = path.join(tmpDir, "baseline.png");
  const candidatePng = path.join(tmpDir, "candidate.png");
  const changedPng = path.join(tmpDir, "changed.png");
  const diffOutPng = path.join(tmpDir, "diff.png");

  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("generates deterministic PNG snapshot and compares matching images", () => {
    generateDeterministicSnapshot({
      outputPath: baselinePng,
      width: 100,
      height: 100,
      theme: "dark",
      primaryColorRgb: [52, 211, 153],
    });

    generateDeterministicSnapshot({
      outputPath: candidatePng,
      width: 100,
      height: 100,
      theme: "dark",
      primaryColorRgb: [52, 211, 153],
    });

    expect(fs.existsSync(baselinePng)).toBe(true);

    const diffResult = compareUiScreenshots({
      baselinePath: baselinePng,
      candidatePath: candidatePng,
      outputPath: diffOutPng,
    });

    expect(diffResult.match).toBe(true);
    expect(diffResult.diffPixels).toBe(0);
    expect(diffResult.diffPercentage).toBe(0);
    expect(diffResult.diffImageBase64).toBeDefined();
  });

  it("detects pixel mismatches and outputs diff image", () => {
    generateDeterministicSnapshot({
      outputPath: changedPng,
      width: 100,
      height: 100,
      theme: "dark",
      primaryColorRgb: [239, 68, 68], // different color
    });

    const diffResult = compareUiScreenshots({
      baselinePath: baselinePng,
      candidatePath: changedPng,
      outputPath: diffOutPng,
    });

    expect(diffResult.match).toBe(false);
    expect(diffResult.diffPixels).toBeGreaterThan(0);
    expect(diffResult.diffPercentage).toBeGreaterThan(0);
    expect(fs.existsSync(diffOutPng)).toBe(true);
  });

  it("audits UI accessibility with axe-core", async () => {
    // Bad HTML missing image alt
    const badHtml = `
      <!doctype html>
      <html lang="en">
        <head><title>Test App</title></head>
        <body>
          <main>
            <h1>Heading</h1>
            <img src="test.png">
          </main>
        </body>
      </html>
    `;

    const badResult = await auditUiAccessibility({ html: badHtml });
    expect(badResult.violationCount).toBeGreaterThan(0);
    expect(badResult.violations.some(v => v.id === "image-alt")).toBe(true);
    expect(badResult.score).toBeLessThan(100);

    // Clean HTML
    const cleanHtml = `
      <!doctype html>
      <html lang="en">
        <head><title>Accessible Tauri App</title></head>
        <body>
          <main>
            <h1>Accessible App</h1>
            <p>Welcome to the production app.</p>
          </main>
        </body>
      </html>
    `;

    const cleanResult = await auditUiAccessibility({ html: cleanHtml });
    expect(cleanResult.violationCount).toBe(0);
    expect(cleanResult.score).toBe(100);
  });
});
