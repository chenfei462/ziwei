import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const deckPath = path.resolve("docs", "trae-submission", "investor-deck.html");
const outputDir = path.resolve(process.env.TRAE_DECK_EXPORT_DIR ?? path.join("output", "trae-deck-export"));
const slidesDir = path.join(outputDir, "slides");

if (!existsSync(deckPath)) {
  throw new Error(`Missing investor deck HTML: ${deckPath}`);
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(slidesDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1365, height: 768 },
    deviceScaleFactor: 1
  });
  await page.goto(pathToFileURL(deckPath).href, { waitUntil: "load" });
  await page.emulateMedia({ media: "screen" });

  const slideCount = await page.locator(".slide").count();
  if (slideCount !== 8) {
    throw new Error(`Expected 8 investor deck slides, found ${slideCount}.`);
  }

  const files = [];
  const pdfPath = path.join(outputDir, "ziwei-investor-deck.pdf");
  await page.pdf({
    path: pdfPath,
    printBackground: true,
    preferCSSPageSize: true,
    format: "A4",
    landscape: true
  });
  files.push("ziwei-investor-deck.pdf");

  for (let index = 0; index < slideCount; index += 1) {
    const slide = page.locator(".slide").nth(index);
    await slide.scrollIntoViewIfNeeded();
    const box = await slide.boundingBox();
    if (!box) {
      throw new Error(`Could not locate slide ${index + 1}.`);
    }
    const fileName = `slide-${String(index + 1).padStart(2, "0")}.png`;
    await page.screenshot({
      path: path.join(slidesDir, fileName),
      clip: {
        x: Math.max(0, box.x),
        y: Math.max(0, box.y),
        width: Math.min(box.width, 1365),
        height: Math.min(box.height, 768)
      }
    });
    files.push(path.posix.join("slides", fileName));
  }

  const manifest = {
    generated_at: new Date().toISOString(),
    source: path.posix.join("docs", "trae-submission", "investor-deck.html"),
    slide_count: slideCount,
    files
  };
  writeFileSync(path.join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        ok: true,
        output_dir: outputDir,
        slide_count: slideCount,
        files: files.length
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
}
