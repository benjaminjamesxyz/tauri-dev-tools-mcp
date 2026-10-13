import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { JSDOM } from "jsdom";
import axe from "axe-core";

export interface UiDiffOptions {
  baselinePath: string;
  candidatePath: string;
  outputPath?: string;
  threshold?: number;
}

export interface UiDiffResult {
  match: boolean;
  totalPixels: number;
  diffPixels: number;
  diffPercentage: number;
  width: number;
  height: number;
  diffImageBase64?: string;
  writtenPath?: string;
}

export function compareUiScreenshots(options: UiDiffOptions): UiDiffResult {
  const { baselinePath, candidatePath, outputPath, threshold = 0.1 } = options;

  const baselineBuf = fs.readFileSync(path.resolve(baselinePath));
  const candidateBuf = fs.readFileSync(path.resolve(candidatePath));

  const img1 = PNG.sync.read(baselineBuf);
  const img2 = PNG.sync.read(candidateBuf);

  if (img1.width !== img2.width || img1.height !== img2.height) {
    throw new Error(
      `Image dimensions do not match: baseline is ${img1.width}x${img1.height}, candidate is ${img2.width}x${img2.height}`
    );
  }

  const { width, height } = img1;
  const diffPng = new PNG({ width, height });

  const diffPixels = pixelmatch(img1.data, img2.data, diffPng.data, width, height, {
    threshold,
    includeAA: false,
    diffColor: [255, 0, 96],
  });

  const totalPixels = width * height;
  const diffPercentage = Number(((diffPixels / totalPixels) * 100).toFixed(4));
  const match = diffPixels === 0;

  const diffBuf = PNG.sync.write(diffPng);
  const diffImageBase64 = diffBuf.toString("base64");

  let writtenPath: string | undefined;
  if (outputPath) {
    const absOut = path.resolve(outputPath);
    fs.mkdirSync(path.dirname(absOut), { recursive: true });
    fs.writeFileSync(absOut, diffBuf);
    writtenPath = absOut;
  }

  return {
    match,
    totalPixels,
    diffPixels,
    diffPercentage,
    width,
    height,
    diffImageBase64,
    writtenPath,
  };
}

export interface UiAuditOptions {
  html?: string;
  htmlPath?: string;
}

export interface AuditViolation {
  id: string;
  impact: "minor" | "moderate" | "serious" | "critical";
  description: string;
  help: string;
  nodes: Array<{ html: string; target: string[] }>;
}

export interface UiAuditResult {
  score: number;
  violationCount: number;
  passCount: number;
  violations: AuditViolation[];
  passes: string[];
}

export async function auditUiAccessibility(options: UiAuditOptions): Promise<UiAuditResult> {
  let content = options.html;
  if (!content && options.htmlPath) {
    content = fs.readFileSync(path.resolve(options.htmlPath), "utf8");
  }

  if (!content) {
    throw new Error("Either html or htmlPath must be provided for UI audit");
  }

  const dom = new JSDOM(content);
  const { window } = dom;

  const results = await axe.run(window.document.documentElement, {
    rules: {
      "color-contrast": { enabled: false }, // avoid jsdom canvas stub requirement
    },
  });

  const violations: AuditViolation[] = results.violations.map(v => ({
    id: v.id,
    impact: (v.impact as AuditViolation["impact"]) || "moderate",
    description: v.description,
    help: v.help,
    nodes: v.nodes.map(n => ({ html: n.html, target: n.target.map(String) })),
  }));

  const passCount = results.passes.length;
  const violationCount = violations.length;
  // Penalty-based score calculation
  const penalty = violations.reduce((acc, curr) => {
    const weights: Record<AuditViolation["impact"], number> = {
      minor: 3,
      moderate: 7,
      serious: 15,
      critical: 25,
    };
    return acc + weights[curr.impact];
  }, 0);

  const score = Math.max(0, 100 - penalty);

  return {
    score,
    violationCount,
    passCount,
    violations,
    passes: results.passes.map(p => p.id),
  };
}

export interface SnapshotGeneratorOptions {
  outputPath: string;
  width?: number;
  height?: number;
  title?: string;
  theme?: "dark" | "light";
  primaryColorRgb?: [number, number, number];
}

export function generateDeterministicSnapshot(options: SnapshotGeneratorOptions): string {
  const {
    outputPath,
    width = 1280,
    height = 800,
    theme = "dark",
    primaryColorRgb = [52, 211, 153], // emerald-400
  } = options;

  const png = new PNG({ width, height });

  // Background fill
  const bg = theme === "dark" ? 18 : 245;
  const headerBg = theme === "dark" ? 28 : 230;
  const badgeX1 = Math.floor(width * 0.2);
  const badgeX2 = Math.floor(width * 0.4);
  const badgeY1 = Math.floor(height * 0.2);
  const badgeY2 = Math.floor(height * 0.3);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      const isHeader = y < 40;
      const isSidebar = !isHeader && x < 200;

      if (isHeader) {
        png.data[idx] = headerBg;
        png.data[idx + 1] = headerBg;
        png.data[idx + 2] = headerBg;
      } else if (isSidebar) {
        png.data[idx] = bg + 5;
        png.data[idx + 1] = bg + 5;
        png.data[idx + 2] = bg + 5;
      } else {
        png.data[idx] = bg;
        png.data[idx + 1] = bg;
        png.data[idx + 2] = bg;
      }

      // Draw primary accent indicator badge with proportional coordinates
      if (x >= badgeX1 && x <= badgeX2 && y >= badgeY1 && y <= badgeY2) {
        png.data[idx] = primaryColorRgb[0];
        png.data[idx + 1] = primaryColorRgb[1];
        png.data[idx + 2] = primaryColorRgb[2];
      }

      png.data[idx + 3] = 255; // Alpha
    }
  }

  const absOut = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(absOut), { recursive: true });
  fs.writeFileSync(absOut, PNG.sync.write(png));

  return absOut;
}
