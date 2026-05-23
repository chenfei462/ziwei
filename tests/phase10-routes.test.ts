import { describe, expect, test } from "vitest";
import { POST as createChartPost } from "../src/app/api/chart/create/route.js";
import { POST as checkoutPost } from "../src/app/api/checkout/session/route.js";
import { GET as launchDashboardGet } from "../src/app/api/launch/dashboard/route.js";
import { GET as opsOrdersGet } from "../src/app/api/ops/orders/route.js";
import { POST as opsRefundPost } from "../src/app/api/ops/order/[id]/refund/route.js";
import { POST as orderCreatePost } from "../src/app/api/order/create/route.js";
import { POST as webhookPost } from "../src/app/api/payment/webhook/route.js";
import { POST as reportDraftPost } from "../src/app/api/report/draft/route.js";
import { POST as supportTicketPost } from "../src/app/api/support/ticket/route.js";
import { PATCH as supportTicketPatch } from "../src/app/api/support/ticket/[id]/route.js";

const adminHeaders = {
  "x-admin-token": "phase10_admin_token",
  "x-admin-role": "ops_admin"
};

const chartBody = {
  birth_profile: {
    display_name: "Phase 10 route buyer",
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

describe("phase 10 launch ops route handlers", () => {
  test("completes order fulfillment, ops lookup, support ticket, and manual refund route flow", async () => {
    const chartResponse = await createChartPost(
      new Request("http://local/api/chart/create", {
        method: "POST",
        body: JSON.stringify(chartBody)
      })
    );
    const chart = await chartResponse.json();

    const draftResponse = await reportDraftPost(
      new Request("http://local/api/report/draft", {
        method: "POST",
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
        body: JSON.stringify({
          report_id: draft.report_id,
          package_id: "single_report",
          tier_id: "standard_49",
          member_id: "member_phase10_route",
          consent
        })
      })
    );
    const order = await orderResponse.json();

    const checkoutResponse = await checkoutPost(
      new Request("http://local/api/checkout/session", {
        method: "POST",
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

    const ticketResponse = await supportTicketPost(
      new Request("http://local/api/support/ticket", {
        method: "POST",
        body: JSON.stringify({
          member_id: "member_phase10_route",
          order_id: order.order_id,
          report_id: draft.report_id,
          category: "refund_request",
          priority: "high",
          subject: "Refund route request",
          message: "Refund for 2000-08-16 03:30 Shanghai",
          consent: { agreed: true, no_sensitive_birth_data: true }
        })
      })
    );
    const ticket = await ticketResponse.json();

    const listResponse = await opsOrdersGet(
      new Request("http://local/api/ops/orders?status=fulfilled", {
        headers: adminHeaders
      })
    );
    const list = await listResponse.json();

    const refundResponse = await opsRefundPost(
      new Request(`http://local/api/ops/order/${order.order_id}/refund`, {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({
          ticket_id: ticket.ticket_id,
          reason: "manual refund after support review"
        })
      }),
      { params: Promise.resolve({ id: order.order_id }) }
    );
    const refund = await refundResponse.json();

    const updateTicketResponse = await supportTicketPatch(
      new Request(`http://local/api/support/ticket/${ticket.ticket_id}`, {
        method: "PATCH",
        headers: adminHeaders,
        body: JSON.stringify({
          status: "resolved",
          assignee: "ops_lead",
          note: "Refund marked."
        })
      }),
      { params: Promise.resolve({ id: ticket.ticket_id }) }
    );
    const updateTicket = await updateTicketResponse.json();

    const dashboardResponse = await launchDashboardGet(
      new Request("http://local/api/launch/dashboard", {
        headers: adminHeaders
      })
    );
    const dashboard = await dashboardResponse.json();

    expect(ticketResponse.status).toBe(201);
    expect(list.orders.map((item: { order_id: string }) => item.order_id)).toContain(order.order_id);
    expect(refundResponse.status).toBe(200);
    expect(refund.order.status).toBe("refunded_manual");
    expect(updateTicket.status).toBe("resolved");
    expect(dashboard.orders.refunded_manual_orders).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify({ ticket, list, refund, updateTicket, dashboard })).not.toContain("2000-08-16");
    expect(JSON.stringify({ ticket, list, refund, updateTicket, dashboard })).not.toContain("03:30");
    expect(JSON.stringify({ ticket, list, refund, updateTicket, dashboard })).not.toContain("Shanghai");
  });

  test("blocks ops routes without admin authorization", async () => {
    const response = await opsOrdersGet(new Request("http://local/api/ops/orders"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toMatchObject({ code: "OPS_AUTH_REQUIRED" });
  });
});
