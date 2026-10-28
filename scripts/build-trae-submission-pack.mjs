import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const outputRoot = path.resolve(repoRoot, "output");
const deckExportDir = path.resolve(process.env.TRAE_DECK_EXPORT_DIR ?? path.join("output", "trae-deck-export"));
const outputDir = path.resolve(process.env.TRAE_SUBMISSION_PACK_DIR ?? path.join("output", "trae-submission-pack"));
const assetManifestPath = path.resolve(process.env.TRAE_ASSET_MANIFEST_PATH ?? path.join("output", "trae-assets", "manifest.json"));
const verifyPublicRunLogPath = path.resolve(
  process.env.TRAE_VERIFY_PUBLIC_RUN_LOG_PATH ?? path.join("output", "trae-verification", "verify-public-run-log.md")
);
const assetRoot = path.dirname(assetManifestPath);
const generatedAt = new Date().toISOString();
const verifyPublicRunLogDisclaimer =
  "This local command log is not a screenshot, recording, public deployment proof, Trae Session ID, or user feedback.";

const docFiles = [
  "final-submission-control-room.md",
  "assets-checklist.md",
  "process-log.md",
  "community-post.md",
  "judging-qna.md",
  "demo-script.md",
  "investor-one-pager.md",
  "investor-mini-deck.md",
  "investor-deck.html",
  "short-video-assets.md"
];

const evidenceItems = [
  {
    id: "public_demo_url",
    label: "Public demo URL",
    status: "needs_user_input",
    fill_in: "",
    acceptance: "The URL opens on desktop and mobile and can reach home, card creation, and a public share page."
  },
  {
    id: "repository_url",
    label: "Repository URL",
    status: "needs_user_input",
    fill_in: "",
    acceptance: "README, run instructions, screenshots, and Trae submission materials are visible."
  },
  {
    id: "community_post_url",
    label: "Community post URL",
    status: "needs_user_input",
    fill_in: "",
    acceptance: "The published post includes screenshots, video, demo link, and repository link."
  },
  {
    id: "demo_video_url",
    label: "15-30 second demo video URL",
    status: "needs_user_input",
    fill_in: "",
    acceptance: "The video covers create card, AI translation, redacted share, and 7-day observation."
  },
  {
    id: "trae_session_ids",
    label: "Trae/Codex key Session IDs",
    status: "needs_user_input",
    fill_in: [],
    acceptance: "At least three IDs cover positioning, public flow, and screenshots/submission materials."
  },
  {
    id: "verify_public_screenshot",
    label: "verify:public screenshot or recording",
    status: "needs_user_input",
    fill_in: "",
    acceptance: "Shows typecheck, key tests, build, and public MVP e2e evidence."
  },
  {
    id: "real_user_feedback",
    label: "Real user feedback",
    status: "needs_user_input",
    fill_in: [],
    acceptance: "At least one or two comments answer whether users understand, share, and want the report."
  }
];

function ensureParent(filePath) {
  mkdirSync(path.dirname(filePath), { recursive: true });
}

function copyRequiredFile(source, destination) {
  if (!existsSync(source)) {
    throw new Error(`Missing required source file: ${source}`);
  }
  ensureParent(destination);
  copyFileSync(source, destination);
}

function writeJson(filePath, value) {
  ensureParent(filePath);
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  ensureParent(filePath);
  writeFileSync(filePath, value, "utf8");
}

function assertSafeOutputDir(targetDir) {
  const relativeToOutput = path.relative(outputRoot, targetDir);
  const unsafeTargets = new Set([repoRoot, outputRoot, homedir(), path.parse(targetDir).root]);
  const outsideOutput = relativeToOutput === "" || relativeToOutput.startsWith("..") || path.isAbsolute(relativeToOutput);
  const [namespace] = relativeToOutput.split(path.sep);
  const outsidePackNamespace = !/^(test-)?trae-submission-pack(?:-|$)/.test(namespace);

  if (outsideOutput || outsidePackNamespace || unsafeTargets.has(targetDir)) {
    throw new Error(
      `Refusing unsafe TRAE_SUBMISSION_PACK_DIR: ${targetDir}. Use output/trae-submission-pack or output/test-trae-submission-pack*.`
    );
  }
}

