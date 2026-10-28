import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const assetManifestPath = path.resolve(process.env.TRAE_ASSET_MANIFEST_PATH ?? path.join("output", "trae-assets", "manifest.json"));
const packDir = path.resolve(process.env.TRAE_SUBMISSION_PACK_DIR ?? "output/trae-submission-pack");
const verifyPublicRunLogDisclaimer =
  "This local command log is not a screenshot, recording, public deployment proof, Trae Session ID, or user feedback.";

const requiredFiles = [
  "docs/trae-submission/final-submission-control-room.md",
  "docs/trae-submission/assets-checklist.md",
  "docs/trae-submission/process-log.md",
  "docs/trae-submission/community-post.md",
  "docs/trae-submission/judging-qna.md",
  "docs/trae-submission/demo-script.md",
  "docs/trae-submission/investor-one-pager.md",
  "docs/trae-submission/investor-mini-deck.md",
  "docs/trae-submission/investor-deck.html",
  "docs/trae-submission/short-video-assets.md",
  assetManifestPath
];

const publicDocs = [
  "docs/trae-submission/final-submission-control-room.md",
  "docs/trae-submission/community-post.md",
  "docs/trae-submission/judging-qna.md",
  "docs/trae-submission/investor-one-pager.md",
  "docs/trae-submission/investor-mini-deck.md"
];

const readmeRequiredTraeLinks = [
  "docs/trae-submission/final-submission-control-room.md",
  "docs/trae-submission/assets-checklist.md",
  "docs/trae-submission/community-post.md"
];

const riskyPublicPatterns = [/草稿/g, /提交前待补/g, /质量审查待回/g, /子代理中断/g];

const failures = [];

function displayPath(filePath) {
  if (!path.isAbsolute(filePath)) return filePath;
  return path.relative(repoRoot, filePath).split(path.sep).join("/") || ".";
}

function packEntryPath(file) {
  if (typeof file !== "string") {
    failures.push(`Trae submission pack manifest contains unsafe pack manifest path: ${JSON.stringify(file)}`);
    return null;
  }

  const segments = file.split("/");
  const hasUnsafeSegment = segments.some((segment) => segment === "" || segment === "." || segment === "..");
  if (path.isAbsolute(file) || file.includes("\\") || file.includes("..") || hasUnsafeSegment) {
    failures.push(`Trae submission pack manifest contains unsafe pack manifest path: ${file}`);
    return null;
  }

  const resolved = path.resolve(packDir, file);
  const relativeToPack = path.relative(packDir, resolved);
  if (relativeToPack === "" || relativeToPack.startsWith("..") || path.isAbsolute(relativeToPack)) {
    failures.push(`Trae submission pack manifest contains unsafe pack manifest path: ${file}`);
    return null;
  }

  return resolved;
}

function verifyPublicRunLogMissingMetadata(runLog) {
  const runLogLines = new Set(runLog.split(/\r?\n/));
  return [
    `> ${verifyPublicRunLogDisclaimer}`,
    "- command: `npm.cmd run verify:public`",
    "- exit_code: `0`"
  ].filter((requiredLine) => !runLogLines.has(requiredLine));
}

for (const file of requiredFiles) {
  if (!existsSync(file)) failures.push(`Missing required file: ${displayPath(file)}`);
}

if (existsSync(assetManifestPath)) {
  const manifest = JSON.parse(readFileSync(assetManifestPath, "utf8"));
  if (!Array.isArray(manifest.files)) {
    failures.push("Asset manifest does not contain files array.");
  } else {
    if (manifest.files.length < 10) failures.push(`Asset manifest should contain at least 10 files, found ${manifest.files.length}.`);
    for (const file of manifest.files) {
      if (!existsSync(file)) failures.push(`Manifest references missing screenshot: ${file}`);
    }
    const hasInvestorLoopSlide = manifest.files.some(
      (file) => typeof file === "string" && file.split(/[\\/]/).join("/").endsWith("08-investor-loop-slide.png")
    );
    if (!hasInvestorLoopSlide) {
      failures.push("Asset manifest is missing 08-investor-loop-slide.png.");
    }
  }
}

for (const file of publicDocs) {
  if (!existsSync(file)) continue;
  const source = readFileSync(file, "utf8");
  for (const pattern of riskyPublicPatterns) {
    if (pattern.test(source)) failures.push(`Public-facing doc contains risky marker ${pattern}: ${file}`);
  }
}

if (existsSync("README.md")) {
  const readme = readFileSync("README.md", "utf8");
  for (const file of readmeRequiredTraeLinks) {
    if (!readme.includes(file)) {
      failures.push(`README is missing Trae submission link: ${file}`);
    }
  }
}

