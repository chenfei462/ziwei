import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

const exportDir = path.resolve("output/test-trae-deck-export");

afterEach(() => {
  rmSync(exportDir, { recursive: true, force: true });
});

describe("Trae investor deck export", () => {
  test("exports the HTML investor deck as one PDF and eight slide images", () => {
    const packageSource = readFileSync("package.json", "utf8");
    const checklistSource = readFileSync("docs/trae-submission/assets-checklist.md", "utf8");

    expect(packageSource).toContain('"export:trae-deck"');
    expect(existsSync("scripts/export-trae-deck.mjs")).toBe(true);
    expect(checklistSource).toContain("output/trae-deck-export/manifest.json");

    execFileSync(process.execPath, ["scripts/export-trae-deck.mjs"], {
      env: {
        ...process.env,
        TRAE_DECK_EXPORT_DIR: exportDir
      },
      stdio: "pipe"
    });

    const pdfPath = path.join(exportDir, "ziwei-investor-deck.pdf");
    const manifestPath = path.join(exportDir, "manifest.json");
    const slidesDir = path.join(exportDir, "slides");

    expect(existsSync(pdfPath)).toBe(true);
    expect(statSync(pdfPath).size).toBeGreaterThan(20_000);
    expect(existsSync(manifestPath)).toBe(true);
    expect(existsSync(slidesDir)).toBe(true);

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const slides = readdirSync(slidesDir).filter((file) => file.endsWith(".png")).sort();

    expect(slides).toHaveLength(8);
    expect(slides[0]).toBe("slide-01.png");
    expect(slides[7]).toBe("slide-08.png");
    expect(manifest.files).toEqual(
      expect.arrayContaining([
        "ziwei-investor-deck.pdf",
        "slides/slide-01.png",
        "slides/slide-08.png"
      ])
    );
    expect(manifest.slide_count).toBe(8);

    for (const slide of slides) {
      expect(statSync(path.join(slidesDir, slide)).size, slide).toBeGreaterThan(20_000);
    }
  }, 120_000);
});
