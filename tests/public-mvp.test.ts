import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { POST as createChartPost } from "../src/app/api/chart/create/route.js";
import { GET as chartGet } from "../src/app/api/chart/[id]/route.js";
import { POST as shareCreatePost } from "../src/app/api/share/create/route.js";
import manifest from "../src/app/manifest.js";
import robots from "../src/app/robots.js";
import sitemap from "../src/app/sitemap.js";

const publicChartBody = {
  birth_profile: {
    display_name: "正式用户",
    calendar_type: "gregorian",
    birth_date: "2000-08-16",
    birth_time: "03:30",
    timezone: "Asia/Shanghai",
    location: {
      name: "上海",
      longitude: 121.4737,
      latitude: 31.2304
    },
    is_leap_month: false,
    true_solar_time_enabled: true,
    gender_rule: "traditional_unspecified"
  }
};

const formalPublicFiles = [
  "src/app/page.tsx",
  "src/app/layout.tsx",
  "src/app/chart/new/page.tsx",
  "src/app/chart/new/PublicChartForm.tsx",
  "src/app/chart/[id]/page.tsx",
  "src/app/chart/[id]/daily/page.tsx",
  "src/app/chart/[id]/ChartShareAction.tsx",
  "src/app/report/[id]/ReportPurchaseAction.tsx",
  "src/app/share/[id]/page.tsx",
  "src/app/report/[id]/page.tsx",
  "src/app/account/page.tsx",
  "src/app/account/AccountUpgradeForm.tsx",
  "src/app/member/page.tsx",
  "src/app/orders/page.tsx",
  "src/app/support/page.tsx",
  "src/app/support/SupportForm.tsx",
  "src/app/legal/privacy/page.tsx",
  "src/app/legal/terms/page.tsx"
];

