import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

const testRunId = `${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const packDir = path.resolve(`output/test-trae-submission-pack-${testRunId}`);
const testAssetDir = path.resolve(`output/test-trae-assets-${testRunId}`);
const assetManifestPath = path.join(testAssetDir, "manifest.json");
const deckExportDir = path.resolve(`output/test-trae-submission-pack-deck-export-${testRunId}`);
const verifyPublicRunLogPath = path.resolve(`output/test-trae-verification-${testRunId}/verify-public-run-log.md`);
const verifyPublicRunLogDisclaimer =
  "This local command log is not a screenshot, recording, public deployment proof, Trae Session ID, or user feedback.";
const fixtureScreenshotNames = [
  "01-home-hero-desktop.png",
  "02-create-form-privacy-demo.png",
  "03-chart-overview-desktop.png",
  "04-ai-trace-desktop.png",
  "05-daily-stargarden-challenge.png",
  "05-share-privacy-mobile.png",
  "06-seven-day-challenge-mobile.png",
  "07-report-unlock-desktop.png",
  "08-investor-loop-slide.png",
  "09-home-mobile.png"
];

type TraeSubmissionPackManifest = {
  files: string[];
  screenshots: string[];
  source_asset_manifest: string;
};

function packBuilderEnv(overrides: Partial<NodeJS.ProcessEnv> = {}) {
  return {
    ...process.env,
    TRAE_SUBMISSION_PACK_DIR: packDir,
    TRAE_DECK_EXPORT_DIR: deckExportDir,
    TRAE_ASSET_MANIFEST_PATH: assetManifestPath,
    TRAE_VERIFY_PUBLIC_RUN_LOG_PATH: verifyPublicRunLogPath,
    ...overrides
  };
}

function packVerifierEnv(overrides: Partial<NodeJS.ProcessEnv> = {}) {
  return {
    ...process.env,
    TRAE_SUBMISSION_PACK_DIR: packDir,
    TRAE_ASSET_MANIFEST_PATH: assetManifestPath,
    ...overrides
  };
}

function writeFixtureAssetManifest(files = fixtureScreenshotNames.map((file) => path.join(testAssetDir, file))) {
  writeFileSync(
    assetManifestPath,
    `${JSON.stringify(
      {
        generated_at: "2026-07-07T00:00:00.000Z",
        files
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

beforeAll(() => {
  mkdirSync(testAssetDir, { recursive: true });
  const transparentPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lptF9QAAAABJRU5ErkJggg==",
    "base64"
  );
  for (const screenshotName of fixtureScreenshotNames) {
    writeFileSync(path.join(testAssetDir, screenshotName), transparentPng);
  }
  writeFixtureAssetManifest();
  mkdirSync(path.dirname(verifyPublicRunLogPath), { recursive: true });
  writeFileSync(
    verifyPublicRunLogPath,
    [
      "# verify:public Local Run Log",
      "",
      `> ${verifyPublicRunLogDisclaimer}`,
      "",
      "- command: `npm.cmd run verify:public`",
      "- exit_code: `0`",
      ""
    ].join("\n"),
    "utf8"
  );

  execFileSync(process.execPath, ["scripts/export-trae-deck.mjs"], {
    env: {
      ...process.env,
      TRAE_DECK_EXPORT_DIR: deckExportDir
    },
    stdio: "pipe"
  });
}, 120_000);

afterEach(() => {
  rmSync(packDir, { recursive: true, force: true });
});

afterAll(() => {
  rmSync(deckExportDir, { recursive: true, force: true });
  rmSync(testAssetDir, { recursive: true, force: true });
  rmSync(path.dirname(verifyPublicRunLogPath), { recursive: true, force: true });
});

describe("Trae submission pack builder", () => {
  test("builds a portable pack with docs, screenshots, manifest, and user-owned evidence placeholders", () => {
    const packageSource = readFileSync("package.json", "utf8");

    expect(packageSource).toContain('"build:trae-submission-pack"');
    expect(existsSync("scripts/build-trae-submission-pack.mjs")).toBe(true);

    execFileSync(process.execPath, ["scripts/build-trae-submission-pack.mjs"], {
      env: packBuilderEnv(),
      stdio: "pipe"
    });

    const manifestPath = path.join(packDir, "manifest.json");
    const readmePath = path.join(packDir, "README.md");
    const evidencePath = path.join(packDir, "evidence/evidence-to-fill.json");
    const processLogPath = path.join(packDir, "docs/process-log.md");
    const verifyPublicRunLogPackPath = path.join(packDir, "verification/verify-public-run-log.md");

    expect(existsSync(manifestPath)).toBe(true);
    expect(existsSync(readmePath)).toBe(true);
    expect(existsSync(evidencePath)).toBe(true);
    expect(existsSync(processLogPath)).toBe(true);
    expect(existsSync(verifyPublicRunLogPackPath)).toBe(true);

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as TraeSubmissionPackManifest;
    const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
    const readme = readFileSync(readmePath, "utf8");
    const processLog = readFileSync(processLogPath, "utf8");
    const verifyPublicRunLog = readFileSync(verifyPublicRunLogPackPath, "utf8");

    expect(manifest.files).toEqual(
      expect.arrayContaining([
        "README.md",
        "docs/final-submission-control-room.md",
        "docs/assets-checklist.md",
        "docs/process-log.md",
        "docs/community-post.md",
        "docs/judging-qna.md",
        "docs/demo-script.md",
        "docs/investor-one-pager.md",
        "docs/investor-mini-deck.md",
        "docs/investor-deck.html",
        "docs/short-video-assets.md",
        "deck/manifest.json",
        "deck/ziwei-investor-deck.pdf",
        "deck/slides/slide-01.png",
        "deck/slides/slide-08.png",
        "evidence/evidence-to-fill.json",
        "verification/commands.md",
        "verification/verify-public-run-log.md"
      ])
    );
    expect(manifest.screenshots.length).toBeGreaterThanOrEqual(10);
    expect(manifest.screenshots).toContain("screenshots/08-investor-loop-slide.png");
    expect(manifest.source_asset_manifest).toBe(path.relative(process.cwd(), assetManifestPath).split(path.sep).join("/"));
    for (const file of [...manifest.files, ...manifest.screenshots]) {
      expect(existsSync(path.join(packDir, file)), file).toBe(true);
    }

    expect(evidence.required_items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "public_demo_url", status: "needs_user_input" }),
        expect.objectContaining({ id: "repository_url", status: "needs_user_input" }),
        expect.objectContaining({ id: "community_post_url", status: "needs_user_input" }),
        expect.objectContaining({ id: "demo_video_url", status: "needs_user_input" }),
        expect.objectContaining({ id: "trae_session_ids", status: "needs_user_input" }),
        expect.objectContaining({ id: "verify_public_screenshot", status: "needs_user_input" }),
        expect.objectContaining({ id: "real_user_feedback", status: "needs_user_input" })
      ])
    );
    expect(JSON.stringify(evidence)).not.toContain("https://example.com");
    expect(readme).toContain("Trae CN");
    expect(readme).toContain("deck/");
    expect(readme).toContain("process log");
    expect(readme).toContain("needs_user_input");
    expect(readme).toContain("npm.cmd run verify:trae-submission");
    expect(processLog).toContain("2026-07-07");
    expect(processLog).toContain("用户回填 Session ID");
    expect(processLog).toContain("output/trae-submission-pack/manifest.json");
    expect(processLog).toContain("output/trae-submission-pack/evidence/evidence-to-fill.json");
    expect(processLog).toContain("未伪造公开 URL");
    expect(verifyPublicRunLog).toContain("command");
    expect(verifyPublicRunLog).toContain("npm.cmd run verify:public");
    expect(verifyPublicRunLog).toContain("exit_code");
    expect(verifyPublicRunLog).toContain(verifyPublicRunLogDisclaimer);
  });

  test("rejects verify:public run logs with a non-zero exit code", () => {
    const originalRunLog = readFileSync(verifyPublicRunLogPath, "utf8");
    writeFileSync(verifyPublicRunLogPath, originalRunLog.replace("- exit_code: `0`", "- exit_code: `1`"), "utf8");

    try {
      expect(() =>
        execFileSync(process.execPath, ["scripts/build-trae-submission-pack.mjs"], {
          env: packBuilderEnv(),
          stdio: "pipe"
        })
      ).toThrow(/exit_code/i);
    } finally {
      writeFileSync(verifyPublicRunLogPath, originalRunLog, "utf8");
    }
  });

  test("rejects verify:public run logs that include any non-zero exit code", () => {
    const originalRunLog = readFileSync(verifyPublicRunLogPath, "utf8");
    writeFileSync(verifyPublicRunLogPath, originalRunLog.replace("- exit_code: `0`", "- exit_code: `0`\n- exit_code: `2`"), "utf8");

    try {
      expect(() =>
        execFileSync(process.execPath, ["scripts/build-trae-submission-pack.mjs"], {
          env: packBuilderEnv(),
          stdio: "pipe"
        })
      ).toThrow(/exit_code/i);
    } finally {
      writeFileSync(verifyPublicRunLogPath, originalRunLog, "utf8");
    }
  });

  test("rejects unsafe output directories before deleting anything", () => {
    const sentinel = path.resolve("unsafe-pack-sentinel.txt");
    writeFileSync(sentinel, "do-not-delete", "utf8");

    try {
      expect(() =>
        execFileSync(process.execPath, ["scripts/build-trae-submission-pack.mjs"], {
          env: packBuilderEnv({ TRAE_SUBMISSION_PACK_DIR: "." }),
          stdio: "pipe"
        })
      ).toThrow(/refusing unsafe TRAE_SUBMISSION_PACK_DIR/i);
      expect(existsSync(sentinel)).toBe(true);
    } finally {
      rmSync(sentinel, { force: true });
    }
  });

  test("allows custom pack directories only inside output", () => {
    const nestedPackDir = path.join(packDir, "nested");
    mkdirSync(nestedPackDir, { recursive: true });

    execFileSync(process.execPath, ["scripts/build-trae-submission-pack.mjs"], {
      env: packBuilderEnv({ TRAE_SUBMISSION_PACK_DIR: nestedPackDir }),
      stdio: "pipe"
    });

    expect(existsSync(path.join(nestedPackDir, "manifest.json"))).toBe(true);
  });

  test("rejects source asset output as a pack directory before deleting anything", () => {
    const sentinelPath = path.join(testAssetDir, "do-not-delete-sentinel.txt");
    writeFileSync(sentinelPath, "fixture asset output must survive", "utf8");

    try {
      expect(() =>
        execFileSync(process.execPath, ["scripts/build-trae-submission-pack.mjs"], {
          env: packBuilderEnv({ TRAE_SUBMISSION_PACK_DIR: testAssetDir }),
          stdio: "pipe"
        })
      ).toThrow(/refusing unsafe TRAE_SUBMISSION_PACK_DIR/i);
      expect(readFileSync(sentinelPath, "utf8")).toBe("fixture asset output must survive");
    } finally {
      rmSync(sentinelPath, { force: true });
    }
  });

  test("rejects screenshot paths outside the configured Trae asset directory without leaving fixture manifest modified", () => {
    const originalFixtureManifest = readFileSync(assetManifestPath, "utf8");
    const manifest = JSON.parse(originalFixtureManifest);
    manifest.files = [...manifest.files, "README.md"];
    writeFileSync(assetManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    expect(readFileSync(assetManifestPath, "utf8")).not.toBe(originalFixtureManifest);

    try {
      expect(() =>
        execFileSync(process.execPath, ["scripts/build-trae-submission-pack.mjs"], {
          env: packBuilderEnv(),
          stdio: "pipe"
        })
      ).toThrow(/asset manifest references unsafe screenshot path/i);
      expect(existsSync(packDir)).toBe(false);
    } finally {
      writeFileSync(assetManifestPath, originalFixtureManifest, "utf8");
    }

    expect(readFileSync(assetManifestPath, "utf8")).toBe(originalFixtureManifest);
  });

  test("submission verifier fails when the generated pack manifest references a missing file", () => {
    execFileSync(process.execPath, ["scripts/build-trae-submission-pack.mjs"], {
      env: packBuilderEnv(),
      stdio: "pipe"
    });

    rmSync(path.join(packDir, "screenshots/08-investor-loop-slide.png"), { force: true });

    expect(() =>
      execFileSync(process.execPath, ["scripts/verify-trae-submission.mjs"], {
        env: packVerifierEnv(),
        stdio: "pipe"
      })
    ).toThrow(/pack references missing file/i);
  });

  test("submission verifier accepts the fixture pack with a configured asset manifest", () => {
    execFileSync(process.execPath, ["scripts/build-trae-submission-pack.mjs"], {
      env: packBuilderEnv(),
      stdio: "pipe"
    });

    const stdout = execFileSync(process.execPath, ["scripts/verify-trae-submission.mjs"], {
      env: packVerifierEnv(),
      encoding: "utf8",
      stdio: "pipe"
    });
    const result = JSON.parse(stdout);

    expect(result.ok).toBe(true);
    expect(result.manifest).toBe(path.normalize(assetManifestPath));
  });

  test("submission verifier rejects pack manifest entries that escape the pack directory", () => {
    execFileSync(process.execPath, ["scripts/build-trae-submission-pack.mjs"], {
      env: packBuilderEnv(),
      stdio: "pipe"
    });

    const escapedFile = path.resolve(packDir, "..", "outside.txt");
    writeFileSync(escapedFile, "outside the pack", "utf8");
    const manifestPath = path.join(packDir, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as TraeSubmissionPackManifest;
    manifest.files.push("../outside.txt");
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    try {
      expect(() =>
        execFileSync(process.execPath, ["scripts/verify-trae-submission.mjs"], {
          env: packVerifierEnv(),
          stdio: "pipe"
        })
      ).toThrow(/unsafe pack manifest path/i);
    } finally {
      rmSync(escapedFile, { force: true });
    }
  });

  test("submission verifier rejects non-string pack manifest entries as unsafe paths", () => {
    execFileSync(process.execPath, ["scripts/build-trae-submission-pack.mjs"], {
      env: packBuilderEnv(),
      stdio: "pipe"
    });

    const manifestPath = path.join(packDir, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      files: Array<string | number>;
      screenshots: string[];
      source_asset_manifest: string;
    };
    manifest.files.push(123);
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    expect(() =>
      execFileSync(process.execPath, ["scripts/verify-trae-submission.mjs"], {
        env: packVerifierEnv(),
        stdio: "pipe"
      })
    ).toThrow(/unsafe pack manifest path/i);
  });

  test("submission verifier fails when pack manifest omits required deck exports", () => {
    execFileSync(process.execPath, ["scripts/build-trae-submission-pack.mjs"], {
      env: packBuilderEnv(),
      stdio: "pipe"
    });

    const manifestPath = path.join(packDir, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as TraeSubmissionPackManifest;
    manifest.files = manifest.files.filter((file) => !file.startsWith("deck/"));
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    expect(() =>
      execFileSync(process.execPath, ["scripts/verify-trae-submission.mjs"], {
        env: packVerifierEnv(),
        stdio: "pipe"
      })
    ).toThrow(/missing required deck export/i);
  });

  test("submission verifier fails when the configured pack manifest is missing", () => {
    const missingPackDir = path.resolve(`output/test-trae-submission-pack-missing-${testRunId}`);
    rmSync(missingPackDir, { recursive: true, force: true });

    expect(() =>
      execFileSync(process.execPath, ["scripts/verify-trae-submission.mjs"], {
        env: packVerifierEnv({ TRAE_SUBMISSION_PACK_DIR: missingPackDir }),
        stdio: "pipe"
      })
    ).toThrow(/missing trae submission pack manifest/i);
  });

  test("submission verifier fails when evidence file marks user-owned proof as complete", () => {
    execFileSync(process.execPath, ["scripts/build-trae-submission-pack.mjs"], {
      env: packBuilderEnv(),
      stdio: "pipe"
    });

    const evidencePath = path.join(packDir, "evidence/evidence-to-fill.json");
    const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
    evidence.required_items[0].status = "complete";
    writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

    expect(() =>
      execFileSync(process.execPath, ["scripts/verify-trae-submission.mjs"], {
        env: packVerifierEnv(),
        stdio: "pipe"
      })
    ).toThrow(/evidence file item public_demo_url should remain needs_user_input/i);
  });

  test("README exposes the submission pack and pack-aware verification command", () => {
    const readme = readFileSync("README.md", "utf8");

    expect(readme).toContain("output/trae-submission-pack");
    expect(readme).toContain("npm run build:trae-submission-pack");
    expect(readme).toContain("npm run verify:trae-submission");
  });
});
