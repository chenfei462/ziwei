import { describe, expect, test, beforeEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { POST as createChartPost } from "../src/app/api/chart/create/route.js";
import { GET as chartGet } from "../src/app/api/chart/[id]/route.js";
import { GET as analyticsGet } from "../src/app/api/ops/analytics/events/route.js";
import { handleApiRequest } from "../src/api.js";
import { POST as shareCreatePost } from "../src/app/api/share/create/route.js";
import { POST as accountUpgradePost } from "../src/app/api/account/upgrade/route.js";
import { POST as linkAnonymousPost } from "../src/app/api/member/link-anonymous/route.js";
import { getAnonymousLinkRecord, getUserRecord } from "../src/store.js";
import { resolvePersistentStoreDirForRuntime } from "../src/store.js";
import { clearChannelForTests, clearChartsForTests, clearProductEventForTests } from "../src/store.js";

const profile = {
  display_name: "权限测试用户",
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
  true_solar_time_enabled: false,
  gender_rule: "traditional_male"
};

const opsHeaders = {
  "x-admin-token": "phase10_admin_token",
  "x-admin-role": "ops_admin",
  "x-admin-actor": "production_foundation_test"
};

describe("production foundation boundaries", () => {
  beforeEach(() => {
    clearChartsForTests();
    clearChannelForTests();
    clearProductEventForTests();
  });

  test("requires the same visitor or member identity to read a private chart", async () => {
    const createResponse = await createChartPost(
      new Request("http://local/api/chart/create", {
        method: "POST",
        headers: {
          "x-visitor-id": "visitor_owner"
        },
        body: JSON.stringify({ birth_profile: profile })
      })
    );
    const created = await createResponse.json();

    const ownerResponse = await chartGet(new Request(`http://local/api/chart/${created.chart_id}`, { headers: { "x-visitor-id": "visitor_owner" } }), {
      params: Promise.resolve({ id: created.chart_id })
    });
    const owner = await ownerResponse.json();

    const strangerResponse = await chartGet(
      new Request(`http://local/api/chart/${created.chart_id}`, {
        headers: {
          "x-visitor-id": "visitor_stranger"
        }
      }),
      { params: Promise.resolve({ id: created.chart_id }) }
    );
    const stranger = await strangerResponse.json();

    expect(createResponse.status).toBe(201);
    expect(ownerResponse.status).toBe(200);
    expect(owner.chart_id).toBe(created.chart_id);
    expect(strangerResponse.status).toBe(403);
    expect(stranger.error.code).toBe("CHART_ACCESS_FORBIDDEN");
    expect(JSON.stringify(stranger)).not.toContain("2000-08-16");
    expect(JSON.stringify(stranger)).not.toContain("03:30");
    expect(JSON.stringify(stranger)).not.toContain("上海");
  });

  test("issues an anonymous visitor cookie for public chart creation", async () => {
    const createResponse = await createChartPost(
      new Request("http://local/api/chart/create", {
        method: "POST",
        body: JSON.stringify({ birth_profile: profile })
      })
    );
    const created = await createResponse.json();
    const cookie = createResponse.headers.get("set-cookie") ?? "";

    const readResponse = await chartGet(new Request(`http://local/api/chart/${created.chart_id}`, { headers: { cookie } }), {
      params: Promise.resolve({ id: created.chart_id })
    });
    const read = await readResponse.json();

    expect(createResponse.status).toBe(201);
    expect(cookie).toContain("zv_visitor_id=visitor_");
    expect(cookie).toContain("HttpOnly");
    expect(readResponse.status).toBe(200);
    expect(read.chart_id).toBe(created.chart_id);
  });

  test("records public funnel analytics without storing sensitive birth data", async () => {
    const createResponse = await createChartPost(
      new Request("http://local/api/chart/create", {
        method: "POST",
        headers: {
          "x-visitor-id": "visitor_analytics"
        },
        body: JSON.stringify({ birth_profile: profile })
      })
    );
    const created = await createResponse.json();

    await shareCreatePost(
      new Request("http://local/api/share/create", {
        method: "POST",
        headers: {
          "x-visitor-id": "visitor_analytics"
        },
        body: JSON.stringify({
          member_id: "member_analytics",
          source_type: "daily_theme",
          source_id: created.chart_id,
          title: "命盘摘要 2000-08-16",
          summary: "03:30 上海",
          keywords: ["紫微斗数"]
        })
      })
    );

    const analyticsResponse = await analyticsGet(
      new Request("http://local/api/ops/analytics/events", {
        headers: opsHeaders
      })
    );
    const analytics = await analyticsResponse.json();

    expect(analyticsResponse.status).toBe(200);
    expect(analytics.events_by_type.chart_completed).toBe(1);
    expect(analytics.events_by_type.share_created).toBe(1);
    expect(JSON.stringify(analytics)).not.toContain("2000-08-16");
    expect(JSON.stringify(analytics)).not.toContain("03:30");
    expect(JSON.stringify(analytics)).not.toContain("上海");
  });

  test("keeps runtime persistence outside Next build artifacts", () => {
    const runtimeDir = resolvePersistentStoreDirForRuntime({ cwd: "D:/app", nodeEnv: "production" });
    const testDir = resolvePersistentStoreDirForRuntime({ cwd: "D:/app", nodeEnv: "test", processId: 12345 });
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };

    expect(runtimeDir.replace(/\\/g, "/")).toBe("D:/app/data/phase-store");
    expect(testDir.replace(/\\/g, "/")).toMatch(/\/ziwei-phase-store\/test-12345$/);
    expect(packageJson.scripts.typecheck).toContain("next typegen");
  });

  test("ships explicit 404 and 500 error pages for production incidents", () => {
    expect(existsSync("src/app/not-found.tsx")).toBe(true);
    expect(existsSync("src/app/error.tsx")).toBe(true);

    const notFoundSource = readFileSync("src/app/not-found.tsx", "utf8");
    const errorSource = readFileSync("src/app/error.tsx", "utf8");

    expect(notFoundSource).toContain("回到首页");
    expect(errorSource).toContain("服务暂时不可用");
    expect(`${notFoundSource}\n${errorSource}`).not.toMatch(/\/internal|demo|Phase|测试账号|演示用户/);
  });

  test("upgrades anonymous visitor into a persisted user and migrates chart ownership", async () => {
    const createResponse = await createChartPost(
      new Request("http://local/api/chart/create", {
        method: "POST",
        headers: { "x-visitor-id": "visitor_upgrade" },
        body: JSON.stringify({ birth_profile: profile })
      })
    );
    const chart = await createResponse.json();

    const upgradeResponse = await linkAnonymousPost(
      new Request("http://local/api/member/link-anonymous", {
        method: "POST",
        headers: { "x-visitor-id": "visitor_upgrade" },
        body: JSON.stringify({
          visitor_id: "visitor_upgrade",
          member_id: "member_upgrade",
          email: "upgrade@example.com",
          display_name: "升级用户"
        })
      })
    );
    const upgrade = await upgradeResponse.json();
    const upgradedMemberId = upgrade.user.member_id as string;

    const oldVisitorReadResponse = await chartGet(
      new Request(`http://local/api/chart/${chart.chart_id}`, { headers: { "x-visitor-id": "visitor_upgrade" } }),
      { params: Promise.resolve({ id: chart.chart_id }) }
    );
    const memberReadResponse = await chartGet(
      new Request(`http://local/api/chart/${chart.chart_id}`, { headers: { "x-member-id": upgradedMemberId } }),
      { params: Promise.resolve({ id: chart.chart_id }) }
    );

    expect(upgradeResponse.status).toBe(201);
    expect(upgradedMemberId).toMatch(/^member_[a-zA-Z0-9]{1,18}$/);
    expect(upgrade.migrated.chart_ids).toContain(chart.chart_id);
    expect(getUserRecord(upgradedMemberId)?.email_hash).toMatch(/^sha256:/);
    expect(getAnonymousLinkRecord("visitor_upgrade")?.member_id).toBe(upgradedMemberId);
    expect(oldVisitorReadResponse.status).toBe(403);
    expect(memberReadResponse.status).toBe(200);
  });

  test("keeps the legacy synchronous dispatcher on the same persisted anonymous upgrade path", async () => {
    const createResponse = await createChartPost(
      new Request("http://local/api/chart/create", {
        method: "POST",
        headers: { "x-visitor-id": "visitor_dispatch" },
        body: JSON.stringify({ birth_profile: profile })
      })
    );
    const chart = await createResponse.json();

    const response = handleApiRequest("POST", "/api/member/link-anonymous", {
      visitor_id: "visitor_dispatch",
      member_id: "member_dispatch",
      email: "dispatch@example.com",
      display_name: "同步入口用户"
    });
    const upgradedMemberId = (response.body as { user: { member_id: string } }).user.member_id;

    const oldVisitorReadResponse = await chartGet(
      new Request(`http://local/api/chart/${chart.chart_id}`, { headers: { "x-visitor-id": "visitor_dispatch" } }),
      { params: Promise.resolve({ id: chart.chart_id }) }
    );
    const memberReadResponse = await chartGet(
      new Request(`http://local/api/chart/${chart.chart_id}`, { headers: { "x-member-id": upgradedMemberId } }),
      { params: Promise.resolve({ id: chart.chart_id }) }
    );

    expect(response.status).toBe(201);
    expect(upgradedMemberId).toBe("member_dispatch");
    expect(getUserRecord("member_dispatch")?.email_hash).toMatch(/^sha256:/);
    expect(getAnonymousLinkRecord("visitor_dispatch")?.member_id).toBe("member_dispatch");
    expect(oldVisitorReadResponse.status).toBe(403);
    expect(memberReadResponse.status).toBe(200);
  });

  test("upgrades the current HttpOnly visitor session through the public account route", async () => {
    const createResponse = await createChartPost(
      new Request("http://local/api/chart/create", {
        method: "POST",
        body: JSON.stringify({ birth_profile: profile })
      })
    );
    const chart = await createResponse.json();
    const visitorCookie = createResponse.headers.get("set-cookie") ?? "";

    const upgradeResponse = await accountUpgradePost(
      new Request("http://local/api/account/upgrade", {
        method: "POST",
        headers: { cookie: visitorCookie },
        body: JSON.stringify({
          email: "public-account@example.com",
          display_name: "正式账号用户"
        })
      })
    );
    const upgrade = await upgradeResponse.json();

    const oldVisitorReadResponse = await chartGet(new Request(`http://local/api/chart/${chart.chart_id}`, { headers: { cookie: visitorCookie } }), {
      params: Promise.resolve({ id: chart.chart_id })
    });
    const memberReadResponse = await chartGet(
      new Request(`http://local/api/chart/${chart.chart_id}`, { headers: { "x-member-id": upgrade.user.member_id } }),
      { params: Promise.resolve({ id: chart.chart_id }) }
    );

    expect(upgradeResponse.status).toBe(201);
    expect(upgradeResponse.headers.get("set-cookie")).toContain("zv_member_id=");
    expect(upgrade.user.member_id).toMatch(/^member_/);
    expect(upgrade.user.email_hash).toMatch(/^sha256:/);
    expect(JSON.stringify(upgrade)).not.toContain("public-account@example.com");
    expect(getUserRecord(upgrade.user.member_id)?.email_hash).toMatch(/^sha256:/);
    expect(oldVisitorReadResponse.status).toBe(403);
    expect(memberReadResponse.status).toBe(200);
  });
});