describe("public product shell", () => {
  test("exposes the formal public route files and keeps phase pages behind internal routes", () => {
    for (const routeFile of formalPublicFiles) {
      expect(existsSync(resolve(routeFile)), routeFile).toBe(true);
    }

    for (const phase of ["phase6", "phase7", "phase8", "phase9", "phase10", "phase11", "phase12", "phase13", "phase14", "phase15"]) {
      expect(existsSync(resolve(`src/app/internal/phases/${phase}/page.tsx`)), phase).toBe(true);
      expect(existsSync(resolve(`src/app/${phase}/page.tsx`)), phase).toBe(false);
    }

    for (const legacyFile of [
      "src/app/ops/page.tsx",
      "src/app/commercial/dashboard/page.tsx",
      "src/app/immersive/page.tsx",
      "src/app/immersive/control/[id]/page.tsx",
      "src/app/immersive/ar/[id]/page.tsx"
    ]) {
      expect(existsSync(resolve(legacyFile)), legacyFile).toBe(false);
    }

    expect(existsSync(resolve("src/app/api/beta")), "public beta API directory").toBe(false);
    expect(existsSync(resolve("src/app/api/feedback")), "public closed-test feedback API directory").toBe(false);
    expect(existsSync(resolve("src/app/api/immersive")), "public immersive API directory").toBe(false);
    expect(existsSync(resolve("src/app/api/launch/dashboard")), "public launch dashboard API directory").toBe(false);
    expect(existsSync(resolve("src/app/api/launch/growth-event")), "public launch growth event API directory").toBe(false);
    expect(existsSync(resolve("src/app/api/commercial/dashboard")), "public commercial dashboard API directory").toBe(false);
    expect(existsSync(resolve("src/app/api/growth/channel-dashboard")), "public channel dashboard API directory").toBe(false);
    expect(existsSync(resolve("src/app/api/analytics/events")), "public analytics events API directory").toBe(false);
    expect(existsSync(resolve("src/app/api/support/ticket/[id]")), "public support ticket detail API directory").toBe(false);
    expect(existsSync(resolve("src/app/api/support/ticket/route.ts")), "public support ticket creation API").toBe(true);
    expect(existsSync(resolve("src/app/api/rule-profiles")), "public rule profiles API directory").toBe(false);
    expect(existsSync(resolve("src/app/api/knowledge")), "public knowledge graph API directory").toBe(false);
    expect(existsSync(resolve("src/app/api/chart/compare-rules")), "public rule comparison API directory").toBe(false);
    expect(existsSync(resolve("src/app/api/synastry")), "public synastry API directory").toBe(false);
    expect(existsSync(resolve("src/app/api/timeline")), "public timeline API directory").toBe(false);
  });

  test("formal homepage source is user-facing and does not mount the prototype shell", () => {
    const source = readFileSync(resolve("src/app/page.tsx"), "utf8");

    expect(source).toContain("/chart/new");
    expect(source).toContain("/account");
    expect(source).not.toContain("/member");
    expect(source).not.toContain("/orders");
    expect(source).not.toContain("/support");
    expect(source).toContain("生成你的星垣观察卡，看见性格结构、关系模式和阶段节奏。");
    expect(source).toContain("生成我的观察卡");
    expect(source).toContain("查看示例");
    expect(source).toContain("今日关键词");
    expect(source).toContain("传统文化 AI 观察卡");
    expect(source).toContain("星垣观察卡");
    expect(source).toContain("性格结构");
    expect(source).toContain("关系模式");
    expect(source).toContain("事业节奏");
    expect(source).toContain("规则来源");
    expect(source).toContain("脱敏默认开启");
    expect(source).toContain("规则可追溯");
    expect(source).toContain("高风险表达过滤");
    expect(source).toContain("7 日复访路径");
    expect(source).toContain("7 日");
    expect(source).toContain("仅供娱乐和自我观察参考");
    expect(source).not.toContain("可测试的业务闭环");
    expect(source).not.toMatch(/PrototypeShell|demoBirthProfile|演示用户|Phase \d|阶段 \d/);
  });

  test("formal share and chart pages expose viral observation-card actions", () => {
    const shareSource = readFileSync(resolve("src/app/share/[id]/page.tsx"), "utf8");
    const chartSource = readFileSync(resolve("src/app/chart/[id]/page.tsx"), "utf8");
    const reportSource = readFileSync(resolve("src/app/report/[id]/page.tsx"), "utf8");
    const formSource = readFileSync(resolve("src/app/chart/new/PublicChartForm.tsx"), "utf8");
    const cssSource = readFileSync(resolve("src/app/globals.css"), "utf8");

    expect(shareSource).toContain("生成我的隐私观察卡");
    expect(shareSource).toContain("已隐藏生日");
    expect(shareSource).toContain("已隐藏时间");
    expect(shareSource).toContain("已隐藏地点");
    expect(shareSource).toContain("加入 7 日观察");
    expect(shareSource).toContain("紫微星垣会隐藏完整出生资料");
    expect(shareSource).toContain("公开分享默认隐藏完整出生日期、出生时间、精确地点和真实身份。");
    expect(shareSource).toContain("share_id");
    expect(shareSource).toContain("channel");
    expect(shareSource).toContain("campaign");
    expect(shareSource).toContain("/chart/new");
    expect(shareSource).toContain("/share-card-preview.png");
    expect(shareSource).toContain("getShareLandingSnapshotAsync");
    expect(shareSource).not.toContain("visitor_id");
    expect(shareSource).not.toContain("privacy_redaction_required");
    expect(chartSource).toContain("生成今日星垣卡");
    expect(chartSource).toContain("生成结果说明");
    expect(chartSource).toContain("规则版本");
    expect(chartSource).toContain("隐私不展示");
    expect(chartSource).toContain("/daily");
    expect(chartSource).toContain("7 日星垣挑战");
    expect(chartSource).toContain("查看完整报告");
    expect(chartSource).toContain("生成脱敏分享");
    expect(chartSource).toContain("AI 转译过程");
    expect(chartSource).toContain("传统术语");
    expect(chartSource).toContain("现代解释");
    expect(chartSource).toContain("安全过滤");
    expect(chartSource).toContain("加入 7 日观察");
    expect(chartSource).toContain("今日打卡");
    expect(chartSource).toContain("1/7");
    expect(chartSource).not.toContain("创建分享入口");
    expect(chartSource).not.toContain("createReportDraft(");
    expect(chartSource).not.toContain("开始 7 日星垣挑战");
    expect(reportSource).toContain("getReportDraftAsync");
    expect(formSource).toContain("使用演示资料");
    expect(formSource).toContain("生成观察卡");
    expect(formSource).not.toContain("生成命盘");
    expect(cssSource).toMatch(/\.share-chip-row span[\s\S]*font-size:\s*13px/);
    expect(cssSource).toMatch(/\.share-chip-row span[\s\S]*overflow-wrap/);
    expect(cssSource).toContain(".hero-proof-row");
    expect(cssSource).toContain(".challenge-panel-shell");
    expect(cssSource).toContain("aspect-ratio: 9 / 16");
  });

  test("contest submission evidence pack and public verification command are ready", () => {
    const packageSource = readFileSync(resolve("package.json"), "utf8");
    const planSource = readFileSync(resolve("docs/Trae-CN黑客松一等奖以上冲刺优化计划.md"), "utf8");
    const captureScriptSource = readFileSync(resolve("scripts/capture-trae-assets.mjs"), "utf8");
    const submissionFiles = [
      "docs/trae-submission/process-log.md",
      "docs/trae-submission/community-post.md",
      "docs/trae-submission/final-submission-control-room.md",
      "docs/trae-submission/demo-script.md",
      "docs/trae-submission/assets-checklist.md",
      "docs/trae-submission/judging-qna.md"
    ];

    for (const submissionFile of submissionFiles) {
      expect(existsSync(resolve(submissionFile)), submissionFile).toBe(true);
      expect(readFileSync(resolve(submissionFile), "utf8").trim().length, submissionFile).toBeGreaterThan(200);
    }

    expect(packageSource).toContain('"verify:public"');
    expect(packageSource).toContain('"verify:trae-submission"');
    expect(packageSource).toContain("tests/public-mvp.test.ts");
    expect(packageSource).toContain("e2e/public-mvp.spec.ts --project=desktop");
    expect(captureScriptSource).toContain("08-investor-loop-slide.png");
    expect(planSource).toContain("npm run verify:public");
    expect(planSource).toContain("传统文化 AI 观察卡");
  });

  test("formal public pages do not contain mojibake or test-account copy", () => {
    for (const routeFile of formalPublicFiles) {
      const source = readFileSync(resolve(routeFile), "utf8");
      expect(source, routeFile).not.toMatch(/绱|鍛|鍒|鎴|瀹|鏌|闅|涓|鐢|浼|璁|棰|Phase \d|demo|测试账号|演示用户/);
    }
  });

  test("SEO and PWA metadata expose formal public routes only", () => {
    const siteMap = sitemap().map((entry) => entry.url);
    const rawRules = robots().rules;
    const botRules = Array.isArray(rawRules) ? rawRules[0] : rawRules;
    const disallow = Array.isArray(botRules.disallow) ? botRules.disallow : [botRules.disallow].filter(Boolean);
    const pwa = manifest();

    expect(siteMap).toEqual(
      expect.arrayContaining([
        "http://localhost:3000/",
        "http://localhost:3000/chart/new",
        "http://localhost:3000/account",
        "http://localhost:3000/member",
        "http://localhost:3000/orders",
        "http://localhost:3000/support",
        "http://localhost:3000/legal/privacy",
        "http://localhost:3000/legal/terms"
      ])
    );
    expect(siteMap.join("\n")).not.toMatch(/phase|demo|internal|ops/);
    expect(disallow).toEqual(expect.arrayContaining(["/internal/", "/api/", "/ops"]));
    expect(pwa.name).toBe("紫微星垣");
    expect(pwa.description).toContain("隐私友好");
    expect(existsSync(resolve("public/icon-192.png")), "PWA icon 192").toBe(true);
    expect(existsSync(resolve("public/icon-512.png")), "PWA icon 512").toBe(true);
    expect(existsSync(resolve("public/share-card-preview.png")), "dedicated share image").toBe(true);
    expect(readFileSync(resolve("src/app/layout.tsx"), "utf8")).toContain("/share-card-preview.png");
  });
});

