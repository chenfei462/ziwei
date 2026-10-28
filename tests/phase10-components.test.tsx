// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LaunchOpsPanel } from "../src/components/phase10/LaunchOpsPanel.js";
import type {
  AdminAuditLog,
  LaunchOperationsDashboard,
  OpsAdminAuditListResponse,
  OpsOrderListResponse,
  OpsRuleProfileListResponse,
  OpsRuleProfilePromotionResponse,
  OpsRefundResponse,
  OpsSensitiveRecordRevealResponse,
  SupportTicket
} from "../src/types.js";

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
  order: { ...orders.orders[0], status: "refunded", refunded_at: "2026-04-30T00:01:00.000Z" },
  refund: {
    refund_id: "refund_phase10_component",
    order_id: "order_phase10_component",
    provider: "stripe_checkout",
    amount_cents: orders.orders[0].amount_cents,
    status: "succeeded",
    reason: "manual refund",
    requested_by: "ops_admin",
    ticket_id: ticket.ticket_id,
    created_at: "2026-04-30T00:01:00.000Z",
    updated_at: "2026-04-30T00:01:00.000Z",
    privacy_note: "Refund record keeps provider ids and reasons but no raw birth data."
  },
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
    cancelled_orders: 0,
    refunded_orders: 1,
    partially_refunded_orders: 0,
    refunded_manual_orders: 1,
    payment_conversion_rate: 1,
    average_order_value_cents: 4900,
    report_type_counts: { single_chart: 1, synastry: 0, timeline: 0 },
    content_review_block_rate: 0,
    payment_provider_counts: { stripe_checkout: 1, mock_checkout: 0, wechat_pay_reserved: 0, alipay_reserved: 0 },
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

const auditLog = {
  audit_log_id: "audit_phase10_component",
  actor_id: "ops_privacy_component",
  actor_role: "ops_admin",
  action: "ops_sensitive_record_revealed",
  target_type: "order",
  target_id: "order_phase10_component",
  metadata: {
    reason: "privacy review for [birth_date_redacted] [birth_time_redacted] [location_redacted]",
    second_confirmed: true,
    ticket_id: "ticket_phase10_component"
  },
  created_at: "2026-04-30T00:02:00.000Z",
  privacy_note: "Admin audit logs store actor, action, target, and redacted metadata only."
} satisfies AdminAuditLog;

const auditLogs = {
  logs: [auditLog],
  privacy: {
    metadata_redacted: true,
    admin_required: true,
    raw_birth_data_hidden: true
  }
} satisfies OpsAdminAuditListResponse;

const revealPayload = {
  record_type: "order",
  record_id: "order_phase10_component",
  record: {
    order_id: "order_phase10_component",
    status: "fulfilled",
    sensitive_birth_review: "2000-08-16 03:30 Shanghai"
  },
  audit_log: {
    ...auditLog,
    audit_log_id: "audit_phase10_component_after_reveal"
  },
  privacy: {
    sensitive_fields_visible: true,
    admin_only: true,
    requires_second_confirmation: true,
    audit_logged: true,
    raw_birth_profile_decryption_available: false
  }
} satisfies OpsSensitiveRecordRevealResponse;

