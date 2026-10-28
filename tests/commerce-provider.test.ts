import { createHmac, createSign, generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { POST as paymentWebhookPost } from "../src/app/api/payment/webhook/route.js";
import { createChart } from "../src/chartEngine.js";
import { listProductEvents, listRefundRecords } from "../src/store.js";
import { createReportDraft } from "../src/phase8/reporting.js";
import { createCheckoutSession, createOrder, getCommercialDashboard, grantManualEntitlement, markPartialRefund, processPaymentWebhook } from "../src/phase9/commerce.js";
import { clearChartsForTests, clearCommerceForTests, clearProductEventForTests, clearReportsForTests } from "../src/store.js";
import { getReportEntitlement, markManualRefund } from "../src/phase9/commerce.js";
import { orderStatuses } from "../src/types.js";

const profile = {
  display_name: "支付状态测试",
  calendar_type: "gregorian" as const,
  birth_date: "2000-08-16",
  birth_time: "03:30",
  timezone: "Asia/Shanghai",
  location: {
    name: "上海",
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
};

describe("commerce provider adapter and payment state machine", () => {
  beforeEach(() => {
    clearChartsForTests();
    clearReportsForTests();
    clearCommerceForTests();
    clearProductEventForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("mock provider creates a signed checkout session and exposes provider requirements", () => {
    const report = createApprovedReport();
    const order = createOrder({
      report_id: report.report_id,
      package_id: "single_report",
      tier_id: "standard_49",
      member_id: "member_provider",
      consent
    });

    const session = createCheckoutSession({
      order_id: order.order_id,
      provider: "mock_checkout",
      success_url: "http://local/commercial/success",
      cancel_url: "http://local/commercial/cancel"
    });

    expect(session.provider).toBe("mock_checkout");
    expect(session.provider_mode).toBe("sandbox");
    expect(session.checkout_url).toContain("/commercial/checkout-sandbox");
    expect(session.provider_requirements.webhook_secret_env).toBe("MOCK_PAYMENT_WEBHOOK_SECRET");
    expect(session.provider_requirements.signature_header).toBe("mock-signature");
    expect(session.sandbox_webhook?.signature_header).toContain("v1=");
    expect(JSON.stringify(session)).not.toMatch(/2000-08-16|03:30|上海/);
  });

  test("wechat and alipay providers are production-gated and expose China-market signing requirements", () => {
    const report = createApprovedReport();

    for (const [provider, expected] of [
      [
        "wechat_pay_reserved",
        {
          webhookSecretEnv: "WECHAT_PAY_API_V3_KEY",
          signatureHeader: "wechatpay-signature",
          baseUrlEnv: "WECHAT_PAY_CHECKOUT_BASE_URL"
        }
      ],
      [
        "alipay_reserved",
        {
          webhookSecretEnv: "ALIPAY_PUBLIC_KEY",
          signatureHeader: "alipay-signature",
          baseUrlEnv: "ALIPAY_CHECKOUT_BASE_URL"
        }
      ]
    ] as const) {
      clearCommerceForTests();
      const order = createOrder({
        report_id: report.report_id,
        package_id: "single_report",
        tier_id: "standard_49",
        member_id: `member_${provider}`,
        consent
      });

      const session = createCheckoutSession({
        order_id: order.order_id,
        provider,
        success_url: "http://local/commercial/success",
        cancel_url: "http://local/commercial/cancel"
      });

      expect(session.provider).toBe(provider);
      expect(session.provider_mode).toBe("sandbox");
      expect(session.checkout_url).toContain("/commercial/checkout-sandbox");
      expect(session.provider_requirements.webhook_secret_env).toBe(expected.webhookSecretEnv);
      expect(session.provider_requirements.signature_header).toBe(expected.signatureHeader);
      expect(session.provider_requirements.production_base_url_env).toBe(expected.baseUrlEnv);
      expect(session.provider_requirements.idempotency_key_source).toBe("provider_event_id");
      expect(session.sandbox_webhook?.signature_header).toContain("v1=");
    }
  });

  test("refuses production checkout for the selected China provider when the launch gate is not ready", () => {
    vi.stubEnv("PHASE10_PRODUCTION_PAYMENT_ENABLED", "false");
    vi.stubEnv("PHASE10_PAYMENT_ROLLOUT_PERCENT", "100");
    vi.stubEnv("PHASE10_PAYMENT_ROLLBACK", "false");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_phase10");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_phase10");
    vi.stubEnv("WECHAT_PAY_MCH_ID", "mch_phase10");
    vi.stubEnv("WECHAT_PAY_APP_ID", "wx_phase10");
    vi.stubEnv("WECHAT_PAY_API_V3_KEY", "wx_api_v3_key");
    vi.stubEnv("WECHAT_PAY_MERCHANT_CERT_SERIAL", "serial_phase10");
    vi.stubEnv("WECHAT_PAY_PRIVATE_KEY", "private_key_phase10");
    vi.stubEnv("WECHAT_PAY_PLATFORM_CERT", "platform_cert_phase10");
    vi.stubEnv("WECHAT_PAY_PLATFORM_CERT_SERIAL", "platform_serial_phase10");
    vi.stubEnv("WECHAT_PAY_NOTIFY_URL", "https://example.com/api/payment/webhook?provider=wechat_pay_reserved");
    vi.stubEnv("WECHAT_PAY_CHECKOUT_BASE_URL", "https://pay.example.com/wx");
    const report = createApprovedReport();
    const order = createOrder({
      report_id: report.report_id,
      package_id: "single_report",
      tier_id: "standard_49",
      member_id: "member_selected_provider_gate",
      consent
    });

    expect(() =>
      createCheckoutSession({
        order_id: order.order_id,
        provider: "wechat_pay_reserved",
        success_url: "http://local/commercial/success",
        cancel_url: "http://local/commercial/cancel"
      })
    ).toThrow(/production_disabled/i);
  });

  test("does not enable production checkout with legacy WeChat certificate env names only", () => {
    vi.stubEnv("PHASE10_PRODUCTION_PAYMENT_ENABLED", "true");
    vi.stubEnv("PHASE10_PAYMENT_ROLLOUT_PERCENT", "100");
    vi.stubEnv("PHASE10_PAYMENT_ROLLBACK", "false");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_phase10");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_phase10");
    vi.stubEnv("CHINA_PAYMENT_PRODUCTION_ENABLED", "true");
    vi.stubEnv("WECHAT_PAY_MCH_ID", "mch_legacy");
    vi.stubEnv("WECHAT_PAY_APP_ID", "wx_legacy");
    vi.stubEnv("WECHAT_PAY_API_V3_KEY", "wx_api_v3_key");
    vi.stubEnv("WECHAT_PAY_MERCHANT_SERIAL_NO", "legacy_serial");
    vi.stubEnv("WECHAT_PAY_PRIVATE_KEY", "private_key_legacy");
    vi.stubEnv("WECHAT_PAY_PLATFORM_CERTIFICATE", "legacy_platform_cert");
    vi.stubEnv("WECHAT_PAY_CHECKOUT_BASE_URL", "https://pay.example.com/wx");
    const report = createApprovedReport();
    const order = createOrder({
      report_id: report.report_id,
      package_id: "single_report",
      tier_id: "standard_49",
      member_id: "member_legacy_wechat_env",
      consent
    });

    const session = createCheckoutSession({
      order_id: order.order_id,
      provider: "wechat_pay_reserved",
      success_url: "http://local/commercial/success",
      cancel_url: "http://local/commercial/cancel"
    });

    expect(session.provider_mode).toBe("sandbox");
    expect(session.checkout_url).toContain("/commercial/checkout-sandbox");
    expect(session.sandbox_webhook).toBeDefined();
  });

  test("creates production checkout for a selected China provider only when shared launch gate readiness is satisfied", () => {
    vi.stubEnv("PHASE10_PRODUCTION_PAYMENT_ENABLED", "true");
    vi.stubEnv("PHASE10_PAYMENT_ROLLOUT_PERCENT", "100");
    vi.stubEnv("PHASE10_PAYMENT_ROLLBACK", "false");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_phase10");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_phase10");
    vi.stubEnv("WECHAT_PAY_MCH_ID", "mch_ready");
    vi.stubEnv("WECHAT_PAY_APP_ID", "wx_ready");
    vi.stubEnv("WECHAT_PAY_API_V3_KEY", "wx_api_v3_key_ready");
    vi.stubEnv("WECHAT_PAY_MERCHANT_CERT_SERIAL", "cert_serial_ready");
    vi.stubEnv("WECHAT_PAY_PRIVATE_KEY", "private_key_ready");
    vi.stubEnv("WECHAT_PAY_PLATFORM_CERT", "platform_cert_ready");
    vi.stubEnv("WECHAT_PAY_PLATFORM_CERT_SERIAL", "platform_cert_serial_ready");
    vi.stubEnv("WECHAT_PAY_NOTIFY_URL", "https://example.com/api/payment/webhook?provider=wechat_pay_reserved");
    vi.stubEnv("WECHAT_PAY_CHECKOUT_BASE_URL", "https://pay.example.com/wx");
    const report = createApprovedReport();
    const order = createOrder({
      report_id: report.report_id,
      package_id: "single_report",
      tier_id: "standard_49",
      member_id: "member_ready_wechat_env",
      consent
    });

    const session = createCheckoutSession({
      order_id: order.order_id,
      provider: "wechat_pay_reserved",
      success_url: "http://local/commercial/success",
      cancel_url: "http://local/commercial/cancel"
    });

    expect(session.provider_mode).toBe("production");
    expect(session.checkout_url).toBe(`https://pay.example.com/wx/${session.checkout_session_id}`);
    expect(session.sandbox_webhook).toBeUndefined();
  });

  test("wechat and alipay webhook signatures are verified and replay is idempotent", () => {
    const report = createApprovedReport();

    for (const provider of ["wechat_pay_reserved", "alipay_reserved"] as const) {
      clearCommerceForTests();
      const order = createOrder({
        report_id: report.report_id,
        package_id: "single_report",
        tier_id: "starter_19",
        member_id: `member_webhook_${provider}`,
        consent
      });
      const session = createCheckoutSession({
        order_id: order.order_id,
        provider,
        success_url: "http://local/commercial/success",
        cancel_url: "http://local/commercial/cancel"
      });

      const first = processPaymentWebhook({
        provider,
        raw_body: session.sandbox_webhook?.raw_body ?? "",
        signature: session.sandbox_webhook?.signature_header ?? ""
      });
      const replay = processPaymentWebhook({
        provider,
        raw_body: session.sandbox_webhook?.raw_body ?? "",
        signature: session.sandbox_webhook?.signature_header ?? ""
      });

      expect(first.signature_verified).toBe(true);
      expect(first.order.status).toBe("fulfilled");
      expect(replay.is_duplicate).toBe(true);
      expect(replay.order.status).toBe("fulfilled");
    }
  });

  test("public payment webhook route dispatches WeChat and Alipay callbacks by provider", async () => {
    const report = createApprovedReport();

    for (const [provider, signatureHeader] of [
      ["wechat_pay_reserved", "wechatpay-signature"],
      ["alipay_reserved", "alipay-signature"]
    ] as const) {
      clearCommerceForTests();
      const order = createOrder({
        report_id: report.report_id,
        package_id: "single_report",
        tier_id: "starter_19",
        member_id: `member_route_${provider}`,
        consent
      });
      const session = createCheckoutSession({
        order_id: order.order_id,
        provider,
        success_url: "http://local/commercial/success",
        cancel_url: "http://local/commercial/cancel"
      });

      const response = await paymentWebhookPost(
        new Request(`http://local/api/payment/webhook?provider=${provider}`, {
          method: "POST",
          body: session.sandbox_webhook?.raw_body ?? "",
          headers: {
            [signatureHeader]: session.sandbox_webhook?.signature_header ?? ""
          }
        })
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.provider).toBe(provider);
      expect(body.signature_verified).toBe(true);
      expect(body.order.status).toBe("fulfilled");
    }
  });

  test("records a single payment_result event through the shared webhook dispatcher", async () => {
    const report = createApprovedReport();
    const order = createOrder({
      report_id: report.report_id,
      package_id: "single_report",
      tier_id: "starter_19",
      member_id: "member_payment_event",
      consent
    });
    const session = createCheckoutSession({
      order_id: order.order_id,
      provider: "wechat_pay_reserved",
      success_url: "http://local/commercial/success",
      cancel_url: "http://local/commercial/cancel"
    });

    const response = await paymentWebhookPost(
      new Request("http://local/api/payment/webhook?provider=wechat_pay_reserved", {
        method: "POST",
        body: session.sandbox_webhook?.raw_body ?? "",
        headers: {
          "wechatpay-signature": session.sandbox_webhook?.signature_header ?? ""
        }
      })
    );
    const body = await response.json();
    const paymentEvents = listProductEvents().filter((event) => event.type === "payment_result");

    expect(response.status).toBe(200);
    expect(body.order.status).toBe("fulfilled");
    expect(paymentEvents).toHaveLength(1);
    expect(paymentEvents[0]).toMatchObject({
      type: "payment_result",
      order_id: order.order_id,
      metadata: {
        event_type: "checkout.session.completed",
        duplicate: false,
        provider: "wechat_pay_reserved"
      }
    });
  });

  test("does not duplicate payment_result analytics when a webhook is replayed", async () => {
    const report = createApprovedReport();
    const order = createOrder({
      report_id: report.report_id,
      package_id: "single_report",
      tier_id: "starter_19",
      member_id: "member_payment_replay",
      consent
    });
    const session = createCheckoutSession({
      order_id: order.order_id,
      provider: "wechat_pay_reserved",
      success_url: "http://local/commercial/success",
      cancel_url: "http://local/commercial/cancel"
    });

    await paymentWebhookPost(
      new Request("http://local/api/payment/webhook?provider=wechat_pay_reserved", {
        method: "POST",
        body: session.sandbox_webhook?.raw_body ?? "",
        headers: {
          "wechatpay-signature": session.sandbox_webhook?.signature_header ?? ""
        }
      })
    );
    const replayResponse = await paymentWebhookPost(
      new Request("http://local/api/payment/webhook?provider=wechat_pay_reserved", {
        method: "POST",
        body: session.sandbox_webhook?.raw_body ?? "",
        headers: {
          "wechatpay-signature": session.sandbox_webhook?.signature_header ?? ""
        }
      })
    );
    const paymentEvents = listProductEvents().filter((event) => event.type === "payment_result");

    expect(replayResponse.status).toBe(200);
    expect(paymentEvents).toHaveLength(1);
    expect(paymentEvents[0]?.metadata).toMatchObject({
      event_type: "checkout.session.completed",
      duplicate: false,
      provider: "wechat_pay_reserved"
    });
  });

  test("public payment webhook route rejects unknown provider and mismatched signature header", async () => {
    const report = createApprovedReport();
    const order = createOrder({
      report_id: report.report_id,
      package_id: "single_report",
      tier_id: "starter_19",
      member_id: "member_route_signature_reject",
      consent
    });
    const session = createCheckoutSession({
      order_id: order.order_id,
      provider: "wechat_pay_reserved",
      success_url: "http://local/commercial/success",
      cancel_url: "http://local/commercial/cancel"
    });

    const response = await paymentWebhookPost(
      new Request("http://local/api/payment/webhook?provider=wechat_pay_reserved", {
        method: "POST",
        body: session.sandbox_webhook?.raw_body ?? "",
        headers: {
          "stripe-signature": session.sandbox_webhook?.signature_header ?? ""
        }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatchObject({
      code: "PAYMENT_WEBHOOK_SIGNATURE_INVALID",
      field: "wechatpay-signature"
    });
  });

  test("verifies production WeChat Pay API v3 callback signatures with platform public key material", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    vi.stubEnv("WECHAT_PAY_PLATFORM_CERT", publicKey.export({ type: "spki", format: "pem" }).toString());
    vi.stubEnv("WECHAT_PAY_PLATFORM_CERT_SERIAL", "platform_serial_rsa");
    const report = createApprovedReport();
    const order = createOrder({
      report_id: report.report_id,
      package_id: "single_report",
      tier_id: "starter_19",
      member_id: "member_wechat_rsa_webhook",
      provider: "wechat_pay_reserved",
      consent
    });
    const session = createCheckoutSession({
      order_id: order.order_id,
      provider: "wechat_pay_reserved",
      success_url: "http://local/commercial/success",
      cancel_url: "http://local/commercial/cancel"
    });
    const rawBody = JSON.stringify({
      event_id: "wx_rsa_evt_001",
      provider_event_id: "wx_notify_001",
      type: "checkout.session.completed",
      provider: "wechat_pay_reserved",
      data: {
        checkout_session_id: session.checkout_session_id,
        order_id: order.order_id,
        amount_total: order.amount_cents,
        currency: order.currency
      }
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = "wechat_nonce_001";
    const signature = createSign("RSA-SHA256").update(`${timestamp}\n${nonce}\n${rawBody}\n`).sign(privateKey, "base64");

    const event = processPaymentWebhook({
      provider: "wechat_pay_reserved",
      raw_body: rawBody,
      signature: `wechatpay-timestamp=${timestamp},wechatpay-nonce=${nonce},wechatpay-serial=platform_serial_rsa,wechatpay-signature=${signature}`
    });

    expect(event.signature_verified).toBe(true);
    expect(event.order.status).toBe("fulfilled");
    expect(() =>
      processPaymentWebhook({
        provider: "wechat_pay_reserved",
        raw_body: rawBody.replace("checkout.session.completed", "payment_intent.payment_failed"),
        signature: `wechatpay-timestamp=${timestamp},wechatpay-nonce=${nonce},wechatpay-serial=platform_serial_rsa,wechatpay-signature=${signature}`
      })
    ).toThrow(/signature/i);
  });

  test("public payment webhook route accepts standard WeChat Pay API v3 signature headers", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    vi.stubEnv("WECHAT_PAY_PLATFORM_CERT", publicKey.export({ type: "spki", format: "pem" }).toString());
    vi.stubEnv("WECHAT_PAY_PLATFORM_CERT_SERIAL", "platform_serial_route");
    const report = createApprovedReport();
    const order = createOrder({
      report_id: report.report_id,
      package_id: "single_report",
      tier_id: "starter_19",
      member_id: "member_wechat_route_rsa",
      provider: "wechat_pay_reserved",
      consent
    });
    const session = createCheckoutSession({
      order_id: order.order_id,
      provider: "wechat_pay_reserved",
      success_url: "http://local/commercial/success",
      cancel_url: "http://local/commercial/cancel"
    });
    const rawBody = JSON.stringify({
      event_id: "wx_route_rsa_evt_001",
      provider_event_id: "wx_route_notify_001",
      type: "checkout.session.completed",
      provider: "wechat_pay_reserved",
      data: {
        checkout_session_id: session.checkout_session_id,
        order_id: order.order_id
      }
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = "wechat_route_nonce_001";
    const signature = createSign("RSA-SHA256").update(`${timestamp}\n${nonce}\n${rawBody}\n`).sign(privateKey, "base64");

    const response = await paymentWebhookPost(
      new Request("http://local/api/payment/webhook?provider=wechat_pay_reserved", {
        method: "POST",
        body: rawBody,
        headers: {
          "Wechatpay-Timestamp": timestamp,
          "Wechatpay-Nonce": nonce,
          "Wechatpay-Serial": "platform_serial_route",
          "Wechatpay-Signature": signature
        }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.provider).toBe("wechat_pay_reserved");
    expect(body.signature_verified).toBe(true);
    expect(body.order.status).toBe("fulfilled");
  });

  test("verifies production Alipay RSA2 callback signatures over sorted notification parameters", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    vi.stubEnv("ALIPAY_PUBLIC_KEY", publicKey.export({ type: "spki", format: "pem" }).toString());
    const report = createApprovedReport();
    const order = createOrder({
      report_id: report.report_id,
      package_id: "single_report",
      tier_id: "starter_19",
      member_id: "member_alipay_rsa_webhook",
      provider: "alipay_reserved",
      consent
    });
    const session = createCheckoutSession({
      order_id: order.order_id,
      provider: "alipay_reserved",
      success_url: "http://local/commercial/success",
      cancel_url: "http://local/commercial/cancel"
    });
    const params = new URLSearchParams({
      event_id: "ali_rsa_evt_001",
      trade_no: "ali_trade_001",
      notify_type: "trade_status_sync",
      trade_status: "TRADE_SUCCESS",
      type: "checkout.session.completed",
      checkout_session_id: session.checkout_session_id,
      order_id: order.order_id,
      total_amount: String(order.amount_cents / 100),
      sign_type: "RSA2"
    });
    const content = Array.from(params.entries())
      .filter(([key]) => key !== "sign" && key !== "sign_type")
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join("&");
    params.set("sign", createSign("RSA-SHA256").update(content).sign(privateKey, "base64"));
    const rawBody = params.toString();

    const event = processPaymentWebhook({
      provider: "alipay_reserved",
      raw_body: rawBody,
      signature: "alipay-rsa2"
    });

    expect(event.signature_verified).toBe(true);
    expect(event.order.status).toBe("fulfilled");
    expect(() =>
      processPaymentWebhook({
        provider: "alipay_reserved",
        raw_body: rawBody.replace("TRADE_SUCCESS", "TRADE_CLOSED"),
        signature: "alipay-rsa2"
      })
    ).toThrow(/signature/i);
  });

  test("handles failed, canceled, and expired payment events without granting entitlement", () => {
    const previousSecret = process.env.MOCK_PAYMENT_WEBHOOK_SECRET;
    process.env.MOCK_PAYMENT_WEBHOOK_SECRET = "test_mock_payment_webhook_secret";
    for (const [eventType, expectedStatus] of [
      ["payment_intent.payment_failed", "failed"],
      ["checkout.session.canceled", "cancelled"],
      ["checkout.session.expired", "failed"]
    ] as const) {
      clearCommerceForTests();
      const report = createApprovedReport();
      const order = createOrder({
        report_id: report.report_id,
        package_id: "single_report",
        tier_id: "starter_19",
        member_id: `member_${expectedStatus}`,
        consent
      });
      const session = createCheckoutSession({
        order_id: order.order_id,
        provider: "mock_checkout",
        success_url: "http://local/commercial/success",
        cancel_url: "http://local/commercial/cancel"
      });
      const rawBody = JSON.stringify({
        event_id: `evt_${expectedStatus}`,
        type: eventType,
        provider: "mock_checkout",
        data: {
          checkout_session_id: session.checkout_session_id,
          order_id: order.order_id
        }
      });
      const event = processPaymentWebhook({
        provider: "mock_checkout",
        raw_body: rawBody,
        signature: signMockWebhook(rawBody)
      });

      expect(event.order.status).toBe(expectedStatus);
      expect(event.order.fulfilled_at).toBeUndefined();
    }
    process.env.MOCK_PAYMENT_WEBHOOK_SECRET = previousSecret;
  });

  test("uses formal deliverable order statuses and revokes entitlement on refund", () => {
    expect(orderStatuses).toEqual([
      "created",
      "pending_payment",
      "paid",
      "failed",
      "cancelled",
      "refunded",
      "partially_refunded",
      "fulfilled"
    ]);

    const report = createApprovedReport();
    const order = createOrder({
      report_id: report.report_id,
      package_id: "single_report",
      tier_id: "standard_49",
      member_id: "member_refund",
      consent
    });
    const session = createCheckoutSession({
      order_id: order.order_id,
      provider: "mock_checkout",
      success_url: "http://local/commercial/success",
      cancel_url: "http://local/commercial/cancel"
    });
    const paid = processPaymentWebhook({
      provider: "mock_checkout",
      raw_body: session.sandbox_webhook?.raw_body ?? "",
      signature: session.sandbox_webhook?.signature_header ?? ""
    });
    const refunded = markManualRefund(paid.order.order_id, "customer requested refund");
    const entitlementAfterRefund = getReportEntitlement(report.report_id, "member_refund");
    const reissued = grantManualEntitlement({
      member_id: "member_refund",
      report_id: report.report_id,
      source_order_id: refunded.order_id,
      export_preview_credits: 1
    });

    expect(order.status).toBe("created");
    expect(paid.order.status).toBe("fulfilled");
    expect(refunded.status).toBe("refunded");
    expect(entitlementAfterRefund.has_access).toBe(false);
    expect(reissued.has_access).toBe(true);
    expect(reissued.can_read_report).toBe(true);
  });

  test("records partial refunds without revoking paid report access", () => {
    const report = createApprovedReport();
    const order = createOrder({
      report_id: report.report_id,
      package_id: "single_report",
      tier_id: "standard_49",
      member_id: "member_partial_refund",
      consent
    });
    const session = createCheckoutSession({
      order_id: order.order_id,
      provider: "mock_checkout",
      success_url: "http://local/commercial/success",
      cancel_url: "http://local/commercial/cancel"
    });
    const paid = processPaymentWebhook({
      provider: "mock_checkout",
      raw_body: session.sandbox_webhook?.raw_body ?? "",
      signature: session.sandbox_webhook?.signature_header ?? ""
    });

    const partiallyRefunded = markPartialRefund(paid.order.order_id, 1900, "partial goodwill refund for 2000-08-16 03:30 上海");
    const entitlementAfterPartialRefund = getReportEntitlement(report.report_id, "member_partial_refund");
    const dashboard = getCommercialDashboard();

    expect(partiallyRefunded.status).toBe("partially_refunded");
    expect(partiallyRefunded.refunded_amount_cents).toBe(1900);
    expect(partiallyRefunded.refund_reason).toContain("[birth_date_redacted]");
    expect(partiallyRefunded.refund_reason).toContain("[birth_time_redacted]");
    expect(partiallyRefunded.refund_reason).toContain("[location_redacted]");
    expect(entitlementAfterPartialRefund.has_access).toBe(true);
    expect(dashboard.partially_refunded_orders).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify({ partiallyRefunded, dashboard })).not.toMatch(/2000-08-16|03:30|上海/);
  });

  test("persists full and partial refunds as independent finance records", () => {
    const report = createApprovedReport();
    const fullOrder = createOrder({
      report_id: report.report_id,
      package_id: "single_report",
      tier_id: "standard_49",
      member_id: "member_refund_records_full",
      provider: "wechat_pay_reserved",
      consent
    });
    const fullSession = createCheckoutSession({
      order_id: fullOrder.order_id,
      provider: "wechat_pay_reserved",
      success_url: "http://local/commercial/success",
      cancel_url: "http://local/commercial/cancel"
    });
    const fullPaid = processPaymentWebhook({
      provider: "wechat_pay_reserved",
      raw_body: fullSession.sandbox_webhook?.raw_body ?? "",
      signature: fullSession.sandbox_webhook?.signature_header ?? ""
    });

    const partialOrder = createOrder({
      report_id: report.report_id,
      package_id: "single_report",
      tier_id: "premium_99",
      member_id: "member_refund_records_partial",
      provider: "alipay_reserved",
      consent
    });
    const partialSession = createCheckoutSession({
      order_id: partialOrder.order_id,
      provider: "alipay_reserved",
      success_url: "http://local/commercial/success",
      cancel_url: "http://local/commercial/cancel"
    });
    const partialPaid = processPaymentWebhook({
      provider: "alipay_reserved",
      raw_body: partialSession.sandbox_webhook?.raw_body ?? "",
      signature: partialSession.sandbox_webhook?.signature_header ?? ""
    });

    markManualRefund(fullPaid.order.order_id, "full refund for duplicate purchase at 2000-08-16 03:30 上海", {
      requested_by: "ops_admin:finance",
      ticket_id: "ticket_full_refund"
    });
    markPartialRefund(partialPaid.order.order_id, 1900, "partial refund for settlement adjustment 2000-08-16 03:30 上海", {
      requested_by: "ops_admin:support",
      ticket_id: "ticket_partial_refund",
      provider_refund_id: "ali_refund_001"
    });

    const refunds = listRefundRecords().sort((left, right) => left.amount_cents - right.amount_cents);

    expect(refunds).toHaveLength(2);
    expect(refunds[0]).toMatchObject({
      order_id: partialPaid.order.order_id,
      provider: "alipay_reserved",
      provider_refund_id: "ali_refund_001",
      amount_cents: 1900,
      status: "succeeded",
      requested_by: "ops_admin:support",
      ticket_id: "ticket_partial_refund"
    });
    expect(refunds[1]).toMatchObject({
      order_id: fullPaid.order.order_id,
      provider: "wechat_pay_reserved",
      amount_cents: fullPaid.order.amount_cents,
      status: "succeeded",
      requested_by: "ops_admin:finance",
      ticket_id: "ticket_full_refund"
    });
    expect(JSON.stringify(refunds)).not.toMatch(/2000-08-16|03:30|上海/);
    expect(refunds.every((refund) => refund.privacy_note.includes("raw birth data"))).toBe(true);
  });

  test("creates provider refund request envelopes for China payment refunds without leaking sensitive data", () => {
    const report = createApprovedReport();
    const wechatOrder = createOrder({
      report_id: report.report_id,
      package_id: "single_report",
      tier_id: "standard_49",
      member_id: "member_refund_request_wechat",
      provider: "wechat_pay_reserved",
      consent
    });
    const wechatSession = createCheckoutSession({
      order_id: wechatOrder.order_id,
      provider: "wechat_pay_reserved",
      success_url: "http://local/commercial/success",
      cancel_url: "http://local/commercial/cancel"
    });
    const wechatPaid = processPaymentWebhook({
      provider: "wechat_pay_reserved",
      raw_body: wechatSession.sandbox_webhook?.raw_body ?? "",
      signature: wechatSession.sandbox_webhook?.signature_header ?? ""
    });
    markManualRefund(wechatPaid.order.order_id, "refund because of 2000-08-16 03:30 上海", {
      requested_by: "ops_admin:finance",
      ticket_id: "ticket_wechat_refund"
    });

    const alipayOrder = createOrder({
      report_id: report.report_id,
      package_id: "single_report",
      tier_id: "premium_99",
      member_id: "member_refund_request_alipay",
      provider: "alipay_reserved",
      consent
    });
    const alipaySession = createCheckoutSession({
      order_id: alipayOrder.order_id,
      provider: "alipay_reserved",
      success_url: "http://local/commercial/success",
      cancel_url: "http://local/commercial/cancel"
    });
    const alipayPaid = processPaymentWebhook({
      provider: "alipay_reserved",
      raw_body: alipaySession.sandbox_webhook?.raw_body ?? "",
      signature: alipaySession.sandbox_webhook?.signature_header ?? ""
    });
    markPartialRefund(alipayPaid.order.order_id, 1900, "partial settlement refund 2000-08-16 03:30 上海", {
      requested_by: "ops_admin:finance",
      ticket_id: "ticket_alipay_refund"
    });

    const refunds = listRefundRecords().filter((refund) => ["ticket_wechat_refund", "ticket_alipay_refund"].includes(refund.ticket_id ?? ""));
    const wechatRefund = refunds.find((refund) => refund.provider === "wechat_pay_reserved");
    const alipayRefund = refunds.find((refund) => refund.provider === "alipay_reserved");

    expect(wechatRefund?.provider_refund_request).toMatchObject({
      provider: "wechat_pay_reserved",
      method: "POST",
      endpoint: "/v3/refund/domestic/refunds",
      idempotency_key: expect.stringContaining(wechatRefund?.refund_id ?? "missing"),
      signature_algorithm: "WECHATPAY2-SHA256-RSA2048",
      submission_status: "external_configuration_required"
    });
    expect(wechatRefund?.provider_refund_request?.signed_payload_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(alipayRefund?.provider_refund_request).toMatchObject({
      provider: "alipay_reserved",
      method: "POST",
      endpoint: "alipay.trade.refund",
      idempotency_key: expect.stringContaining(alipayRefund?.refund_id ?? "missing"),
      signature_algorithm: "RSA2",
      submission_status: "external_configuration_required"
    });
    expect(alipayRefund?.provider_refund_request?.signed_payload_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(refunds)).not.toMatch(/2000-08-16|03:30|上海|wx_api_v3_key_ready|private_key_ready/);
  });
});

function createApprovedReport() {
  const chart = createChart({ birth_profile: profile });
  return createReportDraft({
    report_type: "single_chart",
    chart_id: chart.chart_id,
    chart: chart.chart,
    mode: "entertainment"
  });
}

function signMockWebhook(rawBody: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const secret = process.env.MOCK_PAYMENT_WEBHOOK_SECRET ?? "test_mock_payment_webhook_secret";
  const signature = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}
