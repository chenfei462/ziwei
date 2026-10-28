import { beforeEach, describe, expect, test } from "vitest";
import { POST as createChartPost } from "../src/app/api/chart/create/route.js";
import { POST as checkoutPost } from "../src/app/api/checkout/session/route.js";
import { GET as opsLaunchDashboardGet } from "../src/app/api/ops/launch/dashboard/route.js";
import { GET as opsAuditLogsGet } from "../src/app/api/ops/audit-logs/route.js";
import { GET as opsContentReviewsGet } from "../src/app/api/ops/content-reviews/route.js";
import { GET as opsOverviewGet } from "../src/app/api/ops/overview/route.js";
import { GET as opsOrdersGet } from "../src/app/api/ops/orders/route.js";
import { GET as opsReportsGet } from "../src/app/api/ops/reports/route.js";
import { GET as opsReconciliationGet } from "../src/app/api/ops/reconciliation/route.js";
import { POST as opsReconciliationAlertsPost } from "../src/app/api/ops/reconciliation/alerts/route.js";
import { POST as opsReconciliationImportPost } from "../src/app/api/ops/reconciliation/import/route.js";
import { POST as opsReconciliationPreviewPost } from "../src/app/api/ops/reconciliation/preview/route.js";
import { POST as opsRuleProfileDefaultPost } from "../src/app/api/ops/rule-profiles/default/route.js";
import { GET as opsRuleProfilesGet } from "../src/app/api/ops/rule-profiles/route.js";
import { GET as opsSharesGet } from "../src/app/api/ops/shares/route.js";
import { PATCH as opsSupportTicketPatch } from "../src/app/api/ops/support/ticket/[id]/route.js";
import { GET as opsUsersGet } from "../src/app/api/ops/users/route.js";
import { POST as opsReissueEntitlementPost } from "../src/app/api/ops/order/[id]/entitlement/reissue/route.js";
import { POST as opsRefundPost } from "../src/app/api/ops/order/[id]/refund/route.js";
import { POST as opsSupportTicketPost } from "../src/app/api/ops/order/[id]/support-ticket/route.js";
import { POST as opsSensitiveRecordPost } from "../src/app/api/ops/sensitive-record/route.js";
import { POST as orderCreatePost } from "../src/app/api/order/create/route.js";
import { POST as webhookPost } from "../src/app/api/payment/webhook/route.js";
import { POST as reportDraftPost } from "../src/app/api/report/draft/route.js";
import { POST as shareCreatePost } from "../src/app/api/share/create/route.js";
import { POST as supportTicketPost } from "../src/app/api/support/ticket/route.js";
import { handleApiRequest } from "../src/api.js";
import { resetRuleProfilesForTests } from "../src/phase11/ruleProfileData.js";

const adminHeaders = {
  "x-admin-token": "phase10_admin_token",
  "x-admin-role": "ops_admin"
};

const adminHeadersWithMfa = {
  ...adminHeaders,
  "x-admin-mfa-code": "654321"
};

beforeEach(() => {
  resetRuleProfilesForTests();
});

