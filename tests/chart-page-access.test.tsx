import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { POST as createChartPost } from "../src/app/api/chart/create/route.js";
import ChartPage from "../src/app/chart/[id]/page.js";
import { buildVisitorCookieHeader } from "../src/auth.js";
import { clearChartsForTests } from "../src/store.js";

const { cookieJar } = vi.hoisted(() => ({
  cookieJar: new Map<string, string>()
}));

vi.mock("next/headers.js", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieJar.get(name);
      return value ? { name, value } : undefined;
    }
  })
}));

const profile = {
  display_name: "页面权限测试用户",
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

describe("private chart page access", () => {
  beforeEach(() => {
    clearChartsForTests();
    cookieJar.clear();
    delete process.env.SESSION_SECRET;
  });

  afterEach(() => {
    delete process.env.SESSION_SECRET;
  });

  test("does not render a private chart page for a different visitor cookie", async () => {
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

    cookieJar.set("zv_visitor_id", "visitor_stranger");
    const element = await ChartPage({ params: Promise.resolve({ id: created.chart_id }) });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain("无权访问该命盘");
    expect(markup).not.toContain("十二宫结构化观察");
    expect(markup).not.toContain("2000-08-16");
    expect(markup).not.toContain("03:30");
    expect(markup).not.toContain("上海");
  });

  test("reads signed HttpOnly visitor cookies on server-rendered private chart pages", async () => {
    process.env.SESSION_SECRET = "session_secret_at_least_32_chars";
    const createResponse = await createChartPost(
      new Request("https://ziwei.example/api/chart/create", {
        method: "POST",
        headers: {
          "x-visitor-id": "visitor_signed_page_owner"
        },
        body: JSON.stringify({ birth_profile: profile })
      })
    );
    const created = await createResponse.json();
    const signedCookie = buildVisitorCookieHeader("visitor_signed_page_owner", { secure: true });
    const cookieValue = /zv_visitor_id=([^;]+)/.exec(signedCookie)?.[1] ?? "";
    cookieJar.set("zv_visitor_id", decodeURIComponent(cookieValue));

    const element = await ChartPage({ params: Promise.resolve({ id: created.chart_id }) });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain("十二宫结构化观察");
    expect(markup).not.toContain("无权访问该命盘");
  });
});
