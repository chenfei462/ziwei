import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const port = Number(process.env.TRAE_ASSET_PORT ?? 3217);
const baseUrl = `http://127.0.0.1:${port}`;
const outDir = path.resolve("output", "trae-assets");

const birthProfile = {
  display_name: "端到端演示用户",
  calendar_type: "gregorian",
  birth_date: "2000-08-16",
  birth_time: "13:30",
  timezone: "Asia/Shanghai",
  location: {
    name: "上海",
    longitude: 121.4737,
    latitude: 31.2304
  },
  is_leap_month: false,
  true_solar_time_enabled: true,
  gender_rule: "traditional_unspecified"
};

const useExternalServer = process.env.TRAE_ASSET_EXTERNAL_SERVER === "1";
const nextBin = process.platform === "win32" ? path.resolve("node_modules", ".bin", "next.cmd") : path.resolve("node_modules", ".bin", "next");
const devCommand = process.platform === "win32" ? "cmd.exe" : nextBin;
const devArgs = process.platform === "win32" ? ["/d", "/s", "/c", nextBin, "dev", "-p", String(port)] : ["dev", "-p", String(port)];
const dev = useExternalServer
  ? undefined
  : spawn(devCommand, devArgs, {
      cwd: process.cwd(),
      env: childProcessEnv(),
      stdio: ["ignore", "pipe", "pipe"]
    });

let devLog = "";
let completed = false;
dev?.stdout.on("data", (chunk) => {
  devLog += chunk.toString();
});
dev?.stderr.on("data", (chunk) => {
  devLog += chunk.toString();
});

try {
  await mkdir(outDir, { recursive: true });
  await waitForServer();

  const chartResponse = await postJson("/api/chart/create", { birth_profile: birthProfile });
  const visitorCookie = parseCookie(chartResponse.headers.get("set-cookie"));
  const chart = await chartResponse.json();
  if (!chart.chart_id) throw new Error(`chart create failed: ${JSON.stringify(chart)}`);

  const cookieHeader = `${visitorCookie.name}=${visitorCookie.value}`;

  const shareResponse = await postJson(
    "/api/share/create",
    {
      source_type: "daily_theme",
      source_id: chart.chart_id,
      title: "今日星垣卡",
      summary: "边界感、主动整理、低风险行动：一张适合分享的脱敏观察卡。",
      keywords: ["边界感", "事业节奏", "关系模式"],
      safety_flags: ["daily_observation_only", "content_reviewed", "major_decision_boundary"]
    },
    cookieHeader
  );
  const share = await shareResponse.json();
  const shareId = share.snapshot?.share_id;
  if (!shareId) throw new Error(`share create failed: ${JSON.stringify(share)}`);

  const reportResponse = await postJson(
    "/api/report/draft",
    {
      report_type: "single_chart",
      chart_id: chart.chart_id,
      chart: chart.chart,
      mode: "entertainment"
    },
    cookieHeader
  );
  const report = await reportResponse.json();
  if (!report.report_id) throw new Error(`report draft failed: ${JSON.stringify(report)}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    baseURL: baseUrl,
    viewport: { width: 1365, height: 768 },
    deviceScaleFactor: 1
  });
  await context.addCookies([
    {
      name: visitorCookie.name,
      value: visitorCookie.value,
      domain: "127.0.0.1",
      path: "/"
    }
  ]);
  const page = await context.newPage();

  await capture(page, "/", "01-home-hero-desktop.png");
  await capture(page, "/chart/new", "02-create-form-privacy-demo.png");
  await capture(page, `/chart/${chart.chart_id}`, "03-chart-overview-desktop.png");
  await page.locator("text=AI 转译过程").scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(outDir, "04-ai-trace-desktop.png"), fullPage: false });
  await capture(page, `/chart/${chart.chart_id}/daily`, "05-daily-stargarden-challenge.png");
  await capture(page, `/report/${report.report_id}`, "07-report-unlock-desktop.png");

  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, `/share/${shareId}?channel=mobile&campaign=trae`, "05-share-privacy-mobile.png");
  await capture(page, `/chart/${chart.chart_id}`, "06-seven-day-challenge-mobile.png");
  await capture(page, "/", "09-home-mobile.png");

  await browser.close();

  const manifest = {
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    chart_id: chart.chart_id,
    share_id: shareId,
    report_id: report.report_id,
    files: [
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
    ].map((file) => `output/trae-assets/${file}`)
  };
  await writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  console.log(JSON.stringify(manifest, null, 2));
  completed = true;
} finally {
  stopDevServer();
  if (completed) process.exit(0);
}

async function capture(page, route, fileName) {
  await page.goto(route, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(outDir, fileName), fullPage: false });
}

async function postJson(route, body, cookieHeader) {
  const response = await fetch(`${baseUrl}${route}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookieHeader ? { cookie: cookieHeader } : {})
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`${route} failed ${response.status}: ${await response.text()}`);
  }
  return response;
}

function parseCookie(setCookie) {
  if (!setCookie) throw new Error("missing visitor cookie");
  const [pair] = setCookie.split(";");
  const index = pair.indexOf("=");
  return {
    name: pair.slice(0, index),
    value: pair.slice(index + 1)
  };
}

function childProcessEnv() {
  const env = {};
  const seen = new Set();
  for (const [key, value] of Object.entries(process.env)) {
    const normalized = process.platform === "win32" ? key.toLowerCase() : key;
    if (seen.has(normalized) || value === undefined) continue;
    seen.add(normalized);
    env[key] = value;
  }
  if (process.platform === "win32") {
    const pathValue = process.env.Path ?? process.env.PATH;
    delete env.Path;
    delete env.PATH;
    if (pathValue) env.Path = pathValue;
  }
  env.NEXT_TELEMETRY_DISABLED = "1";
  return env;
}

function stopDevServer() {
  if (!dev) return;
  dev.kill();
  dev.stdout?.destroy();
  dev.stderr?.destroy();
}

async function waitForServer() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 90_000) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Next dev server did not start on ${baseUrl}\n${devLog}`);
}