const ruleProfiles = {
  active_default_profile_id: "default_ziwei_v0_1",
  profiles: [
    {
      profile_id: "default_ziwei_v0_1",
      label: "Default Zi Wei v0.1",
      description: "Consultant confirmed production baseline.",
      version_id: "rules_v0.2",
      version_label: "Rule table v0.2",
      released_at: "2026-04-30",
      source: "phase 0-10 baseline",
      consultant_review_status: "confirmed",
      is_active_default: true,
      can_promote_to_default: true,
      risk_note: "Production baseline.",
      supported_features: ["chart", "report"],
      safety_flags: ["avoid_absolute_prediction"],
      rule_config_summary: {
        school_id: "default_ziwei_v0_1",
        zi_hour_day_boundary: "civil_midnight",
        leap_month_policy: "same_month_number",
        true_solar_time_policy: "disabled",
        four_transform_policy: "default_stem",
        interpretation_style: "balanced_modern"
      }
    },
    {
      profile_id: "experimental_sanhe_v0_1",
      label: "Experimental Sanhe v0.1",
      description: "Comparison-only candidate.",
      version_id: "rules_v0.2-exp",
      version_label: "Experimental comparison profile",
      released_at: "2026-04-30",
      source: "phase 11 candidate",
      consultant_review_status: "experimental",
      is_active_default: false,
      can_promote_to_default: false,
      risk_note: "Candidate profile cannot become default yet.",
      supported_features: ["chart_compare"],
      safety_flags: ["consultant_review_required"],
      rule_config_summary: {
        school_id: "experimental_sanhe_v0_1",
        zi_hour_day_boundary: "late_zi_next_day",
        leap_month_policy: "split_leap_month",
        true_solar_time_policy: "optional",
        four_transform_policy: "experimental_stem_variant",
        interpretation_style: "classical_source_first"
      }
    }
  ],
  privacy: {
    admin_required: true,
    raw_birth_data_hidden: true,
    report_body_hidden: true,
    prompt_body_hidden: true,
    rule_config_visible: true
  }
} satisfies OpsRuleProfileListResponse;

