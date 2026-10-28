import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { POST as createChartPost } from "../src/app/api/chart/create/route.js";
import { POST as checkoutPost } from "../src/app/api/checkout/session/route.js";
import { POST as orderCreatePost } from "../src/app/api/order/create/route.js";
import { POST as webhookPost } from "../src/app/api/payment/webhook/route.js";
import { POST as reportDraftPost } from "../src/app/api/report/draft/route.js";
import ReportDetailPage from "../src/app/report/[id]/page.js";
import { buildMemberCookieHeader, buildVisitorCookieHeader } from "../src/auth.js";
import { clearCommerceForTests, clearReportsForTests, clearChartsForTests } from "../src/store.js";

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

const birthProfile = {
  display_name: "报告页权限用户",
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

const consent = {
  agreed: true,
  service_terms: true,
  privacy_policy: true,
  refund_policy: true,
  cultural_entertainment_only: true
};

describe("formal report page access", () => {
  beforeEach(() => {
    cookieJar.clear();
    clearChartsForTests();
    clearReportsForTests();
    clearCommerceForTests();
    process.env.SESSION_SECRET = "test_session_secret_at_least_32_characters";
  });

  afterEach(() => {
    delete process.env.SESSION_SECRET;
  });

  test("renders a free redacted summary and purchase path for an unpaid report owner", async () => {
    const { reportId } = await createOwnedReport("visitor_report_page_owner");
    cookieJar.set("zv_visitor_id", signedCookieValue(buildVisitorCookieHeader("visitor_report_page_owner"), "zv_visitor_id"));

    const element = await ReportDetailPage({ params: Promise.resolve({ id: reportId }) });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain("免费摘要");
    expect(markup).toContain("单盘六宫观察报告摘要");
    expect(markup).not.toContain("Single chart six-palace report");
    expect(markup).toContain("购买完整报告");
    expect(markup).toContain("标准报告权益");
    expect(markup).toContain("规则版本已记录");
    expect(markup).toContain("AI 转译版本已记录");
    expect(markup).not.toContain("standard_49");
    expect(markup).not.toContain("interpretation_rewrite");
    expect(markup).not.toContain("rules_v0.2");
    expect(markup).not.toContain("life palace");
    expect(markup).not.toContain("career palace");
    expect(markup).not.toContain(" trace");
    expect(markup).toContain("解锁标准报告 49 元");
    expect(markup).toContain("解锁高级报告 99 元");
    expect(markup).toContain("六宫细节");
    expect(markup).toContain("规则溯源");
    expect(markup).toContain("导出预览");
    expect(markup).not.toContain('href="/member"><svg');
    expect(markup).toContain("公开分享仅展示脱敏摘要");
    expect(markup).not.toContain("宫位详情");
    expect(markup).not.toContain("2000-08-16");
    expect(markup).not.toContain("03:30");
    expect(markup).not.toContain("上海");
  });

  test("does not render a report page summary for a stranger", async () => {
    const { reportId } = await createOwnedReport("visitor_report_page_owner");
    cookieJar.set("zv_visitor_id", signedCookieValue(buildVisitorCookieHeader("visitor_report_page_stranger"), "zv_visitor_id"));

    const element = await ReportDetailPage({ params: Promise.resolve({ id: reportId }) });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain("无权访问该报告");
    expect(markup).not.toContain("免费摘要");
    expect(markup).not.toContain("2000-08-16");
    expect(markup).not.toContain("03:30");
    expect(markup).not.toContain("上海");
  });

  test("renders private report detail after a standard entitlement is fulfilled", async () => {
    const memberId = "member_report_page_buyer";
    const { reportId } = await createOwnedReport("visitor_report_page_buyer");
    await purchaseReport(reportId, memberId);
    cookieJar.set("zv_member_id", signedCookieValue(buildMemberCookieHeader(memberId), "zv_member_id"));

    const element = await ReportDetailPage({ params: Promise.resolve({ id: reportId }) });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain("宫位详情");
    expect(markup).toContain("私密详情");
    expect(markup).not.toContain("购买完整报告");
    expect(markup).not.toContain("2000-08-16");
    expect(markup).not.toContain("03:30");
    expect(markup).not.toContain("上海");
  });
});

async function createOwnedReport(visitorId: string): Promise<{ reportId: string }> {
  const chartResponse = await createChartPost(
    new Request("http://local/api/chart/create", {
      method: "POST",
      headers: { "x-visitor-id": visitorId },
      body: JSON.stringify({ birth_profile: birthProfile })
    })
  );
  const chart = await chartResponse.json();
  const reportResponse = await reportDraftPost(
    new Request("http://local/api/report/draft", {
      method: "POST",
      headers: { "x-visitor-id": visitorId },
      body: JSON.stringify({
        report_type: "single_chart",
        chart_id: chart.chart_id,
        chart: chart.chart,
        mode: "professional"
      })
    })
  );
  const report = await reportResponse.json();
  return { reportId: report.report_id };
}

function signedCookieValue(header: string, name: string): string {
  const match = new RegExp(`${name}=([^;]+)`).exec(header);
  if (!match) throw new Error(`missing ${name} cookie`);
  return decodeURIComponent(match[1]);
}

async function purchaseReport(reportId: string, memberId: string): Promise<void> {
  const memberHeaders = { "x-member-id": memberId };
  const orderResponse = await orderCreatePost(
    new Request("http://local/api/order/create", {
      method: "POST",
      headers: memberHeaders,
      body: JSON.stringify({
        report_id: reportId,
        package_id: "single_report",
        tier_id: "standard_49",
        member_id: memberId,
        consent
      })
    })
  );
  const order = await orderResponse.json();
  const checkoutResponse = await checkoutPost(
    new Request("http://local/api/checkout/session", {
      method: "POST",
      headers: memberHeaders,
      body: JSON.stringify({
        order_id: order.order_id,
        provider: "stripe_checkout",
        success_url: "http://local/commercial/success",
        cancel_url: "http://local/commercial/cancel"
      })
    })
  );
  const checkout = await checkoutResponse.json();
  await webhookPost(
    new Request("http://local/api/payment/webhook", {
      method: "POST",
      body: checkout.sandbox_webhook.raw_body,
      headers: {
        "stripe-signature": checkout.sandbox_webhook.signature_header
      }
    })
  );
}
