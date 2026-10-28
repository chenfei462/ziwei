import { afterEach, describe, expect, test, vi } from "vitest";
import { createChart } from "../src/chartEngine.js";
import { createReportDraft } from "../src/phase8/reporting.js";
import {
  confirmSandboxCheckout,
  createCheckoutSession,
  createOrder,
  getCommercialDashboard,
  getMemberEntitlements,
  getReportEntitlement,
  processPaymentWebhook
} from "../src/phase9/commerce.js";
import { productRepository } from "../src/repositories/productRepository.js";
import { assertCanReadReport } from "../src/reportAccess.js";

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
  afterEach(() => {
    vi.unstubAllEnvs();
  });

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

    expect(order.status).toBe("created");
    expect(order.amount_cents).toBe(4900);
    expect(session.provider).toBe("stripe_checkout");
    expect(session.provider_mode).toBe("sandbox");
    expect(session.checkout_url).toContain("/commercial/checkout-sandbox");
    expect(event.order.status).toBe("fulfilled");
    expect(duplicate.is_duplicate).toBe(true);
    expect(entitlement.has_access).toBe(true);
    expect(entitlement.tier_id).toBe("standard_49");
    expect(entitlement.access_level).toBe("standard_report");
    expect(entitlement.benefits).toEqual(expect.arrayContaining(["full_report_read", "export_preview", "favorite_report"]));
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

  test("maps starter, standard, and premium purchases to distinct report entitlements", () => {
    for (const [tierId, expected] of [
      [
        "starter_19",
        {
          access_level: "free_summary",
          can_read_report: false,
          export_preview_credits: 1,
          benefits: ["free_summary", "redacted_share"]
        }
      ],
      [
        "standard_49",
        {
          access_level: "standard_report",
          can_read_report: true,
          export_preview_credits: 3,
          benefits: ["full_report_read", "export_preview", "favorite_report"]
        }
      ],
      [
        "premium_99",
        {
          access_level: "premium_report",
          can_read_report: true,
          export_preview_credits: 6,
          benefits: ["full_report_read", "export_preview", "favorite_report", "priority_support"]
        }
      ]
    ] as const) {
      const chart = createChart({ birth_profile: birthProfile });
      const draft = createReportDraft({
        report_type: "single_chart",
        chart_id: chart.chart_id,
        chart: chart.chart,
        mode: "professional"
      });
      const memberId = `member_${tierId}`;
      const order = createOrder({
        report_id: draft.report_id,
        package_id: "single_report",
        tier_id: tierId,
        member_id: memberId,
        consent: requiredConsent
      });
      const session = createCheckoutSession({
        order_id: order.order_id,
        provider: "stripe_checkout",
        success_url: "http://localhost:3000/commercial/success",
        cancel_url: "http://localhost:3000/commercial/cancel"
      });

      processPaymentWebhook({
        provider: "stripe_checkout",
        raw_body: session.sandbox_webhook?.raw_body ?? "",
        signature: session.sandbox_webhook?.signature_header ?? ""
      });
      const entitlement = getReportEntitlement(draft.report_id, memberId);

      expect(entitlement).toMatchObject({
        tier_id: tierId,
        access_level: expected.access_level,
        can_read_report: expected.can_read_report,
        export_preview_credits: expected.export_preview_credits
      });
      expect(entitlement.benefits).toEqual(expect.arrayContaining([...expected.benefits]));

      if (expected.can_read_report) {
        expect(() => assertCanReadReport(draft, { visitorId: `visitor_${tierId}`, memberId })).not.toThrow();
      } else {
        expect(() => assertCanReadReport(draft, { visitorId: `visitor_${tierId}`, memberId })).toThrow(/REPORT_ACCESS_FORBIDDEN|无权|浣犳棤/);
      }
    }
  });

  test("confirms a China-market sandbox checkout server-side and grants report entitlement", () => {
    const previousChinaPaymentEnabled = process.env.CHINA_PAYMENT_PRODUCTION_ENABLED;
    process.env.CHINA_PAYMENT_PRODUCTION_ENABLED = "false";
    try {
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
        member_id: "member_sandbox_checkout_confirm",
        provider: "wechat_pay_reserved",
        consent: requiredConsent
      });
      const session = createCheckoutSession({
        order_id: order.order_id,
        provider: "wechat_pay_reserved",
        success_url: "http://localhost:3000/commercial/success",
        cancel_url: "http://localhost:3000/commercial/cancel"
      });

      const event = confirmSandboxCheckout(session.checkout_session_id);
      const duplicate = confirmSandboxCheckout(session.checkout_session_id);
      const entitlement = getReportEntitlement(draft.report_id, "member_sandbox_checkout_confirm");

      expect(session.provider).toBe("wechat_pay_reserved");
      expect(session.provider_mode).toBe("sandbox");
      expect(event.order.status).toBe("fulfilled");
      expect(event.signature_verified).toBe(true);
      expect(duplicate.is_duplicate).toBe(true);
      expect(entitlement.has_access).toBe(true);
      expect(entitlement.can_read_report).toBe(true);
      expect(entitlement.tier_id).toBe("standard_49");
      expect(JSON.stringify(event)).not.toContain("raw_body");
      expect(JSON.stringify(event)).not.toContain("signature_header");
    } finally {
      if (previousChinaPaymentEnabled === undefined) {
        delete process.env.CHINA_PAYMENT_PRODUCTION_ENABLED;
      } else {
        process.env.CHINA_PAYMENT_PRODUCTION_ENABLED = previousChinaPaymentEnabled;
      }
    }
  });

  test("keeps sandbox checkout confirmation disabled in production unless explicitly enabled", () => {
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
      member_id: "member_sandbox_checkout_gate",
      consent: requiredConsent
    });
    const session = createCheckoutSession({
      order_id: order.order_id,
      provider: "stripe_checkout",
      success_url: "http://localhost:3000/commercial/success",
      cancel_url: "http://localhost:3000/commercial/cancel"
    });
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ZIWEI_ENABLE_SANDBOX_CHECKOUT_CONFIRM", "");

    expect(() => confirmSandboxCheckout(session.checkout_session_id)).toThrow(/sandbox checkout confirmation is disabled/i);
  });

  test("does not confirm an expired sandbox checkout into a paid entitlement", () => {
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
      member_id: "member_expired_sandbox_confirm",
      provider: "wechat_pay_reserved",
      consent: requiredConsent
    });
    const session = createCheckoutSession({
      order_id: order.order_id,
      provider: "wechat_pay_reserved",
      success_url: "http://localhost:3000/commercial/success",
      cancel_url: "http://localhost:3000/commercial/cancel"
    });
    productRepository.saveCheckoutSession({
      ...session,
      status: "expired",
      expires_at: new Date(Date.now() - 60_000).toISOString()
    });

    expect(() => confirmSandboxCheckout(session.checkout_session_id)).toThrow(/expired|unavailable/i);
    expect(getReportEntitlement(draft.report_id, "member_expired_sandbox_confirm")).toMatchObject({
      has_access: false,
      can_read_report: false
    });
  });
});
