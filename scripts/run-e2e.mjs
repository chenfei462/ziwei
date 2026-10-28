#!/usr/bin/env node
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const rootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const host = "127.0.0.1";
const port = Number(process.env.PLAYWRIGHT_PORT ?? 43117);
const baseUrl = `http://${host}:${port}`;
const nextBin = path.join(rootDir, "node_modules", "next", "dist", "bin", "next");
const playwrightCli = path.join(rootDir, "node_modules", "@playwright", "test", "cli.js");
const playwrightArgs = process.argv.slice(2);

await assertBuildExists(rootDir);

const server = spawn(process.execPath, [nextBin, "start", "--hostname", host, "--port", String(port)], {
  cwd: rootDir,
  env: {
    ...process.env,
    ZIWEI_E2E_STORE_TEST_DOUBLE: "true",
    ZIWEI_ENABLE_SANDBOX_CHECKOUT_CONFIRM: "true"
  },
  stdio: "inherit"
});

let serverExited = false;
server.on("exit", () => {
  serverExited = true;
});

try {
  await waitForServer(baseUrl, 240_000, () => serverExited);

  const playwrightExitCode = await runPlaywright(playwrightCli, playwrightArgs, rootDir, baseUrl);
  process.exitCode = playwrightExitCode;
} finally {
  await stopProcess(server);
}

async function assertBuildExists(projectRoot) {
  await access(path.join(projectRoot, ".next", "BUILD_ID"), fsConstants.R_OK);
}

async function waitForServer(url, timeoutMs, isStopped) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (isStopped()) {
      throw new Error("E2E web server exited before it became ready.");
    }

    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the server is ready.
    }

    await delay(1000);
  }

  throw new Error(`Timed out waiting for E2E web server at ${url}.`);
}

async function runPlaywright(cliPath, args, cwd, baseUrl) {
  const child = spawn(
    process.execPath,
    [cliPath, "test", ...args],
    {
      cwd,
      stdio: "inherit",
      env: {
        ...process.env,
        PLAYWRIGHT_TEST_BASE_URL: baseUrl
      }
    }
  );

  const exitCode = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        resolve(1);
        return;
      }
      resolve(code ?? 1);
    });
  });

  return exitCode;
}

async function stopProcess(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  await new Promise((resolve) => {
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      clearTimeout(forceKillTimer);
      clearTimeout(forceUnrefTimer);
      child.removeListener("exit", onExit);
      resolve(undefined);
    };

    const onExit = () => {
      settle();
    };

    const forceUnrefTimer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        child.unref();
        settle();
      }
    }, 12_000);

    const forceKillTimer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
      }
    }, 5_000);

    child.once("exit", onExit);
    child.kill();
  });
}