const packManifestPath = path.join(packDir, "manifest.json");
const requiredEvidenceIds = [
  "public_demo_url",
  "repository_url",
  "community_post_url",
  "demo_video_url",
  "trae_session_ids",
  "verify_public_screenshot",
  "real_user_feedback"
];
const requiredDeckFiles = [
  "deck/manifest.json",
  "deck/ziwei-investor-deck.pdf",
  "deck/slides/slide-01.png",
  "deck/slides/slide-02.png",
  "deck/slides/slide-03.png",
  "deck/slides/slide-04.png",
  "deck/slides/slide-05.png",
  "deck/slides/slide-06.png",
  "deck/slides/slide-07.png",
  "deck/slides/slide-08.png"
];
const requiredPackFiles = ["docs/process-log.md", "verification/verify-public-run-log.md"];

if (!existsSync(packManifestPath)) {
  failures.push(`Missing Trae submission pack manifest: ${packManifestPath}`);
} else {
  const packManifest = JSON.parse(readFileSync(packManifestPath, "utf8"));
  const packFiles = Array.isArray(packManifest.files) ? packManifest.files : [];
  const packScreenshots = Array.isArray(packManifest.screenshots) ? packManifest.screenshots : [];
  const evidenceItems = Array.isArray(packManifest.missing_external_evidence) ? packManifest.missing_external_evidence : [];

  if (!packFiles.length) failures.push("Trae submission pack manifest does not contain files array.");
  for (const requiredDeckFile of requiredDeckFiles) {
    if (!packFiles.includes(requiredDeckFile)) {
      failures.push(`Trae submission pack manifest missing required deck export: ${requiredDeckFile}`);
    }
  }
  for (const requiredPackFile of requiredPackFiles) {
    if (!packFiles.includes(requiredPackFile)) {
      failures.push(`Trae submission pack manifest missing required file: ${requiredPackFile}`);
    }
  }
  if (packScreenshots.length < 10) {
    failures.push(`Trae submission pack should contain at least 10 screenshots, found ${packScreenshots.length}.`);
  }
  if (!packScreenshots.includes("screenshots/08-investor-loop-slide.png")) {
    failures.push("Trae submission pack is missing screenshots/08-investor-loop-slide.png.");
  }

  for (const file of [...packFiles, ...packScreenshots]) {
    const resolvedPackEntry = packEntryPath(file);
    if (!resolvedPackEntry) continue;
    if (!existsSync(resolvedPackEntry)) {
      failures.push(`Trae submission pack references missing file: ${file}`);
    }
  }

  for (const requiredEvidence of requiredEvidenceIds) {
    const evidence = evidenceItems.find((item) => item?.id === requiredEvidence);
    if (!evidence) {
      failures.push(`Trae submission pack missing external evidence placeholder: ${requiredEvidence}`);
    } else if (evidence.status !== "needs_user_input") {
      failures.push(`External evidence ${requiredEvidence} should remain needs_user_input until real proof is added.`);
    }
  }
}

const verifyPublicRunLogPath = path.join(packDir, "verification", "verify-public-run-log.md");
if (existsSync(verifyPublicRunLogPath)) {
  const verifyPublicRunLog = readFileSync(verifyPublicRunLogPath, "utf8");
  for (const missingMetadata of verifyPublicRunLogMissingMetadata(verifyPublicRunLog)) {
    failures.push(`verify:public run log is missing required metadata: ${missingMetadata}`);
  }
  const verifyPublicRunLogLines = new Set(verifyPublicRunLog.split(/\r?\n/));
  const exitCodeLines = [...verifyPublicRunLogLines].filter((line) => /^- exit_code: `\d+`$/.test(line));
  const failedExitCodeLine = exitCodeLines.find((line) => line !== "- exit_code: `0`");
  if (failedExitCodeLine) {
    failures.push(`verify:public run log contains failed metadata: ${failedExitCodeLine}`);
  }
} else {
  failures.push(`Missing verify:public run log: ${verifyPublicRunLogPath}`);
}

const evidenceFilePath = path.join(packDir, "evidence", "evidence-to-fill.json");
if (!existsSync(evidenceFilePath)) {
  failures.push(`Missing Trae submission evidence file: ${evidenceFilePath}`);
} else {
  const evidenceFile = JSON.parse(readFileSync(evidenceFilePath, "utf8"));
  const evidenceItems = Array.isArray(evidenceFile.required_items) ? evidenceFile.required_items : [];
  for (const requiredEvidence of requiredEvidenceIds) {
    const evidence = evidenceItems.find((item) => item?.id === requiredEvidence);
    if (!evidence) {
      failures.push(`Evidence file missing required item: ${requiredEvidence}`);
    } else if (evidence.status !== "needs_user_input") {
      failures.push(`Evidence file item ${requiredEvidence} should remain needs_user_input until real proof is added.`);
    }
  }
}

if (failures.length) {
  console.error(["Trae submission verification failed:", ...failures.map((failure) => `- ${failure}`)].join("\n"));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      checked_files: requiredFiles.length,
      checked_public_docs: publicDocs.length,
      checked_pack: true,
      manifest: path.normalize(assetManifestPath)
    },
    null,
    2
  )
);
