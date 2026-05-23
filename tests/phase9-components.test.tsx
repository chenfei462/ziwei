// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CommercePanel } from "../src/components/phase9/CommercePanel.js";
import type { CheckoutSession, MemberEntitlement, Order, PaymentEvent, ReportDraft } from "../src/types.js";

const draft = {
  report_id: "report_component_phase9",
  report_type: "single_chart",
  mode: "professional",
  template_id: "single_chart_six_palaces",
  template_version: "v0.1",
  title: "Single chart six-palace report",
  created_at: "2026-04-30T00:00:00.000Z",
  sections: [],
  creator_assets: [],
  review: {
    review_id: "review_component_phase9",
    report_id: "report_component_phase9",
    status: "approved",
    blocked_terms: [],
    privacy_flags: [],
    safety_flags: ["avoid_absolute_prediction"],
    checked_at: "2026-04-30T00:00:00.000Z",
    notes: ["approved"]
  },
  privacy_note: "full birth date, birth time, and location detail hidden by default.",
  safety_flags: ["avoid_absolute_prediction"],
  price_tier_hint: "standard_49"
} satisfies ReportDraft;

const order = {
  order_id: "order_component_phase9",
  report_id: draft.report_id,
  member_id: "member_component",
  package_id: "single_report",
  tier_id: "standard_49",
  report_type: "single_chart",
  amount_cents: 4900,
  currency: "cny",
  status: "draft",
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
} satisfies Order;

const checkout = {
  checkout_session_id: "cs_component_phase9",
  order_id: order.order_id,
  provider: "stripe_checkout",
  provider_mode: "sandbox",
  checkout_url: "/commercial/checkout-sandbox?session_id=cs_component_phase9",
  status: "open",
  created_at: "2026-04-30T00:00:00.000Z",
  expires_at: "2026-05-01T00:00:00.000Z",
  sandbox_webhook: {
    raw_body: "{\"event_id\":\"evt_component_phase9\"}",
    signature_header: "t=1,v1=component"
  }
} satisfies CheckoutSession;

const paymentEvent = {
  payment_event_id: "evt_component_phase9",
  provider: "stripe_checkout",
  event_type: "checkout.session.completed",
  checkout_session_id: checkout.checkout_session_id,
  order_id: order.order_id,
  received_at: "2026-04-30T00:00:00.000Z",
  signature_verified: true,
  is_duplicate: false,
  order: { ...order, status: "fulfilled" }
} satisfies PaymentEvent;

const entitlement = {
  entitlement_id: "ent_component_phase9",
  member_id: "member_component",
  report_id: draft.report_id,
  source_order_id: order.order_id,
  has_access: true,
  can_read_report: true,
  export_preview_credits: 3,
  favorite_enabled: true,
  created_at: "2026-04-30T00:00:00.000Z",
  privacy_note: "full birth date, birth time, and location detail hidden by default.",
  report_snapshot: draft
} satisfies MemberEntitlement;

describe("phase 9 commerce panel UI", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("creates order, checkout session, sandbox payment, and shows entitlement", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => order } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => checkout } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => paymentEvent } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => entitlement } as Response);

    render(<CommercePanel initialReport={draft} memberId="member_component" />);

    expect(screen.getByRole("heading", { name: "Commerce MVP" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create order" }));
    await waitFor(() => expect(screen.getByText("draft")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Create checkout session" }));
    await waitFor(() => expect(screen.getByText("stripe_checkout")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Simulate sandbox payment" }));
    await waitFor(() => expect(screen.getByText("fulfilled")).toBeInTheDocument());
    expect(screen.getByText("Access granted")).toBeInTheDocument();
    expect(screen.queryByText("2000-08-16")).not.toBeInTheDocument();
    expect(screen.queryByText("03:30")).not.toBeInTheDocument();
    expect(screen.queryByText("Shanghai")).not.toBeInTheDocument();
  });
});
