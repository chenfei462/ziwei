import { describe, expect, test } from "vitest";
import { createChart } from "../src/chartEngine.js";
import { createReportDraft } from "../src/phase8/reporting.js";
import { createCheckoutSession, createOrder, processPaymentWebhook } from "../src/phase9/commerce.js";
import {
  createSupportTicket,
  evaluatePaymentLaunchGate,
  getLaunchOperationsDashboard,
  listOpsOrders,
  markOpsManualRefund,
  recordGrowthEvent,
  resolveLaunchPaymentConfig,
  updateSupportTicket
} from "../src/phase10/launchOps.js";

const birthProfile = {
  display_name: "Phase 10 buyer",
  calendar_type: "gregorian" as const,
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
  gender_rule: "traditional_male" as const
};

const consent = {
  agreed: true,
  service_terms: true,
  privacy_policy: true,
  refund_policy: true,
  cultural_entertainment_only: true
} as const;

const adminAuth = {
  token: "phase10_admin_token",
  role: "ops_admin" as const
};

function createFulfilledOrder(memberId = "member_phase10") {
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
    consent
  });
  const checkout = createCheckoutSession({
    order_id: order.order_id,
    provider: "stripe_checkout",
    success_url: "http://localhost:3000/commercial/success",
    cancel_url: "http://localhost:3000/commercial/cancel"
  });
  processPaymentWebhook({
    provider: "stripe_checkout",
    raw_body: checkout.sandbox_webhook?.raw_body ?? "",
    signature: checkout.sandbox_webhook?.signature_header ?? ""
  });
  return { draft, order };
}

describe("phase 10 launch operations core", () => {
  test("requires a production payment switch, rollout allowance, and rollback-off state", () => {
    const disabled = resolveLaunchPaymentConfig({
      stripe_secret_key: "sk_live_phase10",
      webhook_secret_configured: true,
      production_payment_enabled: false,
      rollout_percent: 100,
      rollback_enabled: false
    });
    const blockedByRollout = evaluatePaymentLaunchGate({
      member_id: "member_a",
      amount_cents: 4900,
      config: { ...disabled, production_payment_enabled: true, rollout_percent: 0 }
    });
    const blockedByRollback = evaluatePaymentLaunchGate({
      member_id: "member_a",
      amount_cents: 4900,
      config: { ...disabled, production_payment_enabled: true, rollout_percent: 100, rollback_enabled: true }
    });
    const allowed = evaluatePaymentLaunchGate({
      member_id: "member_a",
      amount_cents: 4900,
      config: { ...disabled, production_payment_enabled: true, rollout_percent: 100, rollback_enabled: false }
    });

    expect(disabled.provider_mode).toBe("sandbox");
    expect(blockedByRollout.allowed).toBe(false);
    expect(blockedByRollout.reason).toBe("outside_rollout");
    expect(blockedByRollback.allowed).toBe(false);
    expect(blockedByRollback.reason).toBe("rollback_enabled");
    expect(allowed.allowed).toBe(true);
    expect(allowed.reason).toBe("production_allowed");
  });

  test("lists sanitized ops orders and supports manual refund marking with an audit note", () => {
    const { draft, order } = createFulfilledOrder("member_ops_refund");

    const before = listOpsOrders({
      auth: adminAuth,
      status: "fulfilled"
    });
    const refunded = markOpsManualRefund({
      auth: adminAuth,
      order_id: order.order_id,
      reason: "customer requested duplicate purchase refund for 2000-08-16 03:30 Shanghai",
      ticket_id: "ticket_manual_phase10"
    });
    const after = listOpsOrders({
      auth: adminAuth,
      status: "refunded_manual"
    });

    expect(before.orders.map((item) => item.order_id)).toContain(order.order_id);
    expect(refunded.order.status).toBe("refunded_manual");
    expect(refunded.note.action).toBe("manual_refund_marked");
    expect(refunded.note.note).toContain("[birth_date_redacted]");
    expect(refunded.note.note).toContain("[birth_time_redacted]");
    expect(refunded.note.note).toContain("[location_redacted]");
    expect(after.orders.map((item) => item.report_id)).toContain(draft.report_id);
    expect(JSON.stringify({ before, refunded, after })).not.toContain("2000-08-16");
    expect(JSON.stringify({ before, refunded, after })).not.toContain("03:30");
    expect(JSON.stringify({ before, refunded, after })).not.toContain("Shanghai");
  });

  test("creates and resolves sanitized support tickets and summarizes launch risk metrics", () => {
    const { draft, order } = createFulfilledOrder("member_support_ticket");
    const ticket = createSupportTicket({
      member_id: "member_support_ticket",
      order_id: order.order_id,
      report_id: draft.report_id,
      category: "refund_request",
      priority: "high",
      subject: "Refund request",
      message: "Please refund this report for 2000-08-16 03:30 Shanghai.",
      consent: {
        agreed: true,
        no_sensitive_birth_data: true
      }
    });
    const updated = updateSupportTicket({
      auth: adminAuth,
      ticket_id: ticket.ticket_id,
      status: "resolved",
      assignee: "ops_lead",
      note: "Resolved after manual support review."
    });
    recordGrowthEvent({
      type: "payment_to_revisit",
      member_id: "member_support_ticket",
      report_id: draft.report_id,
      order_id: order.order_id,
      value_cents: 4900
    });
    const dashboard = getLaunchOperationsDashboard({ auth: adminAuth });

    expect(ticket.status).toBe("open");
    expect(ticket.message).toContain("[birth_date_redacted]");
    expect(updated.status).toBe("resolved");
    expect(updated.audit_trail.at(-1)?.action).toBe("support_ticket_resolved");
    expect(dashboard.support.open_tickets).toBeGreaterThanOrEqual(0);
    expect(dashboard.support.resolved_tickets).toBeGreaterThanOrEqual(1);
    expect(dashboard.growth.payment_to_revisit).toBeGreaterThanOrEqual(1);
    expect(dashboard.risk.privacy_scan_violations).toBe(0);
    expect(JSON.stringify({ ticket, updated, dashboard })).not.toContain("2000-08-16");
    expect(JSON.stringify({ ticket, updated, dashboard })).not.toContain("03:30");
    expect(JSON.stringify({ ticket, updated, dashboard })).not.toContain("Shanghai");
  });

  test("rejects unauthorized ops access", () => {
    expect(() =>
      listOpsOrders({
        auth: { token: "wrong", role: "support_agent" }
      })
    ).toThrow(/not authorized/i);
  });
});