function assertVerifyPublicRunLog(runLog) {
  const requiredLines = [
    `> ${verifyPublicRunLogDisclaimer}`,
    "- command: `npm.cmd run verify:public`",
    "- exit_code: `0`"
  ];
  const runLogLines = new Set(runLog.split(/\r?\n/));

  for (const requiredLine of requiredLines) {
    if (!runLogLines.has(requiredLine)) {
      throw new Error(`verify:public run log is missing required metadata: ${requiredLine}`);
    }
  }
  const exitCodeLines = [...runLogLines].filter((line) => /^- exit_code: `\d+`$/.test(line));
  const failedExitCodeLine = exitCodeLines.find((line) => line !== "- exit_code: `0`");
  if (failedExitCodeLine) {
    throw new Error(`verify:public run log contains failed metadata: ${failedExitCodeLine}`);
  }
}

assertSafeOutputDir(outputDir);

const docSources = docFiles.map((docFile) => {
  const source = path.join("docs", "trae-submission", docFile);
  if (!existsSync(source)) {
    throw new Error(`Missing required source file: ${source}`);
  }
  return {
    source,
    destination: path.posix.join("docs", docFile)
  };
});

if (!existsSync(assetManifestPath)) {
  throw new Error(`Missing ${path.relative(repoRoot, assetManifestPath).split(path.sep).join("/")}. Run scripts/capture-trae-assets.mjs before building the pack.`);
}

if (!existsSync(verifyPublicRunLogPath)) {
  throw new Error(
    `Missing ${path.relative(repoRoot, verifyPublicRunLogPath).split(path.sep).join("/")}. Run npm.cmd run capture:verify-public-log before building the pack.`
  );
}

const verifyPublicRunLog = readFileSync(verifyPublicRunLogPath, "utf8");
assertVerifyPublicRunLog(verifyPublicRunLog);

const assetManifest = JSON.parse(readFileSync(assetManifestPath, "utf8"));
if (!Array.isArray(assetManifest.files) || assetManifest.files.length < 10) {
  throw new Error("Asset manifest must contain at least 10 screenshot files.");
}

const screenshotSources = assetManifest.files.map((screenshot) => {
  if (typeof screenshot !== "string") {
    throw new Error("Asset manifest references a non-string screenshot path.");
  }
  const screenshotPath = path.resolve(screenshot);
  const relativeToAssets = path.relative(assetRoot, screenshotPath);
  const outsideAssets = relativeToAssets === "" || relativeToAssets === ".." || relativeToAssets.startsWith(`..${path.sep}`) || path.isAbsolute(relativeToAssets);
  if (outsideAssets) {
    throw new Error(`Asset manifest references unsafe screenshot path: ${screenshot}`);
  }
  if (!existsSync(screenshotPath)) {
    throw new Error(`Missing required source file: ${screenshot}`);
  }
  return {
    source: screenshotPath,
    destination: path.posix.join("screenshots", path.basename(screenshot))
  };
});

const deckManifestPath = path.join(deckExportDir, "manifest.json");
if (!existsSync(deckManifestPath)) {
  throw new Error("Missing Trae deck export manifest. Run scripts/export-trae-deck.mjs before building the pack.");
}

const deckManifest = JSON.parse(readFileSync(deckManifestPath, "utf8"));
if (!Array.isArray(deckManifest.files) || deckManifest.slide_count !== 8) {
  throw new Error("Trae deck export manifest must contain 8 slides and a files array.");
}

const deckSources = deckManifest.files.map((file) => {
  if (typeof file !== "string") {
    throw new Error("Trae deck export manifest references a non-string file path.");
  }
  const source = path.resolve(deckExportDir, file);
  const relativeToDeck = path.relative(deckExportDir, source);
  const outsideDeck = relativeToDeck === "" || relativeToDeck === ".." || relativeToDeck.startsWith(`..${path.sep}`) || path.isAbsolute(relativeToDeck);
  if (outsideDeck) {
    throw new Error(`Trae deck export manifest references unsafe file path: ${file}`);
  }
  if (!existsSync(source)) {
    throw new Error(`Missing required deck export file: ${file}`);
  }
  return {
    source,
    destination: path.posix.join("deck", file.split(/[\\/]/).join("/"))
  };
});
deckSources.unshift({
  source: deckManifestPath,
  destination: "deck/manifest.json"
});

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

