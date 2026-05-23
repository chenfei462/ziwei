import { describe, expect, test } from "vitest";
import { createChart } from "../src/chartEngine.js";
import { createReportDraft } from "../src/phase8/reporting.js";
import {
  createCheckoutSession,
  createOrder,
  getCommercialDashboard,
  getMemberEntitlements,
  getReportEntitlement,
  processPaymentWebhook
} from "../src/phase9/commerce.js";

const birthProfile = {
  display_name: "Phase 9 buyer",
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

const requiredConsent = {
  agreed: true,
  service_terms: true,
  privacy_policy: true,
  refund_policy: true,
  cultural_entertainment_only: true
} as const;

describe("phase 9 commerce core", () => {
  test("creates an order, checkout session, signed payment event, entitlement, and dashboard summary", () => {
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
      member_id: "member_phase9",
      consent: requiredConsent
    });
    const session = createCheckoutSession({
      order_id: order.order_id,
      provider: "stripe_checkout",
      success_url: "http://localhost:3000/commercial/success",
      cancel_url: "http://localhost:3000/commercial/cancel"
    });
    const event = processPaymentWebhook({
      provider: "stripe_checkout",
      raw_body: session.sandbox_webhook?.raw_body ?? "",
      signature: session.sandbox_webhook?.signature_header ?? ""
    });
    const duplicate = processPaymentWebhook({
      provider: "stripe_checkout",
      raw_body: session.sandbox_webhook?.raw_body ?? "",
      signature: session.sandbox_webhook?.signature_header ?? ""
    });
    const entitlement = getReportEntitlement(draft.report_id, "member_phase9");
    const member = getMemberEntitlements("member_phase9");
    const dashboard = getCommercialDashboard();

    expect(order.status).toBe("draft");
    expect(order.amount_cents).toBe(4900);
    expect(session.provider).toBe("stripe_checkout");
    expect(session.provider_mode).toBe("sandbox");
    expect(session.checkout_url).toContain("/commercial/checkout-sandbox");
    expect(event.order.status).toBe("fulfilled");
    expect(duplicate.is_duplicate).toBe(true);
    expect(entitlement.has_access).toBe(true);
    expect(entitlement.report_snapshot?.report_id).toBe(draft.report_id);
    expect(member.purchased_report_ids).toContain(draft.report_id);
    expect(dashboard.total_orders).toBeGreaterThanOrEqual(1);
    expect(dashboard.fulfilled_orders).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify({ order, session, event, entitlement, member })).not.toContain("2000-08-16");
    expect(JSON.stringify({ order, session, event, entitlement, member })).not.toContain("03:30");
    expect(JSON.stringify({ order, session, event, entitlement, member })).not.toContain("Shanghai");
  });

  test("blocks order creation without required commercial consent", () => {
    const chart = createChart({ birth_profile: birthProfile });
    const draft = createReportDraft({
      report_type: "single_chart",
      chart_id: chart.chart_id,
      chart: chart.chart,
      mode: "professional"
    });

    expect(() =>
      createOrder({
        report_id: draft.report_id,
        package_id: "single_report",
        tier_id: "standard_49",
        member_id: "member_missing_consent",
        consent: { ...requiredConsent, refund_policy: false }
      })
    ).toThrow(/commercial consent/i);
  });

  test("rejects invalid webhook signatures before changing order state", () => {
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
      tier_id: "starter_19",
      member_id: "member_bad_signature",
      consent: requiredConsent
    });
    const session = createCheckoutSession({
      order_id: order.order_id,
      provider: "stripe_checkout",
      success_url: "http://localhost:3000/commercial/success",
      cancel_url: "http://localhost:3000/commercial/cancel"
    });

    expect(() =>
      processPaymentWebhook({
        provider: "stripe_checkout",
        raw_body: session.sandbox_webhook?.raw_body ?? "",
        signature: "t=1,v1=invalid"
      })
    ).toThrow(/signature/i);
  });
});
