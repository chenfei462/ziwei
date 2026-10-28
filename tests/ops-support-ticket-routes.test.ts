import { describe, expect, test } from "vitest";
import { POST as opsSupportTicketPost } from "../src/app/api/ops/order/[id]/support-ticket/route.js";
import { GET as opsSupportTicketGet, PATCH as opsSupportTicketPatch } from "../src/app/api/ops/support/ticket/[id]/route.js";
import { POST as createChartPost } from "../src/app/api/chart/create/route.js";
import { POST as orderCreatePost } from "../src/app/api/order/create/route.js";
import { POST as reportDraftPost } from "../src/app/api/report/draft/route.js";
import { handleApiRequest } from "../src/api.js";

const opsHeaders = {
  "x-admin-token": "phase10_admin_token",
  "x-admin-role": "ops_admin",
  "x-admin-actor": "ops_support_ticket_route_test"
};

const chartBody = {
  birth_profile: {
    display_name: "Ops support route buyer",
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

async function createTicket() {
  const memberHeaders = { "x-member-id": "member_ops_support_ticket_route" };
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
        member_id: "member_ops_support_ticket_route",
        consent
      })
    })
  );
  const order = await orderResponse.json();
  const ticketResponse = await opsSupportTicketPost(
    new Request(`http://local/api/ops/order/${order.order_id}/support-ticket`, {
      method: "POST",
      headers: opsHeaders,
      body: JSON.stringify({
        category: "refund_request",
        priority: "high",
        subject: "Refund review",
        message: "Refund review without raw birth data.",
        consent: { agreed: true, no_sensitive_birth_data: true }
      })
    }),
    { params: Promise.resolve({ id: order.order_id }) }
  );
  return ticketResponse.json();
}

describe("internal support ticket route handlers", () => {
  test("reads and updates support tickets behind ops authorization", async () => {
    const ticket = await createTicket();
    const getResponse = await opsSupportTicketGet(
      new Request(`http://local/api/ops/support/ticket/${ticket.ticket_id}`, {
        headers: opsHeaders
      }),
      { params: Promise.resolve({ id: ticket.ticket_id }) }
    );
    const read = await getResponse.json();
    const updateResponse = await opsSupportTicketPatch(
      new Request(`http://local/api/ops/support/ticket/${ticket.ticket_id}`, {
        method: "PATCH",
        headers: opsHeaders,
        body: JSON.stringify({
          status: "resolved",
          assignee: "ops_lead",
          note: "Resolved by ops support."
        })
      }),
      { params: Promise.resolve({ id: ticket.ticket_id }) }
    );
    const updated = await updateResponse.json();

    expect(getResponse.status).toBe(200);
    expect(read.ticket_id).toBe(ticket.ticket_id);
    expect(updateResponse.status).toBe(200);
    expect(updated.status).toBe("resolved");
    expect(updated.audit_trail).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "support_ticket_resolved",
          actor_role: "ops_admin",
          actor_id: "ops:ops_admin"
        })
      ])
    );
    expect(JSON.stringify({ read, updated })).not.toMatch(/2000-08-16|03:30|Shanghai/);
  });

  test("rejects support ticket reads and updates without ops credentials", async () => {
    const ticket = await createTicket();
    const getResponse = await opsSupportTicketGet(
      new Request(`http://local/api/ops/support/ticket/${ticket.ticket_id}`),
      { params: Promise.resolve({ id: ticket.ticket_id }) }
    );
    const getBody = await getResponse.json();
    const patchResponse = await opsSupportTicketPatch(
      new Request(`http://local/api/ops/support/ticket/${ticket.ticket_id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "resolved" })
      }),
      { params: Promise.resolve({ id: ticket.ticket_id }) }
    );
    const patchBody = await patchResponse.json();

    expect(getResponse.status).toBe(401);
    expect(getBody.error.code).toBe("OPS_AUTH_REQUIRED");
    expect(patchResponse.status).toBe(401);
    expect(patchBody.error.code).toBe("OPS_AUTH_REQUIRED");
  });

  test("does not serve legacy public support ticket detail dispatcher paths", () => {
    const getResponse = handleApiRequest("GET", "/api/support/ticket/ticket_legacy_public?admin_token=phase10_admin_token&admin_role=ops_admin");
    const patchResponse = handleApiRequest("PATCH", "/api/support/ticket/ticket_legacy_public", {
      auth: { token: "phase10_admin_token", role: "ops_admin" },
      status: "resolved"
    });

    expect(getResponse.status).toBe(404);
    expect(getResponse.body.error).toMatchObject({ code: "ROUTE_NOT_FOUND" });
    expect(patchResponse.status).toBe(404);
    expect(patchResponse.body.error).toMatchObject({ code: "ROUTE_NOT_FOUND" });
  });
});
