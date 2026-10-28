import { describe, expect, test } from "vitest";
import { POST as createChartPost } from "../src/app/api/chart/create/route.js";
import { POST as checkoutPost } from "../src/app/api/checkout/session/route.js";
import { GET as entitlementGet } from "../src/app/api/entitlement/report/[report_id]/route.js";
import { GET as memberGet } from "../src/app/api/member/me/route.js";
import { POST as orderCreatePost } from "../src/app/api/order/create/route.js";
import { GET as orderGet } from "../src/app/api/order/[id]/route.js";
import { GET as orderListGet } from "../src/app/api/order/list/route.js";
import { POST as webhookPost } from "../src/app/api/payment/webhook/route.js";
import { POST as reportDraftPost } from "../src/app/api/report/draft/route.js";

const chartBody = {
  birth_profile: {
    display_name: "Phase 9 route buyer",
    calendar_type: "gregorian",
    birth_date: "2000-08-16",
    birth_time: "03:30",
    timezone: "Asia/Shanghai",
    location: {
      name: "Shanghai",
      longitude: 121.4737,
      latitude: 31.2304
    },
    is_leap_month: false,
    true_solar_time_enabled: false,
    gender_rule: "traditional_male"
  }
};

const consent = {
  agreed: true,
  service_terms: true,
  privacy_policy: true,
  refund_policy: true,
  cultural_entertainment_only: true
};

describe("phase 9 commerce route handlers", () => {
  test("creates order, checkout session, processes webhook, and grants report entitlement", async () => {
    const memberHeaders = { "x-member-id": "member_route" };
    const chartResponse = await createChartPost(
      new Request("http://local/api/chart/create", {
        method: "POST",
        headers: memberHeaders,
        body: JSON.stringify(chartBody)
      })
    );
    const chart = await chartResponse.json();

    const draftResponse = await reportDraftPost(
      new Request("http://local/api/report/draft", {
        method: "POST",
        headers: memberHeaders,
        body: JSON.stringify({
          report_type: "single_chart",
          chart_id: chart.chart_id,
          chart: chart.chart,
          mode: "professional"
        })
      })
    );
    const draft = await draftResponse.json();

    const orderResponse = await orderCreatePost(
      new Request("http://local/api/order/create", {
        method: "POST",
        headers: memberHeaders,
        body: JSON.stringify({
          report_id: draft.report_id,
          package_id: "single_report",
          tier_id: "standard_49",
          member_id: "member_route",
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

    const readResponse = await orderGet(new Request(`http://local/api/order/${order.order_id}`, { headers: memberHeaders }), {
      params: Promise.resolve({ id: order.order_id })
    });
    const read = await readResponse.json();

    const listResponse = await orderListGet(new Request("http://local/api/order/list", { headers: memberHeaders }));
    const list = await listResponse.json();

    const entitlementResponse = await entitlementGet(new Request(`http://local/api/entitlement/report/${draft.report_id}`, { headers: memberHeaders }), {
      params: Promise.resolve({ report_id: draft.report_id })
    });
    const entitlement = await entitlementResponse.json();

    const memberResponse = await memberGet(new Request("http://local/api/member/me", { headers: memberHeaders }));
    const member = await memberResponse.json();

    expect(orderResponse.status).toBe(201);
    expect(order.status).toBe("created");
    expect(checkoutResponse.status).toBe(201);
    expect(checkout.checkout_url).toContain("/commercial/checkout-sandbox");
    expect(webhookResponse.status).toBe(200);
    expect(webhook.order.status).toBe("fulfilled");
    expect(read.status).toBe("fulfilled");
    expect(list.orders.map((item: { order_id: string }) => item.order_id)).toContain(order.order_id);
    expect(entitlement.has_access).toBe(true);
    expect(member.purchased_report_ids).toContain(draft.report_id);
    expect(JSON.stringify({ order, checkout, webhook, read, list, entitlement, member })).not.toContain("2000-08-16");
    expect(JSON.stringify({ order, checkout, webhook, read, list, entitlement, member })).not.toContain("03:30");
    expect(JSON.stringify({ order, checkout, webhook, read, list, entitlement, member })).not.toContain("Shanghai");
  });

  test("returns shared error envelopes for invalid report and invalid webhook signature", async () => {
    const orderResponse = await orderCreatePost(
      new Request("http://local/api/order/create", {
        method: "POST",
        body: JSON.stringify({
          report_id: "missing",
          package_id: "single_report",
          tier_id: "standard_49",
          member_id: "member_route_error",
          consent
        })
      })
    );
    const order = await orderResponse.json();

    const webhookResponse = await webhookPost(
      new Request("http://local/api/payment/webhook", {
        method: "POST",
        body: JSON.stringify({ event_id: "evt_bad", type: "checkout.session.completed" }),
        headers: {
          "stripe-signature": "t=1,v1=bad"
        }
      })
    );
    const webhook = await webhookResponse.json();

    expect(orderResponse.status).toBe(404);
    expect(order.error).toMatchObject({ code: "REPORT_NOT_FOUND", field: "report_id" });
    expect(webhookResponse.status).toBe(400);
    expect(webhook.error).toMatchObject({ code: "PAYMENT_WEBHOOK_SIGNATURE_INVALID", field: "stripe-signature" });
  });
});