async function withOpsMfaEnv<T>(
  env: { enabled?: string; code?: string },
  action: () => Promise<T> | T
): Promise<T> {
  const previousEnabled = process.env.PHASE10_OPS_MFA_ENABLED;
  const previousCode = process.env.PHASE10_OPS_MFA_CODE;
  if (env.enabled === undefined) {
    delete process.env.PHASE10_OPS_MFA_ENABLED;
  } else {
    process.env.PHASE10_OPS_MFA_ENABLED = env.enabled;
  }
  if (env.code === undefined) {
    delete process.env.PHASE10_OPS_MFA_CODE;
  } else {
    process.env.PHASE10_OPS_MFA_CODE = env.code;
  }
  try {
    return await action();
  } finally {
    if (previousEnabled === undefined) {
      delete process.env.PHASE10_OPS_MFA_ENABLED;
    } else {
      process.env.PHASE10_OPS_MFA_ENABLED = previousEnabled;
    }
    if (previousCode === undefined) {
      delete process.env.PHASE10_OPS_MFA_CODE;
    } else {
      process.env.PHASE10_OPS_MFA_CODE = previousCode;
    }
  }
}

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
    const memberHeaders = { "x-member-id": "member_phase10_route" };
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
          member_id: "member_phase10_route",
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

    const ticketResponse = await opsSupportTicketPost(
      new Request(`http://local/api/ops/order/${order.order_id}/support-ticket`, {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({
          member_id: "member_spoofed_by_ops_client",
          report_id: "report_spoofed_by_ops_client",
          category: "refund_request",
          priority: "high",
          subject: "Refund route request",
          message: "Refund for 2000-08-16 03:30 Shanghai",
          consent: { agreed: true, no_sensitive_birth_data: true }
        })
      }),
      { params: Promise.resolve({ id: order.order_id }) }
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

    const updateTicketResponse = await opsSupportTicketPatch(
      new Request(`http://local/api/ops/support/ticket/${ticket.ticket_id}`, {
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

    const dashboardResponse = await opsLaunchDashboardGet(
      new Request("http://local/api/ops/launch/dashboard", {
        headers: adminHeaders
      })
    );
    const dashboard = await dashboardResponse.json();
    const reissueResponse = await opsReissueEntitlementPost(
      new Request(`http://local/api/ops/order/${order.order_id}/entitlement/reissue`, {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({
          reason: "customer reports entitlement missing after support review",
          export_preview_credits: 2
        })
      }),
      { params: Promise.resolve({ id: order.order_id }) }
    );
    const reissue = await reissueResponse.json();
    const reconciliationResponse = await opsReconciliationGet(
      new Request("http://local/api/ops/reconciliation", {
        headers: adminHeaders
      })
    );
    const reconciliation = await reconciliationResponse.json();
    const statementImportResponse = await opsReconciliationImportPost(
      new Request("http://local/api/ops/reconciliation/import", {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({
          provider: "wechat_pay_reserved",
          statement_id: "statement_route_20260609",
          period_start: "2026-06-09",
          period_end: "2026-06-09",
          rows: [
            {
              provider_transaction_id: "wx_match_route",
              order_id: order.order_id,
              type: "payment",
              amount_cents: order.amount_cents,
              occurred_at: "2026-06-09T00:00:00.000Z"
            },
            {
              provider_transaction_id: "wx_amount_mismatch_route",
              order_id: order.order_id,
              type: "payment",
              amount_cents: order.amount_cents + 100,
              occurred_at: "2026-06-09T00:01:00.000Z"
            },
            {
              provider_transaction_id: "wx_orphan_route",
              order_id: "order_missing_from_internal_store",
              type: "payment",
              amount_cents: 8800,
              occurred_at: "2026-06-09T00:02:00.000Z",
              raw_reference: "openid_2000-08-16_03:30_Shanghai"
            }
          ]
        })
      })
    );
    const statementImport = await statementImportResponse.json();
    const reconciliationWithStatementResponse = await opsReconciliationGet(
      new Request("http://local/api/ops/reconciliation", {
        headers: adminHeaders
      })
    );
    const reconciliationWithStatement = await reconciliationWithStatementResponse.json();
    const alertDrillResponse = await opsReconciliationAlertsPost(
      new Request("http://local/api/ops/reconciliation/alerts", {
        method: "POST",
        headers: {
          ...adminHeaders,
          "content-type": "application/json",
          "x-admin-actor": "ops_route_alert"
        },
        body: JSON.stringify({
          mode: "dry_run",
          reason: "Route alert drill for 2000-08-16 03:30 Shanghai"
        })
      })
    );
    const alertDrill = await alertDrillResponse.json();
    const forbiddenAlertResponse = await opsReconciliationAlertsPost(
      new Request("http://local/api/ops/reconciliation/alerts", {
        method: "POST",
        headers: {
          "x-admin-token": "phase10_admin_token",
          "x-admin-role": "support_agent",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          mode: "dry_run",
          reason: "Support agent should not send finance alerts"
        })
      })
    );
    const overviewResponse = await opsOverviewGet(
      new Request("http://local/api/ops/overview", {
        headers: adminHeaders
      })
    );
    const overview = await overviewResponse.json();
    const contentReviewsResponse = await opsContentReviewsGet(
      new Request(`http://local/api/ops/content-reviews?report_id=${draft.report_id}`, {
        headers: adminHeaders
      })
    );
    const contentReviews = await contentReviewsResponse.json();
    const shareResponse = await shareCreatePost(
      new Request("http://local/api/share/create", {
        method: "POST",
        body: JSON.stringify({
          member_id: "member_phase10_route",
          source_type: "report_summary",
          source_id: draft.report_id,
          title: `报告摘要 ${chartBody.birth_profile.birth_date}`,
          summary: `出生时间 ${chartBody.birth_profile.birth_time}，地点 ${chartBody.birth_profile.location.name}。`,
          keywords: ["紫微斗数", "报告"],
          safety_flags: ["privacy_redaction_required"]
        })
      })
    );
    const share = await shareResponse.json();
    const opsUsersResponse = await opsUsersGet(
      new Request(`http://local/api/ops/users?member_id=${order.member_id}`, {
        headers: adminHeaders
      })
    );
    const opsUsers = await opsUsersResponse.json();
    const opsReportsResponse = await opsReportsGet(
      new Request(`http://local/api/ops/reports?report_id=${draft.report_id}`, {
        headers: adminHeaders
      })
    );
    const opsReports = await opsReportsResponse.json();
    const opsSharesResponse = await opsSharesGet(
      new Request(`http://local/api/ops/shares?source_id=${draft.report_id}`, {
        headers: adminHeaders
      })
    );
    const opsShares = await opsSharesResponse.json();
    const forbiddenRevealResponse = await opsSensitiveRecordPost(
      new Request("http://local/api/ops/sensitive-record", {
        method: "POST",
        headers: {
          "x-admin-token": "phase10_admin_token",
          "x-admin-role": "support_agent",
          "x-admin-actor": "support_route"
        },
        body: JSON.stringify({
          record_type: "chart",
          record_id: chart.chart_id,
          reason: "support should not reveal sensitive chart context",
          second_confirmed: true
        })
      })
    );
    const revealResponse = await opsSensitiveRecordPost(
      new Request("http://local/api/ops/sensitive-record", {
        method: "POST",
        headers: {
          ...adminHeaders,
          "x-admin-actor": "ops_privacy_route"
        },
        body: JSON.stringify({
          record_type: "chart",
          record_id: chart.chart_id,
          reason: "privacy review for 2000-08-16 03:30 Shanghai",
          second_confirmed: true,
          ticket_id: ticket.ticket_id
        })
      })
    );
    const reveal = await revealResponse.json();
    const auditLogsResponse = await opsAuditLogsGet(
      new Request("http://local/api/ops/audit-logs", {
        headers: adminHeaders
      })
    );
    const auditLogs = await auditLogsResponse.json();
    const overviewAfterAuditResponse = await opsOverviewGet(
      new Request("http://local/api/ops/overview", {
        headers: adminHeaders
      })
    );
    const overviewAfterAudit = await overviewAfterAuditResponse.json();

    expect(ticketResponse.status).toBe(201);
    expect(list.orders.map((item: { order_id: string }) => item.order_id)).toContain(order.order_id);
    expect(refundResponse.status).toBe(200);
    expect(refund.order.status).toBe("refunded");
    expect(reissueResponse.status).toBe(200);
    expect(reissue.entitlement.has_access).toBe(true);
    expect(reissue.note.action).toBe("entitlement_reissued");
    expect(reconciliationResponse.status).toBe(200);
    expect(reconciliation.summary.gross_amount_cents).toBeGreaterThanOrEqual(order.amount_cents);
    expect(reconciliation.summary.refunded_amount_cents).toBeGreaterThanOrEqual(order.amount_cents);
    expect(statementImportResponse.status).toBe(200);
    expect(statementImport.statement.row_count).toBe(3);
    expect(JSON.stringify(statementImport)).not.toMatch(/2000-08-16|03:30|Shanghai|openid/);
    expect(reconciliationWithStatement.provider_statements.summary.statement_count).toBeGreaterThanOrEqual(1);
    expect(reconciliationWithStatement.provider_statements.summary.matched_row_count).toBeGreaterThanOrEqual(1);
    expect(reconciliationWithStatement.provider_statements.summary.amount_mismatch_count).toBeGreaterThanOrEqual(1);
    expect(reconciliationWithStatement.provider_statements.summary.orphan_provider_row_count).toBeGreaterThanOrEqual(1);
    expect(reconciliationWithStatement.provider_statements.discrepancies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "amount_mismatch", provider_transaction_id: "wx_amount_mismatch_route" }),
        expect.objectContaining({ type: "orphan_provider_row", provider_transaction_id: "wx_orphan_route" })
      ])
    );
    expect(reconciliationWithStatement.alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "PROVIDER_STATEMENT_AMOUNT_MISMATCH",
          severity: "warning",
          provider: "wechat_pay_reserved"
        }),
        expect.objectContaining({
          code: "PROVIDER_STATEMENT_ORPHAN_ROWS",
          severity: "critical",
          provider: "wechat_pay_reserved"
        })
      ])
    );
    expect(JSON.stringify(reconciliationWithStatement.alerts)).not.toMatch(/2000-08-16|03:30|Shanghai|openid/);
    expect(alertDrillResponse.status).toBe(200);
    expect(alertDrill.status).toBe("dry_run");
    expect(alertDrill.delivery.attempted).toBe(false);
    expect(alertDrill.payload.alerts).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "PROVIDER_STATEMENT_ORPHAN_ROWS" })])
    );
    expect(JSON.stringify(alertDrill)).not.toMatch(/2000-08-16|03:30|Shanghai|openid|secret|token/);
    expect(forbiddenAlertResponse.status).toBe(403);
    expect(updateTicket.status).toBe("resolved");
    expect(dashboard.orders.refunded_manual_orders).toBeGreaterThanOrEqual(1);
    expect(overviewResponse.status).toBe(200);
    expect(contentReviewsResponse.status).toBe(200);
    expect(shareResponse.status).toBe(201);
    expect(opsUsersResponse.status).toBe(200);
    expect(opsReportsResponse.status).toBe(200);
    expect(opsSharesResponse.status).toBe(200);
    expect(forbiddenRevealResponse.status).toBe(403);
    expect(revealResponse.status).toBe(200);
    expect(auditLogsResponse.status).toBe(200);
    expect(overviewAfterAuditResponse.status).toBe(200);
    expect(contentReviews.reviews).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          report_id: draft.report_id,
          source_type: "report",
          status: "approved"
        })
      ])
    );
    expect(opsUsers.users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          member_id: order.member_id,
          order_count: expect.any(Number),
          report_count: expect.any(Number)
        })
      ])
    );
    expect(opsReports.reports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          report_id: draft.report_id,
          report_type: "single_chart",
          review_status: "approved",
          section_count: 6
        })
      ])
    );
    expect(opsShares.shares).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          share_id: share.snapshot.share_id,
          source_type: "report_summary",
          source_id: draft.report_id
        })
      ])
    );
    expect(reveal.record_type).toBe("chart");
    expect(JSON.stringify(reveal.record)).toMatch(/2000-0?8-16/);
    expect(JSON.stringify(reveal.record)).toContain(chartBody.birth_profile.birth_time);
    expect(reveal.audit_log.actor_id).toBe("ops:ops_admin");
    expect(reveal.audit_log.metadata.reason).toContain("[birth_date_redacted]");
    expect(JSON.stringify(reveal.audit_log)).not.toContain(chartBody.birth_profile.birth_date);
    expect(JSON.stringify(reveal.audit_log)).not.toContain(chartBody.birth_profile.birth_time);
    expect(JSON.stringify(reveal.audit_log)).not.toContain(chartBody.birth_profile.location.name);
    expect(auditLogs.logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          audit_log_id: reveal.audit_log.audit_log_id,
          action: "ops_sensitive_record_revealed",
          target_type: "chart",
          target_id: chart.chart_id
        })
      ])
    );
    expect(overview.modules).toMatchObject({
      users: expect.any(Number),
      charts: expect.any(Number),
      reports: expect.any(Number),
      orders: expect.any(Number),
      payment_events: expect.any(Number),
      entitlements: expect.any(Number),
      support_tickets: expect.any(Number),
      data_deletion_requests: expect.any(Number),
      feedback: expect.any(Number),
      content_rules: expect.any(Number),
      content_reviews: expect.any(Number),
      shares: expect.any(Number),
      system_logs: expect.any(Number),
      admin_audit_logs: expect.any(Number)
    });
    expect(overviewAfterAudit.modules.admin_audit_logs).toBeGreaterThanOrEqual(1);
    expect(overview.privacy.sensitive_fields_masked).toBe(true);
    expect(JSON.stringify({ ticket, list, refund, updateTicket, dashboard, contentReviews, opsUsers, opsReports, opsShares })).not.toContain("2000-08-16");
    expect(JSON.stringify({ ticket, list, refund, updateTicket, dashboard, contentReviews, opsUsers, opsReports, opsShares })).not.toContain("03:30");
    expect(JSON.stringify({ ticket, list, refund, updateTicket, dashboard, contentReviews, opsUsers, opsReports, opsShares })).not.toContain("Shanghai");
    expect(ticket.member_id).toBe(order.member_id);
    expect(ticket.report_id).toBe(order.report_id);
    expect(JSON.stringify(ticket)).not.toContain("member_spoofed_by_ops_client");
  });

  test("creates ops support tickets from order ownership instead of client-supplied subject", async () => {
    const memberHeaders = { "x-member-id": "member_ops_ticket_owner" };
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
          consent
        })
      })
    );
    const order = await orderResponse.json();
    const ticketResponse = await opsSupportTicketPost(
      new Request(`http://local/api/ops/order/${order.order_id}/support-ticket`, {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({
          member_id: "member_attacker",
          order_id: "order_attacker",
          report_id: "report_attacker",
          category: "refund_request",
          priority: "high",
          subject: "Refund route request",
          message: "Refund request with no raw birth data.",
          consent: { agreed: true, no_sensitive_birth_data: true }
        })
      }),
      { params: Promise.resolve({ id: order.order_id }) }
    );
    const ticket = await ticketResponse.json();

    expect(ticketResponse.status).toBe(201);
    expect(ticket.member_id).toBe("member_ops_ticket_owner");
    expect(ticket.order_id).toBe(order.order_id);
    expect(ticket.report_id).toBe(draft.report_id);
    expect(ticket.audit_trail).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "ops_support_ticket_created",
          actor_role: "ops_admin"
        })
      ])
    );
    expect(JSON.stringify(ticket)).not.toContain("member_attacker");
    expect(JSON.stringify(ticket)).not.toContain("order_attacker");
    expect(JSON.stringify(ticket)).not.toContain("report_attacker");
  });

  test("imports provider statements from CSV aliases without exposing raw provider references", async () => {
    const csv = [
      "transaction_id,out_trade_no,out_refund_no,type,total_amount,success_time,memo",
      "ali_csv_payment,order_csv_alias,,payment,49.00,2026-06-10 10:11:12,openid_2000-08-16_03:30_Shanghai",
      "ali_csv_refund,,refund_csv_alias,refund,19.00,2026-06-10 10:12:13,refund memo"
    ].join("\n");

    const response = await opsReconciliationImportPost(
      new Request("http://local/api/ops/reconciliation/import", {
        method: "POST",
        headers: {
          ...adminHeaders,
          "x-admin-actor": "ops_csv_route"
        },
        body: JSON.stringify({
          provider: "alipay_reserved",
          statement_id: "statement_csv_alias_route",
          period_start: "2026-06-10",
          period_end: "2026-06-10",
          csv
        })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.statement).toMatchObject({
      statement_id: "statement_csv_alias_route",
      provider: "alipay_reserved",
      row_count: 2,
      imported_by: "ops:ops_admin"
    });
    expect(body.statement.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider_transaction_id: "ali_csv_payment",
          order_id: "order_csv_alias",
          type: "payment",
          amount_cents: 4900,
          occurred_at: "2026-06-10T10:11:12.000Z"
        }),
        expect.objectContaining({
          provider_transaction_id: "ali_csv_refund",
          refund_id: "refund_csv_alias",
          type: "refund",
          amount_cents: 1900,
          occurred_at: "2026-06-10T10:12:13.000Z"
        })
      ])
    );
    expect(body.statement.rows[0].raw_reference_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(body)).not.toMatch(/2000-08-16|03:30|Shanghai|openid/);
  });

  test("previews provider statements from CSV aliases without persisting statements", async () => {
    const beforeResponse = await opsReconciliationGet(
      new Request("http://local/api/ops/reconciliation", {
        headers: adminHeaders
      })
    );
    const before = await beforeResponse.json();
    const csv = [
      "transaction_id,out_trade_no,type,total_amount,success_time,memo",
      "wx_preview_orphan,order_preview_missing,payment,88.00,2026-06-12 10:11:12,openid_2000-08-16_03:30_Shanghai"
    ].join("\n");

    const response = await opsReconciliationPreviewPost(
      new Request("http://local/api/ops/reconciliation/preview", {
        method: "POST",
        headers: {
          ...adminHeaders,
          "x-admin-actor": "ops_preview_route"
        },
        body: JSON.stringify({
          provider: "wechat_pay_reserved",
          statement_id: "statement_preview_route",
          period_start: "2026-06-12",
          period_end: "2026-06-12",
          csv
        })
      })
    );
    const body = await response.json();
    const afterResponse = await opsReconciliationGet(
      new Request("http://local/api/ops/reconciliation", {
        headers: adminHeaders
      })
    );
    const after = await afterResponse.json();

    expect(response.status).toBe(200);
    expect(body.statement).toMatchObject({
      statement_id: "statement_preview_route",
      provider: "wechat_pay_reserved",
      row_count: 1,
      imported_by: "ops:ops_admin"
    });
    expect(body.reconciliation.orphan_provider_row_count).toBe(1);
    expect(body.reconciliation.alerts).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "PROVIDER_STATEMENT_ORPHAN_ROWS" })])
    );
    expect(after.provider_statements.summary.statement_count).toBe(before.provider_statements.summary.statement_count);
    expect(JSON.stringify(body)).not.toMatch(/2000-08-16|03:30|Shanghai|openid/);
  });

  test("manages rule versions through protected ops route handlers", async () => {
    const listResponse = await opsRuleProfilesGet(
      new Request("http://local/api/ops/rule-profiles", {
        headers: {
          "x-admin-token": "phase10_admin_token",
          "x-admin-role": "content_reviewer",
          "x-admin-actor": "route_rule_reviewer"
        }
      })
    );
    const listBody = await listResponse.json();
    const deniedResponse = await opsRuleProfileDefaultPost(
      new Request("http://local/api/ops/rule-profiles/default", {
        method: "POST",
        headers: {
          ...adminHeaders,
          "x-admin-actor": "route_rule_admin"
        },
        body: JSON.stringify({
          profile_id: "default_ziwei_v0_1",
          reason: "missing second confirmation"
        })
      })
    );
    const deniedBody = await deniedResponse.json();
    const experimentalResponse = await opsRuleProfileDefaultPost(
      new Request("http://local/api/ops/rule-profiles/default", {
        method: "POST",
        headers: {
          ...adminHeaders,
          "x-admin-actor": "route_rule_admin"
        },
        body: JSON.stringify({
          profile_id: "experimental_sanhe_v0_1",
          reason: "candidate review for 2000-08-16 03:30 Shanghai",
          second_confirmed: true
        })
      })
    );
    const experimentalBody = await experimentalResponse.json();
    const promoteResponse = await opsRuleProfileDefaultPost(
      new Request("http://local/api/ops/rule-profiles/default", {
        method: "POST",
        headers: {
          ...adminHeaders,
          "x-admin-actor": "route_rule_admin"
        },
        body: JSON.stringify({
          profile_id: "default_ziwei_v0_1",
          reason: "confirmed baseline remains default after 2000-08-16 03:30 Shanghai review",
          second_confirmed: true
        })
      })
    );
    const promoted = await promoteResponse.json();
    const auditResponse = await opsAuditLogsGet(
      new Request("http://local/api/ops/audit-logs", {
        headers: adminHeaders
      })
    );
    const audit = await auditResponse.json();

    expect(listResponse.status).toBe(200);
    expect(listBody.active_default_profile_id).toBe("default_ziwei_v0_1");
    expect(listBody.profiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          profile_id: "default_ziwei_v0_1",
          version_id: "rules_v0.2",
          is_active_default: true,
          can_promote_to_default: true
        })
      ])
    );
    expect(deniedResponse.status).toBe(400);
    expect(deniedBody.error.code).toBe("OPS_RULE_PROFILE_SECOND_CONFIRM_REQUIRED");
    expect(experimentalResponse.status).toBe(409);
    expect(experimentalBody.error.code).toBe("RULE_PROFILE_NOT_APPROVED");
    expect(promoteResponse.status).toBe(200);
    expect(promoted.active_default_profile_id).toBe("default_ziwei_v0_1");
    expect(promoted.audit_log.action).toBe("ops_rule_profile_promoted");
    expect(promoted.audit_log.metadata.reason).toContain("[birth_date_redacted]");
    expect(audit.logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "ops_rule_profile_promoted",
          actor_id: "ops:ops_admin",
          target_type: "rule_profile"
        })
      ])
    );
    expect(JSON.stringify({ listBody, deniedBody, experimentalBody, promoted, audit })).not.toMatch(/2000-08-16|03:30|Shanghai|openid|prompt body|report body/i);
  });

  test("binds public support tickets to the current server-resolved identity", async () => {
    const missingIdentityResponse = await supportTicketPost(
      new Request("http://local/api/support/ticket", {
        method: "POST",
        body: JSON.stringify({
          category: "general",
          priority: "normal",
          subject: "Need help",
          message: "I need help with my report.",
          consent: { agreed: true, no_sensitive_birth_data: true }
        })
      })
    );
    const missingIdentity = await missingIdentityResponse.json();

    const spoofResponse = await supportTicketPost(
      new Request("http://local/api/support/ticket", {
        method: "POST",
        headers: {
          "x-member-id": "member_real_support",
          "x-visitor-id": "visitor_real_support"
        },
        body: JSON.stringify({
          member_id: "member_other_support",
          category: "general",
          priority: "normal",
          subject: "Need help",
          message: "I need help with my report.",
          consent: { agreed: true, no_sensitive_birth_data: true }
        })
      })
    );
    const spoofed = await spoofResponse.json();

    const createdResponse = await supportTicketPost(
      new Request("http://local/api/support/ticket", {
        method: "POST",
        headers: {
          "x-member-id": "member_real_support",
          "x-visitor-id": "visitor_real_support"
        },
        body: JSON.stringify({
          category: "general",
          priority: "normal",
          subject: "Need help",
          message: "I need help with my report.",
          consent: { agreed: true, no_sensitive_birth_data: true }
        })
      })
    );
    const created = await createdResponse.json();

    expect(missingIdentityResponse.status).toBe(401);
    expect(missingIdentity.error).toMatchObject({ code: "SUPPORT_IDENTITY_REQUIRED", field: "session" });
    expect(spoofResponse.status).toBe(403);
    expect(spoofed.error).toMatchObject({ code: "SUPPORT_SUBJECT_FORBIDDEN", field: "member_id" });
    expect(createdResponse.status).toBe(201);
    expect(created.member_id).toBe("member_real_support");
    expect(JSON.stringify(created)).not.toContain("member_other_support");
  });

  test("applies support ticket subject binding in the shared API dispatcher", () => {
    const missingIdentity = handleApiRequest("POST", "/api/support/ticket", {
      category: "general",
      priority: "normal",
      subject: "Need help",
      message: "I need help with my report.",
      consent: { agreed: true, no_sensitive_birth_data: true }
    });
    const spoofed = handleApiRequest(
      "POST",
      "/api/support/ticket",
      {
        member_id: "member_other_support",
        category: "general",
        priority: "normal",
        subject: "Need help",
        message: "I need help with my report.",
        consent: { agreed: true, no_sensitive_birth_data: true }
      },
      {
        identity: {
          memberId: "member_api_support",
          visitorId: "visitor_api_support"
        }
      }
    );

    expect(missingIdentity.status).toBe(401);
    expect(missingIdentity.body.error).toMatchObject({ code: "SUPPORT_IDENTITY_REQUIRED", field: "session" });
    expect(spoofed.status).toBe(403);
    expect(spoofed.body.error).toMatchObject({ code: "SUPPORT_SUBJECT_FORBIDDEN", field: "member_id" });
  });

  test("blocks ops routes without admin authorization", async () => {
    const response = await opsOrdersGet(new Request("http://local/api/ops/orders"));
    const body = await response.json();
    const overviewResponse = await opsOverviewGet(new Request("http://local/api/ops/overview"));
    const overview = await overviewResponse.json();
    const contentReviewsResponse = await opsContentReviewsGet(new Request("http://local/api/ops/content-reviews"));
    const contentReviews = await contentReviewsResponse.json();
    const usersResponse = await opsUsersGet(new Request("http://local/api/ops/users"));
    const users = await usersResponse.json();
    const reportsResponse = await opsReportsGet(new Request("http://local/api/ops/reports"));
    const reports = await reportsResponse.json();
    const sharesResponse = await opsSharesGet(new Request("http://local/api/ops/shares"));
    const shares = await sharesResponse.json();

    expect(response.status).toBe(401);
    expect(body.error).toMatchObject({ code: "OPS_AUTH_REQUIRED" });
    expect(overviewResponse.status).toBe(401);
    expect(overview.error).toMatchObject({ code: "OPS_AUTH_REQUIRED" });
    expect(contentReviewsResponse.status).toBe(401);
    expect(contentReviews.error).toMatchObject({ code: "OPS_AUTH_REQUIRED" });
    expect(usersResponse.status).toBe(401);
    expect(users.error).toMatchObject({ code: "OPS_AUTH_REQUIRED" });
    expect(reportsResponse.status).toBe(401);
    expect(reports.error).toMatchObject({ code: "OPS_AUTH_REQUIRED" });
    expect(sharesResponse.status).toBe(401);
    expect(shares.error).toMatchObject({ code: "OPS_AUTH_REQUIRED" });
  });

  test("requires x-admin-mfa-code on ops route handlers when MFA is enabled", async () => {
    await withOpsMfaEnv({ enabled: "true", code: "654321" }, async () => {
      const deniedResponse = await opsOverviewGet(
        new Request("http://local/api/ops/overview", {
          headers: adminHeaders
        })
      );
      const denied = await deniedResponse.json();
      const allowedResponse = await opsOverviewGet(
        new Request("http://local/api/ops/overview", {
          headers: adminHeadersWithMfa
        })
      );
      const allowed = await allowedResponse.json();

      expect(deniedResponse.status).toBe(403);
      expect(denied.error).toMatchObject({ code: "OPS_MFA_REQUIRED", field: "x-admin-mfa-code" });
      expect(allowedResponse.status).toBe(200);
      expect(allowed.privacy.admin_required).toBe(true);
    });
  });
});
