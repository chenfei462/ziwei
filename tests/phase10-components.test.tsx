// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LaunchOpsPanel } from "../src/components/phase10/LaunchOpsPanel.js";
import type { LaunchOperationsDashboard, OpsOrderListResponse, OpsRefundResponse, SupportTicket } from "../src/types.js";

const orders = {
  orders: [
    {
      order_id: "order_phase10_component",
      report_id: "report_phase10_component",
      member_id: "member_component",
      package_id: "single_report",
      tier_id: "standard_49",
      report_type: "single_chart",
      amount_cents: 4900,
      currency: "cny",
      status: "fulfilled",
      payment_provider: "stripe_checkout",
      created_at: "2026-04-30T00:00:00.000Z",
      updated_at: "2026-04-30T00:00:00.000Z",
      compliance: {
        service_terms_accepted: true,
        privacy_policy_accepted: true,
        refund_policy_accepted: true,
        cultural_entertainment_only: true
      },
      privacy: {
        stores_full_birth_date: false,
        stores_birth_time: false,
        stores_location_detail: false,
        stores_video_frame: false
      }
    }
  ],
  filters: { status: "fulfilled" },
  privacy: {
    stores_full_birth_date: false,
    stores_birth_time: false,
    stores_location_detail: false,
    stores_video_frame: false
  }
} satisfies OpsOrderListResponse;

const ticket = {
  ticket_id: "ticket_phase10_component",
  member_id: "member_component",
  order_id: "order_phase10_component",
  report_id: "report_phase10_component",
  category: "refund_request",
  priority: "high",
  status: "open",
  subject: "Refund request",
  message: "Refund request for [birth_date_redacted]",
  created_at: "2026-04-30T00:00:00.000Z",
  updated_at: "2026-04-30T00:00:00.000Z",
  consent: {
    agreed: true,
    no_sensitive_birth_data: true
  },
  audit_trail: []
} satisfies SupportTicket;

const refund = {
  order: { ...orders.orders[0], status: "refunded_manual", refunded_at: "2026-04-30T00:01:00.000Z" },
  note: {
    note_id: "note_phase10_component",
    order_id: "order_phase10_component",
    ticket_id: ticket.ticket_id,
    action: "manual_refund_marked",
    note: "manual refund",
    actor_role: "ops_admin",
    created_at: "2026-04-30T00:01:00.000Z"
  },
  privacy: orders.privacy
} satisfies OpsRefundResponse;

const dashboard = {
  launch_config: {
    provider: "stripe_checkout",
    provider_mode: "sandbox",
    production_payment_enabled: false,
    rollout_percent: 0,
    rollback_enabled: false,
    webhook_secret_configured: true,
    max_production_amount_cents: 9900,
    public_status: "sandbox_only"
  },
  orders: {
    total_orders: 1,
    pending_orders: 0,
    paid_orders: 0,
    fulfilled_orders: 0,
    failed_orders: 0,
    refunded_manual_orders: 1,
    payment_conversion_rate: 1,
    average_order_value_cents: 4900,
    report_type_counts: { single_chart: 1, synastry: 0, timeline: 0 },
    content_review_block_rate: 0,
    payment_provider_counts: { stripe_checkout: 1, wechat_pay_reserved: 0, alipay_reserved: 0 },
    privacy: orders.privacy
  },
  risk: {
    payment_failure_rate: 0,
    refund_rate: 1,
    webhook_exception_count: 0,
    content_review_block_rate: 0,
    privacy_scan_violations: 0,
    unauthorized_access_attempts: 0
  },
  support: {
    total_tickets: 1,
    open_tickets: 0,
    resolved_tickets: 1,
    high_priority_tickets: 1,
    refund_request_tickets: 1,
    privacy_deletion_tickets: 0,
    sla_attention_required: 0
  },
  growth: {
    chart_to_purchase: 0,
    preview_to_payment: 0,
    payment_to_revisit: 0,
    entitlement_usage: 0,
    share_to_purchase: 0,
    repeat_purchase_intent: 0
  },
  privacy: orders.privacy
} satisfies LaunchOperationsDashboard;

describe("phase 10 launch ops panel", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("loads ops orders, creates support ticket, marks manual refund, and refreshes dashboard", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => orders } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ticket } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => refund } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...ticket, status: "resolved" }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => dashboard } as Response);

    render(<LaunchOpsPanel initialDashboard={dashboard} />);

    await waitFor(() => expect(screen.getAllByText("order_phase10_component").length).toBeGreaterThanOrEqual(1));
    fireEvent.change(screen.getByLabelText("Support message"), {
      target: { value: "Refund request for 2000-08-16 03:30 Shanghai" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create support ticket" }));
    await waitFor(() => expect(screen.getByText("ticket_phase10_component")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Mark manual refund" }));
    await waitFor(() => expect(screen.getAllByText("refunded_manual").length).toBeGreaterThanOrEqual(1));
    expect(screen.getByText("refund_rate 100%")).toBeInTheDocument();
    expect(screen.getByText("resolved")).toBeInTheDocument();
    expect(screen.queryByText("2000-08-16")).not.toBeInTheDocument();
    expect(screen.queryByText("03:30")).not.toBeInTheDocument();
    expect(screen.queryByText("Shanghai")).not.toBeInTheDocument();
  });
});