const files = [];
for (const doc of docSources) {
  copyRequiredFile(doc.source, path.join(outputDir, doc.destination));
  files.push(doc.destination);
}

const screenshots = [];
for (const screenshot of screenshotSources) {
  copyRequiredFile(screenshot.source, path.join(outputDir, screenshot.destination));
  screenshots.push(screenshot.destination);
}

for (const deckFile of deckSources) {
  copyRequiredFile(deckFile.source, path.join(outputDir, deckFile.destination));
  files.push(deckFile.destination);
}

const evidencePath = path.join(outputDir, "evidence", "evidence-to-fill.json");
const evidence = {
  generated_at: generatedAt,
  note: "These items require real publication, recording, screenshots, or user feedback. Do not replace them with local placeholders.",
  required_items: evidenceItems
};
writeJson(evidencePath, evidence);
files.push("evidence/evidence-to-fill.json");

const readme = [
  "# Trae CN Submission Pack",
  "",
  "This folder is a portable local pack for Trae CN judges, community posting, and investor follow-up.",
  "",
  "## Included",
  "",
  "- `docs/`: submission control room, process log, community post, judging Q&A, demo script, one-pager, mini deck, and HTML deck.",
  "- `deck/`: exported investor deck PDF and eight slide images for post-contest follow-up.",
  `- \`screenshots/\`: generated product screenshots from \`${path.relative(repoRoot, assetManifestPath).split(path.sep).join("/")}\`.`,
  "- `verification/commands.md`: commands to rerun before submission.",
  "- `verification/verify-public-run-log.md`: local `verify:public` command log only; it is not a screenshot, recording, public deployment proof, Trae Session ID, or user feedback.",
  "- `evidence/evidence-to-fill.json`: real external proof still marked `needs_user_input`.",
  "",
  "## Before Publishing",
  "",
  "1. Run `npm.cmd run verify:trae-submission`.",
  "2. Fill every `needs_user_input` item with real URLs, Session IDs, screenshots, recordings, or user feedback.",
  "3. Do not claim real revenue, production payment, or verified user metrics until the external evidence exists."
].join("\n");
writeText(path.join(outputDir, "README.md"), `${readme}\n`);
files.push("README.md");

const commands = [
  "# Verification Commands",
  "",
  "Run these before submitting the pack:",
  "",
  "```powershell",
  "npm.cmd run capture:verify-public-log",
  "npm.cmd run verify:trae-submission",
  "npm.cmd test -- tests/public-mvp.test.ts --maxWorkers=1 --no-file-parallelism",
  "npm.cmd run typecheck",
  "```",
  "",
  "For final submission proof, capture a real terminal screenshot or recording of `npm.cmd run verify:public`."
].join("\n");
writeText(path.join(outputDir, "verification", "commands.md"), `${commands}\n`);
files.push("verification/commands.md");

copyRequiredFile(verifyPublicRunLogPath, path.join(outputDir, "verification", "verify-public-run-log.md"));
files.push("verification/verify-public-run-log.md");

const packManifest = {
  generated_at: generatedAt,
  source_asset_manifest: path.relative(repoRoot, assetManifestPath).split(path.sep).join("/"),
  files,
  screenshots,
  missing_external_evidence: evidenceItems.map((item) => ({
    id: item.id,
    status: item.status,
    acceptance: item.acceptance
  }))
};
writeJson(path.join(outputDir, "manifest.json"), packManifest);
writeJson(path.join(outputDir, "submission-pack-manifest.json"), packManifest);

console.log(
  JSON.stringify(
    {
      ok: true,
      output_dir: outputDir,
      docs: docFiles.length,
      screenshots: screenshots.length,
      evidence_items: evidenceItems.length
    },
    null,
    2
  )
);
