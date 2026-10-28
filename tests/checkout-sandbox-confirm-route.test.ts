import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { clearApiSecurityForTests } from "../src/apiSecurity.js";
import { POST as sandboxConfirmPost } from "../src/app/api/checkout/sandbox/confirm/route.js";
import { createChart } from "../src/chartEngine.js";
import { createReportDraft } from "../src/phase8/reporting.js";
import { createCheckoutSession, createOrder, getReportEntitlement } from "../src/phase9/commerce.js";
import { clearChartsForTests, clearCommerceForTests, clearReportsForTests } from "../src/store.js";

const birthProfile = {
  display_name: "沙箱确认用户",
  calendar_type: "gregorian" as const,
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
  gender_rule: "traditional_male" as const
};

const consent = {
  agreed: true,
  service_terms: true,
  privacy_policy: true,
  refund_policy: true,
  cultural_entertainment_only: true
};

describe("checkout sandbox confirmation route", () => {
  beforeEach(() => {
    clearApiSecurityForTests();
    clearChartsForTests();
    clearReportsForTests();
    clearCommerceForTests();
    vi.stubEnv("CHINA_PAYMENT_PRODUCTION_ENABLED", "false");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("confirms the current user's sandbox checkout without exposing webhook secrets", async () => {
    const { reportId, sessionId } = createSandboxCheckout("member_route_checkout_confirm");

    const response = await sandboxConfirmPost(
      new Request("http://local/api/checkout/sandbox/confirm", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-member-id": "member_route_checkout_confirm"
        },
        body: JSON.stringify({ session_id: sessionId })
      })
    );
    const payload = await response.json();
    const entitlement = getReportEntitlement(reportId, "member_route_checkout_confirm");

    expect(response.status).toBe(200);
    expect(payload.order.status).toBe("fulfilled");
    expect(payload.signature_verified).toBe(true);
    expect(entitlement.can_read_report).toBe(true);
    expect(JSON.stringify(payload)).not.toContain("raw_body");
    expect(JSON.stringify(payload)).not.toContain("signature_header");
    expect(JSON.stringify(payload)).not.toContain("2000-08-16");
    expect(JSON.stringify(payload)).not.toContain("03:30");
    expect(JSON.stringify(payload)).not.toContain("上海");
  });

  test("rejects a sandbox checkout confirmation for another user's order", async () => {
    const { reportId, sessionId } = createSandboxCheckout("member_route_checkout_owner");

    const response = await sandboxConfirmPost(
      new Request("http://local/api/checkout/sandbox/confirm", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-member-id": "member_route_checkout_stranger"
        },
        body: JSON.stringify({ session_id: sessionId })
      })
    );
    const payload = await response.json();
    const entitlement = getReportEntitlement(reportId, "member_route_checkout_owner");

    expect(response.status).toBe(403);
    expect(payload.error).toMatchObject({ code: "ORDER_ACCESS_FORBIDDEN" });
    expect(entitlement.has_access).toBe(false);
  });
});

function createSandboxCheckout(memberId: string): { reportId: string; sessionId: string } {
  const chart = createChart({ birth_profile: birthProfile });
  const draft = createReportDraft({
    report_type: "single_chart",
    chart_id: chart.chart_id,
    chart: chart.chart,
    mode: "professional"
  });
  const order = createOrder({
    report_id: draft.report_id,
    package_id: "single_report",
    tier_id: "standard_49",
    member_id: memberId,
    provider: "wechat_pay_reserved",
    consent
  });
  const session = createCheckoutSession({
    order_id: order.order_id,
    provider: "wechat_pay_reserved",
    success_url: "http://local/commercial/success",
    cancel_url: "http://local/commercial/cancel"
  });
  return { reportId: draft.report_id, sessionId: session.checkout_session_id };
}
