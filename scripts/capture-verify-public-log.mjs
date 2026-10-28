import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const outputPath = path.resolve(process.env.TRAE_VERIFY_PUBLIC_RUN_LOG_PATH ?? path.join("output", "trae-verification", "verify-public-run-log.md"));
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const displayedCommand = "npm.cmd run verify:public";
const disclaimer = "This local command log is not a screenshot, recording, public deployment proof, Trae Session ID, or user feedback.";
const zhDisclaimer = "此本地命令日志不是截图、录屏、公开部署证据、Trae Session ID 或用户反馈。";

const startedAt = new Date();
let stdout = "";
let stderr = "";

function writeLogAndExit(code, signal = "none") {
  const finishedAt = new Date();
  const exitCode = code ?? 1;
  const log = [
    "# verify:public Local Run Log",
    "",
    `> ${disclaimer}`,
    `> ${zhDisclaimer}`,
    "",
    `- command: \`${displayedCommand}\``,
    `- started_at: \`${startedAt.toISOString()}\``,
    `- finished_at: \`${finishedAt.toISOString()}\``,
    `- exit_code: \`${exitCode}\``,
    `- signal: \`${signal ?? "none"}\``,
    "",
    "## stdout",
    "",
    "```text",
    stdout.trimEnd(),
    "```",
    "",
    "## stderr",
    "",
    "```text",
    stderr.trimEnd(),
    "```",
    ""
  ].join("\n");

  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, log, "utf8");
  console.log(`\nWrote verify:public local run log to ${path.relative(repoRoot, outputPath).split(path.sep).join("/")}`);
  process.exit(exitCode);
}

const childCommand = process.platform === "win32" ? "cmd.exe" : npmCommand;
const childArgs = process.platform === "win32" ? ["/d", "/s", "/c", "npm.cmd", "run", "verify:public"] : ["run", "verify:public"];

let child;
try {
  child = spawn(childCommand, childArgs, {
    cwd: repoRoot,
    env: process.env,
    windowsHide: true
  });
} catch (error) {
  stderr += `${error.stack ?? error.message}\n`;
  writeLogAndExit(1);
}

child.stdout.on("data", (chunk) => {
  const text = chunk.toString();
  stdout += text;
  process.stdout.write(chunk);
});

child.stderr.on("data", (chunk) => {
  const text = chunk.toString();
  stderr += text;
  process.stderr.write(chunk);
});

child.on("error", (error) => {
  stderr += `${error.stack ?? error.message}\n`;
});

child.on("close", writeLogAndExit);