const rulePromotion = {
  previous_default_profile_id: "default_ziwei_v0_1",
  active_default_profile_id: "default_ziwei_v0_1",
  promoted_profile: ruleProfiles.profiles[0],
  audit_log: {
    audit_log_id: "audit_rule_profile_component",
    actor_id: "ops_rule_component",
    actor_role: "ops_admin",
    action: "ops_rule_profile_promoted",
    target_type: "rule_profile",
    target_id: "default_ziwei_v0_1",
    metadata: {
      profile_id: "default_ziwei_v0_1",
      version_id: "rules_v0.2",
      reason: "confirmed after [birth_date_redacted] [birth_time_redacted] [location_redacted]",
      second_confirmed: true
    },
    created_at: "2026-04-30T00:03:00.000Z",
    privacy_note: "Admin audit logs store actor, action, target, and redacted metadata only."
  },
  privacy: {
    admin_required: true,
    requires_second_confirmation: true,
    audit_logged: true,
    raw_birth_data_hidden: true,
    report_body_hidden: true,
    prompt_body_hidden: true
  }
} satisfies OpsRuleProfilePromotionResponse;

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
    expect(vi.mocked(globalThis.fetch).mock.calls[1]?.[0]).toBe("/api/ops/order/order_phase10_component/support-ticket");
    const ticketRequest = vi.mocked(globalThis.fetch).mock.calls[1]?.[1] as RequestInit;
    expect(ticketRequest.headers).toEqual({ "content-type": "application/json" });
    expect(ticketRequest.body ? JSON.parse(String(ticketRequest.body)) : {}).not.toMatchObject({
      member_id: expect.any(String),
      order_id: expect.any(String),
      report_id: expect.any(String)
    });

    fireEvent.click(screen.getByRole("button", { name: "Mark manual refund" }));
    await waitFor(() => expect(screen.getAllByText("refunded").length).toBeGreaterThanOrEqual(1));
    expect(screen.getByText("refund_rate 100%")).toBeInTheDocument();
    expect(screen.getByText("resolved")).toBeInTheDocument();
    expect(vi.mocked(globalThis.fetch).mock.calls[4]?.[0]).toBe("/api/ops/launch/dashboard");
    expect(screen.queryByText("2000-08-16")).not.toBeInTheDocument();
    expect(screen.queryByText("03:30")).not.toBeInTheDocument();
    expect(screen.queryByText("Shanghai")).not.toBeInTheDocument();
  });

  test("loads admin audit logs and reveals sensitive records only with second confirmation", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => orders } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => auditLogs } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => revealPayload } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...auditLogs, logs: [revealPayload.audit_log, auditLog] }) } as Response);

    render(<LaunchOpsPanel initialDashboard={dashboard} />);

    await waitFor(() => expect(screen.getAllByText("order_phase10_component").length).toBeGreaterThanOrEqual(1));
    fireEvent.click(screen.getByRole("button", { name: "Load audit logs" }));
    await waitFor(() => expect(screen.getByText("audit_phase10_component")).toBeInTheDocument());
    expect(screen.getByText(/birth_date_redacted/)).toBeInTheDocument();
    expect(screen.queryByText("2000-08-16")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Sensitive record type"), { target: { value: "order" } });
    fireEvent.change(screen.getByLabelText("Sensitive record ID"), { target: { value: "order_phase10_component" } });
    fireEvent.change(screen.getByLabelText("Reveal reason"), {
      target: { value: "privacy review for 2000-08-16 03:30 Shanghai" }
    });
    fireEvent.change(screen.getByLabelText("Support ticket ID"), { target: { value: "ticket_phase10_component" } });
    fireEvent.click(screen.getByLabelText("Second confirmation"));
    fireEvent.click(screen.getByRole("button", { name: "Reveal sensitive detail" }));

    await waitFor(() => expect(screen.getAllByText("audit_phase10_component_after_reveal").length).toBeGreaterThanOrEqual(1));
    expect(screen.getByText(/sensitive_birth_review/)).toBeInTheDocument();
    expect(screen.getAllByText(/2000-08-16/).length).toBeGreaterThanOrEqual(1);
    const revealRequest = vi.mocked(globalThis.fetch).mock.calls[2]?.[1] as RequestInit;
    expect(vi.mocked(globalThis.fetch).mock.calls[2]?.[0]).toBe("/api/ops/sensitive-record");
    expect(revealRequest.headers).toEqual({ "content-type": "application/json" });
    expect(revealRequest.body ? JSON.parse(String(revealRequest.body)) : {}).toMatchObject({
      record_type: "order",
      record_id: "order_phase10_component",
      reason: "privacy review for 2000-08-16 03:30 Shanghai",
      second_confirmed: true,
      ticket_id: "ticket_phase10_component"
    });
    expect(screen.getAllByText(/birth_date_redacted/).length).toBeGreaterThanOrEqual(1);
  });

  test("loads ops rule profiles and promotes the confirmed default with second confirmation", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => orders } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ruleProfiles } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => rulePromotion } as Response);

    render(<LaunchOpsPanel initialDashboard={dashboard} />);

    await waitFor(() => expect(screen.getAllByText("order_phase10_component").length).toBeGreaterThanOrEqual(1));
    fireEvent.click(screen.getByRole("button", { name: "Load rule profiles" }));
    await waitFor(() => expect(screen.getByText("rules_v0.2")).toBeInTheDocument());
    expect(screen.getByText("experimental")).toBeInTheDocument();
    expect(screen.getByText("blocked")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Rule profile"), { target: { value: "default_ziwei_v0_1" } });
    fireEvent.change(screen.getByLabelText("Promotion reason"), {
      target: { value: "confirmed after 2000-08-16 03:30 Shanghai review" }
    });
    fireEvent.click(screen.getByLabelText("Confirm rule promotion"));
    fireEvent.click(screen.getByRole("button", { name: "Promote rule default" }));

    await waitFor(() => expect(screen.getByText("audit_rule_profile_component")).toBeInTheDocument());
    expect(screen.getByText("ops_rule_profile_promoted")).toBeInTheDocument();
    expect(vi.mocked(globalThis.fetch).mock.calls[1]?.[0]).toBe("/api/ops/rule-profiles");
    expect(vi.mocked(globalThis.fetch).mock.calls[2]?.[0]).toBe("/api/ops/rule-profiles/default");
    const promoteRequest = vi.mocked(globalThis.fetch).mock.calls[2]?.[1] as RequestInit;
    expect(promoteRequest.headers).toEqual({ "content-type": "application/json" });
    expect(promoteRequest.body ? JSON.parse(String(promoteRequest.body)) : {}).toMatchObject({
      profile_id: "default_ziwei_v0_1",
      reason: "confirmed after 2000-08-16 03:30 Shanghai review",
      second_confirmed: true
    });
    expect(screen.queryByText("2000-08-16")).not.toBeInTheDocument();
    expect(screen.queryByText("03:30")).not.toBeInTheDocument();
    expect(screen.queryByText("Shanghai")).not.toBeInTheDocument();
  });
});