describe("public chart and share API flow", () => {
  test("creates a chart, reads it back, and creates a redacted public share snapshot", async () => {
    const createdResponse = await createChartPost(
      new Request("http://local/api/chart/create", {
        method: "POST",
        body: JSON.stringify(publicChartBody)
      })
    );
    const created = await createdResponse.json();

    const readResponse = await chartGet(
      new Request(`http://local/api/chart/${created.chart_id}`, {
        headers: { cookie: createdResponse.headers.get("set-cookie") ?? "" }
      }),
      {
        params: Promise.resolve({ id: created.chart_id })
      }
    );
    const read = await readResponse.json();

    const shareResponse = await shareCreatePost(
      new Request("http://local/api/share/create", {
        method: "POST",
        body: JSON.stringify({
          member_id: "member_public_product",
          source_type: "daily_theme",
          source_id: created.chart_id,
          title: `命盘摘要 ${publicChartBody.birth_profile.birth_date}`,
          summary: `出生时间 ${publicChartBody.birth_profile.birth_time}，地点 ${publicChartBody.birth_profile.location.name}。`,
          keywords: ["紫微斗数", "自我观察"],
          safety_flags: ["daily_observation_only"]
        })
      })
    );
    const share = await shareResponse.json();

    expect(createdResponse.status).toBe(201);
    expect(created.chart_id).toMatch(/^chart_/);
    expect(created.privacy).toEqual({
      share_birth_date: false,
      share_birth_time: false,
      share_location: false
    });
    expect(readResponse.status).toBe(200);
    expect(read.chart_id).toBe(created.chart_id);
    expect(read.chart.palaces).toHaveLength(12);
    expect(shareResponse.status).toBe(201);
    expect(share.share_url).toBe(`/share/${share.snapshot.share_id}`);
    expect(JSON.stringify(share)).not.toContain("2000-08-16");
    expect(JSON.stringify(share)).not.toContain("03:30");
    expect(JSON.stringify(share)).not.toContain("上海");
  });
});
