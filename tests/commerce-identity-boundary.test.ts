import { beforeEach, describe, expect, test } from "vitest";
import { createChart } from "../src/chartEngine.js";
import { POST as checkoutPost } from "../src/app/api/checkout/session/route.js";
import { GET as memberGet } from "../src/app/api/member/me/route.js";
import { POST as orderCreatePost } from "../src/app/api/order/create/route.js";
import { GET as orderGet } from "../src/app/api/order/[id]/route.js";
import { GET as orderListGet } from "../src/app/api/order/list/route.js";
import { POST as webhookPost } from "../src/app/api/payment/webhook/route.js";
import { createReportDraft } from "../src/phase8/reporting.js";
import { buildVisitorCookieHeader } from "../src/auth.js";
import { clearChartsForTests, clearCommerceForTests, clearReportsForTests } from "../src/store.js";

const consent = {
  agreed: true,
  service_terms: true,
  privacy_policy: true,
  refund_policy: true,
  cultural_entertainment_only: true
};

const profile = {
  display_name: "订单隔离测试",
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

describe("commerce identity boundary", () => {
  beforeEach(() => {
    clearChartsForTests();
    clearReportsForTests();
    clearCommerceForTests();
  });

  test("anonymous orders and entitlements are scoped to the visitor cookie", async () => {
    const report = createApprovedReport();
    const ownerCookie = buildVisitorCookieHeader("visitor_order_owner");
    const strangerCookie = buildVisitorCookieHeader("visitor_order_stranger");

    const orderResponse = await orderCreatePost(
      new Request("http://local/api/order/create", {
        method: "POST",
        headers: { cookie: ownerCookie },
        body: JSON.stringify({
          report_id: report.report_id,
          package_id: "single_report",
          tier_id: "standard_49",
          member_id: "member_spoofed",
          consent
        })
      })
    );
    const order = await orderResponse.json();

    const strangerCheckoutResponse = await checkoutPost(
      new Request("http://local/api/checkout/session", {
        method: "POST",
        headers: { cookie: strangerCookie },
        body: JSON.stringify({
          order_id: order.order_id,
          provider: "stripe_checkout",
          success_url: "http://local/commercial/success",
          cancel_url: "http://local/commercial/cancel"
        })
      })
    );
    const strangerCheckout = await strangerCheckoutResponse.json();

    const checkoutResponse = await checkoutPost(
      new Request("http://local/api/checkout/session", {
        method: "POST",
        headers: { cookie: ownerCookie },
        body: JSON.stringify({
          order_id: order.order_id,
          provider: "stripe_checkout",
          success_url: "http://local/commercial/success",
          cancel_url: "http://local/commercial/cancel"
        })
      })
    );
    const checkout = await checkoutResponse.json();
    const webhookResponse = await webhookPost(
      new Request("http://local/api/payment/webhook", {
        method: "POST",
        body: checkout.sandbox_webhook.raw_body,
        headers: {
          "stripe-signature": checkout.sandbox_webhook.signature_header
        }
      })
    );
    const webhook = await webhookResponse.json();

    const ownerListResponse = await orderListGet(new Request("http://local/api/order/list", { headers: { cookie: ownerCookie } }));
    const ownerList = await ownerListResponse.json();
    const strangerListResponse = await orderListGet(new Request("http://local/api/order/list", { headers: { cookie: strangerCookie } }));
    const strangerList = await strangerListResponse.json();
    const ownerMemberResponse = await memberGet(new Request("http://local/api/member/me", { headers: { cookie: ownerCookie } }));
    const ownerMember = await ownerMemberResponse.json();
    const strangerMemberResponse = await memberGet(new Request("http://local/api/member/me", { headers: { cookie: strangerCookie } }));
    const strangerMember = await strangerMemberResponse.json();

    expect(orderResponse.status).toBe(201);
    expect(order.member_id).toBe("visitor_order_owner");
    expect(strangerCheckoutResponse.status).toBe(403);
    expect(strangerCheckout.error.code).toBe("ORDER_ACCESS_FORBIDDEN");
    expect(webhookResponse.status).toBe(200);
    expect(webhook.order.status).toBe("fulfilled");
    expect(ownerList.orders.map((item: { order_id: string }) => item.order_id)).toContain(order.order_id);
    expect(strangerList.orders.map((item: { order_id: string }) => item.order_id)).not.toContain(order.order_id);
    expect(ownerMember.purchased_report_ids).toContain(report.report_id);
    expect(strangerMember.purchased_report_ids).not.toContain(report.report_id);

    const strangerOrderResponse = await orderGet(new Request(`http://local/api/order/${order.order_id}`, { headers: { cookie: strangerCookie } }), {
      params: Promise.resolve({ id: order.order_id })
    });
    const strangerOrder = await strangerOrderResponse.json();

    expect(strangerOrderResponse.status).toBe(403);
    expect(strangerOrder.error.code).toBe("ORDER_ACCESS_FORBIDDEN");
  });
});

function createApprovedReport() {
  const chart = createChart({ birth_profile: profile });
  return createReportDraft({
    report_type: "single_chart",
    chart_id: chart.chart_id,
    chart: chart.chart,
    mode: "entertainment"
  });
}
