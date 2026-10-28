import { beforeEach, describe, expect, test } from "vitest";
import { createChart } from "../src/chartEngine.js";
import { recordChannelGrowthEvent } from "../src/phase14/channels.js";
import { createReportDraft } from "../src/phase8/reporting.js";
import { createCheckoutSession, createOrder, getReportEntitlement, processPaymentWebhook } from "../src/phase9/commerce.js";
import { productRepository } from "../src/repositories/productRepository.js";
import {
  createSupportTicket,
  evaluatePaymentLaunchGate,
  getInternalGrowthInsights,
  getLaunchOperationsDashboard,
  getOpsPaymentReconciliation,
  importOpsProviderStatement,
  listOpsAdminAuditLogs,
  listOpsOrders,
  listOpsReports,
  listOpsRuleProfiles,
  markOpsManualRefund,
  promoteOpsRuleProfile,
  previewOpsProviderStatement,
  recordGrowthEvent,
  sendOpsPaymentAlertWebhook,
  revealOpsSensitiveRecord,
  reissueOpsEntitlement,
  resolveLaunchPaymentConfig,
  updateSupportTicket
} from "../src/phase10/launchOps.js";
import { listRuleProfiles } from "../src/phase11/ruleKnowledge.js";
import { resetRuleProfilesForTests } from "../src/phase11/ruleProfileData.js";
import { clearChannelForTests, clearLaunchOpsForTests } from "../src/store.js";

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

beforeEach(() => {
  clearLaunchOpsForTests();
  clearChannelForTests();
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

async function withSandboxCheckoutConfirmEnv<T>(
  env: { enabled?: string },
  action: () => Promise<T> | T
): Promise<T> {
  const previousEnabled = process.env.ZIWEI_ENABLE_SANDBOX_CHECKOUT_CONFIRM;
  if (env.enabled === undefined) {
    delete process.env.ZIWEI_ENABLE_SANDBOX_CHECKOUT_CONFIRM;
  } else {
    process.env.ZIWEI_ENABLE_SANDBOX_CHECKOUT_CONFIRM = env.enabled;
  }
  try {
    return await action();
  } finally {
    if (previousEnabled === undefined) {
      delete process.env.ZIWEI_ENABLE_SANDBOX_CHECKOUT_CONFIRM;
    } else {
      process.env.ZIWEI_ENABLE_SANDBOX_CHECKOUT_CONFIRM = previousEnabled;
    }
  }
}

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
      config: {
        ...disabled,
        production_payment_enabled: true,
        rollout_percent: 100,
        rollback_enabled: false,
        china_payment_providers: {
          ...disabled.china_payment_providers,
          wechat_pay: {
            ...(disabled.china_payment_providers?.wechat_pay ?? {
              provider: "wechat_pay_reserved",
              requiredEnv: [
                "WECHAT_PAY_MCH_ID",
                "WECHAT_PAY_APP_ID",
                "WECHAT_PAY_API_V3_KEY",
                "WECHAT_PAY_MERCHANT_CERT_SERIAL",
                "WECHAT_PAY_PRIVATE_KEY",
                "WECHAT_PAY_PLATFORM_CERT",
                "WECHAT_PAY_PLATFORM_CERT_SERIAL",
                "WECHAT_PAY_NOTIFY_URL",
                "WECHAT_PAY_CHECKOUT_BASE_URL"
              ],
              callback_signature_header: "wechatpay-signature",
              blockers: []
            }),
            ready: true,
            provider_mode: "production",
            blockers: []
          },
          alipay: disabled.china_payment_providers?.alipay ?? {
            provider: "alipay_reserved",
            ready: false,
            provider_mode: "sandbox",
            requiredEnv: ["ALIPAY_APP_ID", "ALIPAY_PRIVATE_KEY", "ALIPAY_PUBLIC_KEY", "ALIPAY_GATEWAY_URL", "ALIPAY_NOTIFY_URL", "ALIPAY_CHECKOUT_BASE_URL"],
            callback_signature_header: "alipay-signature",
            blockers: []
          }
        }
      }
    });

    expect(disabled.provider_mode).toBe("sandbox");
    expect(disabled.ops_security?.mfa_enabled).toBe(false);
    expect(disabled.ops_security?.requiredEnv).toEqual(["PHASE10_OPS_MFA_ENABLED", "PHASE10_OPS_MFA_CODE"]);
    expect(disabled.ops_security?.blockers).toEqual(
      expect.arrayContaining(["Set PHASE10_OPS_MFA_ENABLED=true and inject PHASE10_OPS_MFA_CODE before production ops access."])
    );
    expect(disabled.rate_limit).toMatchObject({
      provider: "memory",
      ready: true,
      production_required: false,
      requiredEnv: ["ZIWEI_RATE_LIMIT_REDIS_REST_URL", "ZIWEI_RATE_LIMIT_REDIS_REST_TOKEN"]
    });
    expect(disabled.export_storage).toMatchObject({
      provider: "local_preview",
      ready: true,
      production_required: false,
      requiredEnv: [
        "ZIWEI_EXPORT_STORAGE_ENDPOINT",
        "ZIWEI_EXPORT_STORAGE_BUCKET",
        "ZIWEI_EXPORT_STORAGE_ACCESS_KEY_ID",
        "ZIWEI_EXPORT_STORAGE_SECRET_ACCESS_KEY",
        "ZIWEI_EXPORT_STORAGE_PUBLIC_BASE_URL"
      ]
    });
    expect(disabled.observability).toMatchObject({
      ready: false,
      log_sink_configured: false,
      metrics_configured: false,
      alert_webhook_configured: false,
      alert_webhook_secret_configured: false,
      trace_exporter_configured: false,
      backup_healthcheck_configured: false,
      requiredEnv: ["OBS_LOG_SINK", "OBS_METRICS_ENDPOINT", "OBS_ALERT_WEBHOOK_URL", "OBS_ALERT_WEBHOOK_SECRET", "OBS_TRACE_EXPORTER", "OBS_BACKUP_HEALTHCHECK_URL"]
    });
    expect(blockedByRollout.allowed).toBe(false);
    expect(blockedByRollout.reason).toBe("outside_rollout");
    expect(blockedByRollback.allowed).toBe(false);
    expect(blockedByRollback.reason).toBe("rollback_enabled");
    expect(allowed.allowed).toBe(true);
    expect(allowed.reason).toBe("production_allowed");
  });

  test("blocks production launch when neither China payment provider is production-ready", () => {
    const config = resolveLaunchPaymentConfig({
      stripe_secret_key: "sk_live_phase10",
      webhook_secret_configured: true,
      production_payment_enabled: true,
      rollout_percent: 100,
      rollback_enabled: false
    });
    const result = evaluatePaymentLaunchGate({
      member_id: "member_china_provider_gate",
      amount_cents: 4900,
      config
    });

    expect(config.china_payment_providers?.wechat_pay.ready).toBe(false);
    expect(config.china_payment_providers?.alipay.ready).toBe(false);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("china_payment_provider_not_ready");
    expect(result.provider_mode).toBe("sandbox");
  });

  test("requires the selected China payment provider to be production-ready", () => {
    const baseConfig = resolveLaunchPaymentConfig({
      stripe_secret_key: "sk_live_phase10",
      webhook_secret_configured: true,
      production_payment_enabled: true,
      rollout_percent: 100,
      rollback_enabled: false
    });
    const config = {
      ...baseConfig,
      china_payment_providers: {
        wechat_pay: {
          ...(baseConfig.china_payment_providers?.wechat_pay as NonNullable<typeof baseConfig.china_payment_providers>["wechat_pay"]),
          ready: false,
          provider_mode: "sandbox" as const
        },
        alipay: {
          ...(baseConfig.china_payment_providers?.alipay as NonNullable<typeof baseConfig.china_payment_providers>["alipay"]),
          ready: true,
          provider_mode: "production" as const,
          blockers: []
        }
      }
    };

    const wechat = evaluatePaymentLaunchGate({
      member_id: "member_provider_specific",
      amount_cents: 4900,
      provider: "wechat_pay_reserved",
      config
    });
    const alipay = evaluatePaymentLaunchGate({
      member_id: "member_provider_specific",
      amount_cents: 4900,
      provider: "alipay_reserved",
      config
    });

    expect(wechat.allowed).toBe(false);
    expect(wechat.reason).toBe("china_payment_provider_not_ready");
    expect(alipay.allowed).toBe(true);
    expect(alipay.reason).toBe("production_allowed");
  });

  test("surfaces sandbox checkout confirmation as a local/preproduction-only launch gate", async () => {
    await withSandboxCheckoutConfirmEnv({ enabled: "true" }, () => {
      const enabled = resolveLaunchPaymentConfig();

      expect(enabled.sandbox_checkout_confirm).toMatchObject({
        enabled: true,
        production_safe: false,
        requiredEnv: ["ZIWEI_ENABLE_SANDBOX_CHECKOUT_CONFIRM"]
      });
      expect(enabled.sandbox_checkout_confirm?.blockers).toEqual(
        expect.arrayContaining([
          "Disable ZIWEI_ENABLE_SANDBOX_CHECKOUT_CONFIRM for production traffic; production fulfillment must come from verified WeChat Pay or Alipay webhooks."
        ])
      );
    });

    await withSandboxCheckoutConfirmEnv({}, () => {
      const disabled = resolveLaunchPaymentConfig();

      expect(disabled.sandbox_checkout_confirm).toMatchObject({
        enabled: false,
        production_safe: false,
        requiredEnv: ["ZIWEI_ENABLE_SANDBOX_CHECKOUT_CONFIRM"],
        blockers: []
      });
    });
  });

  test("surfaces China payment provider readiness for WeChat Pay and Alipay launch gates", () => {
    const config = resolveLaunchPaymentConfig();

    expect(config.china_payment_providers?.wechat_pay).toMatchObject({
      provider: "wechat_pay_reserved",
      ready: false,
      provider_mode: "sandbox",
      requiredEnv: [
        "WECHAT_PAY_MCH_ID",
        "WECHAT_PAY_APP_ID",
        "WECHAT_PAY_API_V3_KEY",
        "WECHAT_PAY_MERCHANT_CERT_SERIAL",
        "WECHAT_PAY_PRIVATE_KEY",
        "WECHAT_PAY_PLATFORM_CERT",
        "WECHAT_PAY_PLATFORM_CERT_SERIAL",
        "WECHAT_PAY_NOTIFY_URL",
        "WECHAT_PAY_CHECKOUT_BASE_URL"
      ],
      callback_signature_header: "wechatpay-signature"
    });
    expect(config.china_payment_providers?.wechat_pay.blockers).toEqual(
      expect.arrayContaining([
        "Configure WeChat Pay merchant credentials, API v3 key, certificates, notify URL, and checkout base URL before production traffic."
      ])
    );
    expect(config.china_payment_providers?.alipay).toMatchObject({
      provider: "alipay_reserved",
      ready: false,
      provider_mode: "sandbox",
      requiredEnv: [
        "ALIPAY_APP_ID",
        "ALIPAY_PRIVATE_KEY",
        "ALIPAY_PUBLIC_KEY",
        "ALIPAY_GATEWAY_URL",
        "ALIPAY_NOTIFY_URL",
        "ALIPAY_CHECKOUT_BASE_URL"
      ],
      callback_signature_header: "alipay-signature"
    });
    expect(config.china_payment_providers?.alipay.blockers).toEqual(
      expect.arrayContaining(["Configure Alipay app credentials, keys, gateway, notify URL, and checkout base URL before production traffic."])
    );
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
      status: "refunded"
    });

    expect(before.orders.map((item) => item.order_id)).toContain(order.order_id);
    expect(refunded.order.status).toBe("refunded");
    expect(refunded.note.action).toBe("manual_refund_marked");
    expect(refunded.note.note).toContain("[birth_date_redacted]");
    expect(refunded.note.note).toContain("[birth_time_redacted]");
    expect(refunded.note.note).toContain("[location_redacted]");
    expect(after.orders.map((item) => item.report_id)).toContain(draft.report_id);
    expect(JSON.stringify({ before, refunded, after })).not.toContain("2000-08-16");
    expect(JSON.stringify({ before, refunded, after })).not.toContain("03:30");
    expect(JSON.stringify({ before, refunded, after })).not.toContain("Shanghai");
  });

  test("supports partial refund, entitlement reissue, and payment reconciliation with audit notes", () => {
    const { draft, order } = createFulfilledOrder("member_ops_partial_refund");

    const partial = markOpsManualRefund({
      auth: adminAuth,
      order_id: order.order_id,
      amount_cents: 1900,
      reason: "partial refund for 2000-08-16 03:30 上海 after provider settlement",
      ticket_id: "ticket_partial_phase10"
    });
    const entitlementAfterPartialRefund = getReportEntitlement(draft.report_id, "member_ops_partial_refund");
    const reissued = reissueOpsEntitlement({
      auth: { token: "phase10_admin_token", role: "support_agent", actor_id: "support_reissue" },
      order_id: order.order_id,
      reason: "customer could not view report after partial refund",
      export_preview_credits: 2
    });
    const reconciliation = getOpsPaymentReconciliation({ auth: adminAuth });

    expect(partial.order.status).toBe("partially_refunded");
    expect(partial.order.refunded_amount_cents).toBe(1900);
    expect(partial.note.action).toBe("partial_refund_marked");
    expect(partial.note.note).toContain("[birth_date_redacted]");
    expect(partial.note.note).toContain("[birth_time_redacted]");
    expect(partial.note.note).toContain("[location_redacted]");
    expect(entitlementAfterPartialRefund.has_access).toBe(true);
    expect(reissued.entitlement.has_access).toBe(true);
    expect(reissued.entitlement.export_preview_credits).toBe(2);
    expect(reissued.note.action).toBe("entitlement_reissued");
    expect(reconciliation.summary.gross_amount_cents).toBeGreaterThanOrEqual(order.amount_cents);
    expect(reconciliation.summary.refunded_amount_cents).toBeGreaterThanOrEqual(1900);
    expect(reconciliation.summary.net_amount_cents).toBeGreaterThan(0);
    expect(reconciliation.by_provider.stripe_checkout.refunded_amount_cents).toBeGreaterThanOrEqual(1900);
    expect(reconciliation.summary.entitlement_gap_count).toBe(0);
    expect(reconciliation.alerts).toEqual([]);
    expect(JSON.stringify({ partial, reissued, reconciliation })).not.toMatch(/2000-08-16|03:30|上海/);
  });

  test("audits provider statement imports without storing raw provider references in audit metadata", () => {
    const imported = importOpsProviderStatement({
      auth: { ...adminAuth, actor_id: "ops_finance_import" },
      provider: "alipay_reserved",
      statement_id: "statement_audit_import",
      period_start: "2026-06-10",
      period_end: "2026-06-10",
      rows: [
        {
          provider_transaction_id: "ali_audit_import",
          order_id: "order_missing_for_audit",
          type: "payment",
          amount_cents: 4900,
          occurred_at: "2026-06-10T00:00:00.000Z",
          raw_reference: "openid_2000-08-16_03:30_Shanghai"
        }
      ]
    });
    const auditLogs = listOpsAdminAuditLogs({ auth: adminAuth });

    expect(imported.statement.rows[0]?.raw_reference_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(imported.reconciliation.alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "PROVIDER_STATEMENT_ORPHAN_ROWS",
          severity: "critical",
          count: 1,
          provider: "alipay_reserved",
          action: "Open a finance review ticket and verify the provider transaction before fulfillment or refund handling."
        })
      ])
    );
    expect(auditLogs.logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "ops_provider_statement_imported",
          target_type: "provider_statement",
          target_id: "statement_audit_import",
          actor_id: "ops:ops_admin",
          metadata: expect.objectContaining({
            provider: "alipay_reserved",
            statement_id: "statement_audit_import",
            row_count: 1,
            orphan_provider_row_count: 1,
            raw_reference_storage: "digest_only"
          })
        })
      ])
    );
    expect(JSON.stringify({ imported, auditLogs })).not.toMatch(/2000-08-16|03:30|Shanghai|openid/);
  });

  test("previews provider statements without persisting rows or import audit logs", () => {
    const beforeReconciliation = getOpsPaymentReconciliation({ auth: adminAuth });
    const beforeAuditCount = listOpsAdminAuditLogs({ auth: adminAuth }).logs.length;
    const preview = previewOpsProviderStatement({
      auth: { ...adminAuth, actor_id: "ops_finance_preview" },
      provider: "alipay_reserved",
      statement_id: "statement_preview_only",
      period_start: "2026-06-10",
      period_end: "2026-06-10",
      rows: [
        {
          provider_transaction_id: "ali_preview_orphan",
          order_id: "order_missing_for_preview",
          type: "payment",
          amount_cents: 4900,
          occurred_at: "2026-06-10T00:00:00.000Z",
          raw_reference: "openid_2000-08-16_03:30_Shanghai"
        }
      ]
    });
    const afterReconciliation = getOpsPaymentReconciliation({ auth: adminAuth });
    const auditLogs = listOpsAdminAuditLogs({ auth: adminAuth });

    expect(preview.statement.statement_id).toBe("statement_preview_only");
    expect(preview.statement.rows[0]?.raw_reference_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(preview.reconciliation.orphan_provider_row_count).toBe(1);
    expect(preview.reconciliation.alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "PROVIDER_STATEMENT_ORPHAN_ROWS",
          provider: "alipay_reserved"
        })
      ])
    );
    expect(afterReconciliation.provider_statements.summary.statement_count).toBe(beforeReconciliation.provider_statements.summary.statement_count);
    expect(auditLogs.logs.length).toBe(beforeAuditCount);
    expect(JSON.stringify({ preview, afterReconciliation, auditLogs })).not.toMatch(/2000-08-16|03:30|Shanghai|openid/);
  });

  test("prepares sanitized external payment alert webhook payloads and audits dry-run drills", async () => {
    const previousWebhook = process.env.OBS_ALERT_WEBHOOK_URL;
    const previousWebhookSecret = process.env.OBS_ALERT_WEBHOOK_SECRET;
    delete process.env.OBS_ALERT_WEBHOOK_URL;
    delete process.env.OBS_ALERT_WEBHOOK_SECRET;
    try {
      const imported = importOpsProviderStatement({
        auth: { ...adminAuth, actor_id: "ops_finance_alert" },
        provider: "wechat_pay_reserved",
        statement_id: "statement_alert_webhook",
        period_start: "2026-06-10",
        period_end: "2026-06-10",
        rows: [
          {
            provider_transaction_id: "wx_alert_orphan",
            order_id: "missing_alert_order",
            type: "payment",
            amount_cents: 9900,
            occurred_at: "2026-06-10T00:00:00.000Z",
            raw_reference: "openid_2000-08-16_03:30_Shanghai"
          }
        ]
      });

      const drill = await sendOpsPaymentAlertWebhook({
        auth: { ...adminAuth, actor_id: "ops_finance_alert" },
        mode: "dry_run",
        reason: "Pre-launch payment alert drill for 2000-08-16 03:30 Shanghai"
      });
      const auditLogs = listOpsAdminAuditLogs({ auth: adminAuth });

      expect(imported.reconciliation.alerts).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: "PROVIDER_STATEMENT_ORPHAN_ROWS" })])
      );
      expect(drill).toMatchObject({
        status: "dry_run",
        delivery: {
          configured: false,
          attempted: false
        },
        privacy: expect.objectContaining({
          raw_provider_reference_hidden: true,
          sensitive_fields_redacted: true
        })
      });
      expect(drill.payload.alerts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "PROVIDER_STATEMENT_ORPHAN_ROWS",
            provider: "wechat_pay_reserved",
            count: 1
          })
        ])
      );
      expect(drill.payload.summary.alert_count).toBeGreaterThanOrEqual(1);
      expect(auditLogs.logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: "ops_payment_alert_webhook_prepared",
            actor_id: "ops:ops_admin",
            metadata: expect.objectContaining({
              mode: "dry_run",
              alert_count: expect.any(Number),
              delivery_attempted: false,
              webhook_configured: false
            })
          })
        ])
      );
      expect(JSON.stringify({ drill, auditLogs })).not.toMatch(/2000-08-16|03:30|Shanghai|openid|secret|token/);

      process.env.OBS_ALERT_WEBHOOK_URL = "https://alerts.example.internal/ziwei";
      process.env.OBS_ALERT_WEBHOOK_SECRET = "alert_signing_secret_for_prelaunch_drill";
      const sentRequests: Array<{ url: string; headers: Record<string, string>; body: string }> = [];
      const ready = await sendOpsPaymentAlertWebhook({
        auth: { ...adminAuth, actor_id: "ops_finance_alert" },
        mode: "send",
        reason: "Prepare signed alert envelope for external webhook drill",
        sender: async (delivery) => {
          sentRequests.push(delivery);
          return { ok: true, status: 202, response_digest: "accepted_digest" };
        }
      });

      expect(ready.status).toBe("delivered");
      expect(ready.delivery.configured).toBe(true);
      expect(ready.delivery.attempted).toBe(true);
      expect(ready.delivery.http_status).toBe(202);
      expect(ready.delivery.response_digest).toBe("accepted_digest");
      expect(ready.delivery.endpoint_digest).toMatch(/^[a-f0-9]{64}$/);
      expect(ready.delivery.signature_digest).toMatch(/^[a-f0-9]{64}$/);
      expect(sentRequests).toHaveLength(1);
      expect(sentRequests[0]?.url).toBe("https://alerts.example.internal/ziwei");
      expect(sentRequests[0]?.headers).toMatchObject({
        "content-type": "application/json",
        "x-ziwei-alert-event": "ops.payment_reconciliation_alerts",
        "x-ziwei-alert-signature-algorithm": "HMAC-SHA256",
        "x-ziwei-alert-idempotency-key": ready.delivery.idempotency_key
      });
      expect(sentRequests[0]?.headers["x-ziwei-alert-signature"]).toMatch(/^sha256=[a-f0-9]{64}$/);
      expect(JSON.parse(sentRequests[0]?.body ?? "{}")).toMatchObject({
        event_type: "ops.payment_reconciliation_alerts",
        summary: expect.objectContaining({ alert_count: expect.any(Number) })
      });
      expect(JSON.stringify(ready)).not.toContain("https://alerts.example.internal/ziwei");
      expect(JSON.stringify(ready)).not.toContain("alert_signing_secret_for_prelaunch_drill");

      const failed = await sendOpsPaymentAlertWebhook({
        auth: { ...adminAuth, actor_id: "ops_finance_alert" },
        mode: "send",
        reason: "External webhook failure drill",
        sender: async () => ({ ok: false, status: 503, response_digest: "provider_down_digest" })
      });

      expect(failed.status).toBe("failed");
      expect(failed.delivery.attempted).toBe(true);
      expect(failed.delivery.http_status).toBe(503);
      expect(failed.delivery.error_code).toBe("ALERT_WEBHOOK_DELIVERY_FAILED");
      expect(JSON.stringify(failed)).not.toContain("https://alerts.example.internal/ziwei");
      expect(JSON.stringify(failed)).not.toContain("alert_signing_secret_for_prelaunch_drill");
    } finally {
      if (previousWebhook === undefined) {
        delete process.env.OBS_ALERT_WEBHOOK_URL;
      } else {
        process.env.OBS_ALERT_WEBHOOK_URL = previousWebhook;
      }
      if (previousWebhookSecret === undefined) {
        delete process.env.OBS_ALERT_WEBHOOK_SECRET;
      } else {
        process.env.OBS_ALERT_WEBHOOK_SECRET = previousWebhookSecret;
      }
    }
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

  test("gates sensitive ops record reveal with admin role, second confirmation, and audit logging", () => {
    const { draft } = createFulfilledOrder("member_ops_sensitive_reveal");
    const chartId = draft.chart_ref?.chart_id ?? "";
    const redactedList = listOpsReports({
      auth: adminAuth,
      report_id: draft.report_id
    });

    expect(JSON.stringify(redactedList)).not.toContain("2000-08-16");
    expect(() =>
      revealOpsSensitiveRecord({
        auth: { token: "phase10_admin_token", role: "support_agent", actor_id: "support_should_not_reveal" },
        record_type: "chart",
        record_id: chartId,
        reason: "support lookup",
        second_confirmed: true
      })
    ).toThrow(/role is not allowed/i);
    expect(() =>
      revealOpsSensitiveRecord({
        auth: { ...adminAuth, actor_id: "ops_privacy_lead" },
        record_type: "chart",
        record_id: chartId,
        reason: "privacy incident review for 2000-08-16 03:30 Shanghai",
        second_confirmed: false
      })
    ).toThrow(/second confirmation/i);

    const reveal = revealOpsSensitiveRecord({
      auth: { ...adminAuth, actor_id: "ops_privacy_lead" },
      record_type: "chart",
      record_id: chartId,
      reason: "privacy incident review for 2000-08-16 03:30 Shanghai",
      second_confirmed: true,
      ticket_id: "ticket_sensitive_reveal"
    });
    const auditLogs = listOpsAdminAuditLogs({ auth: adminAuth });
    const overview = getLaunchOperationsDashboard({ auth: adminAuth });

    expect(reveal.record_type).toBe("chart");
    expect(JSON.stringify(reveal.record)).toMatch(/2000-0?8-16/);
    expect(JSON.stringify(reveal.record)).toContain("03:30");
    expect(reveal.privacy).toMatchObject({
      sensitive_fields_visible: true,
      requires_second_confirmation: true,
      audit_logged: true,
      raw_birth_profile_decryption_available: false
    });
    expect(reveal.audit_log.action).toBe("ops_sensitive_record_revealed");
    expect(reveal.audit_log.actor_id).toBe("ops:ops_admin");
    expect(reveal.audit_log.metadata.reason).toContain("[birth_date_redacted]");
    expect(reveal.audit_log.metadata.reason).toContain("[birth_time_redacted]");
    expect(reveal.audit_log.metadata.reason).toContain("[location_redacted]");
    expect(JSON.stringify(reveal.audit_log)).not.toContain("2000-08-16");
    expect(JSON.stringify(reveal.audit_log)).not.toContain("03:30");
    expect(JSON.stringify(reveal.audit_log)).not.toContain("Shanghai");
    expect(auditLogs.logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          audit_log_id: reveal.audit_log.audit_log_id,
          action: "ops_sensitive_record_revealed",
          target_type: "chart",
          target_id: chartId
        })
      ])
    );
    expect(overview.risk.privacy_scan_violations).toBe(0);
  });

  test("builds a proxy-only internal growth lens without exposing birth data", () => {
    const { draft, order } = createFulfilledOrder("member_growth_lens");
    recordGrowthEvent({
      type: "share_to_purchase",
      member_id: "member_launch_only",
      report_id: draft.report_id,
      order_id: order.order_id,
      value_cents: order.amount_cents
    });
    recordChannelGrowthEvent({
      channel: "wechat_group",
      event_type: "share_opened",
      member_id: "member_channel_only",
      visitor_id: "visitor_channel_1"
    });
    recordChannelGrowthEvent({
      channel: "wechat_group",
      event_type: "report_intent",
      member_id: "member_channel_only",
      visitor_id: "visitor_channel_2"
    });

    const insights = getInternalGrowthInsights({ auth: adminAuth });

    expect(insights.proxy.mode).toBe("proxy_only");
    expect(insights.proxy.exact_roi_available).toBe(false);
    expect(insights.proxy.channel_events).toBe(2);
    expect(insights.proxy.launch_events).toBeGreaterThan(0);
    expect(insights.proxy.shared_members).toBe(0);
    expect(insights.proxy.shared_launch_events).toBe(0);
    expect(insights.channel_mix).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channel: "wechat_group",
          event_count: 2,
          event_share_percent: 100,
          status: "pause_candidate"
        })
      ])
    );
    expect(insights.anomalies.map((item) => item.code)).toEqual(expect.arrayContaining(["CHANNEL_DOMINANCE", "NO_MEMBER_OVERLAP"]));
    expect(insights.measurement_note).toContain("Exact ROI is not available");
    expect(JSON.stringify(insights)).not.toContain("2000-08-16");
    expect(JSON.stringify(insights)).not.toContain("03:30");
    expect(JSON.stringify(insights)).not.toContain("Shanghai");
  });

  test("rejects unauthorized ops access", () => {
    expect(() =>
      listOpsOrders({
        auth: { token: "wrong", role: "support_agent" }
      })
    ).toThrow(/not authorized/i);
  });

  test("requires configured ops second factor when MFA is enabled", async () => {
    await withOpsMfaEnv({ enabled: "true", code: "654321" }, () => {
      expect(() =>
        listOpsOrders({
          auth: adminAuth
        })
      ).toThrow(/second factor/i);
      expect(() =>
        listOpsOrders({
          auth: { ...adminAuth, mfa_code: "wrong" }
        })
      ).toThrow(/second factor/i);

      const response = listOpsOrders({
        auth: { ...adminAuth, mfa_code: "654321" }
      });

      expect(response.privacy.stores_full_birth_date).toBe(false);
    });
  });

  test("fails closed when ops MFA is enabled without a configured code", async () => {
    await withOpsMfaEnv({ enabled: "true" }, () => {
      expect(() =>
        getLaunchOperationsDashboard({
          auth: { ...adminAuth, mfa_code: "654321" }
        })
      ).toThrow(/not configured/i);
    });
  });

  test("rejects zero-value manual refund requests instead of treating them as full refunds", () => {
    const { order } = createFulfilledOrder("member_ops_zero_refund");

    expect(() =>
      markOpsManualRefund({
        auth: adminAuth,
        order_id: order.order_id,
        amount_cents: 0,
        reason: "zero-value refund request",
        ticket_id: "ticket_zero_phase10"
      })
    ).toThrow(/partial refund amount/i);
  });

  test("lists rule versions for ops without exposing sensitive runtime data", () => {
    const response = listOpsRuleProfiles({
      auth: { token: "phase10_admin_token", role: "content_reviewer", actor_id: "reviewer_rules" }
    });

    expect(response.active_default_profile_id).toBe("default_ziwei_v0_1");
    expect(response.profiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          profile_id: "default_ziwei_v0_1",
          version_id: "rules_v0.2",
          consultant_review_status: "confirmed",
          is_active_default: true,
          can_promote_to_default: true
        }),
        expect.objectContaining({
          profile_id: "experimental_sanhe_v0_1",
          version_id: "rules_v0.2-exp",
          consultant_review_status: "experimental",
          is_active_default: false,
          can_promote_to_default: false
        })
      ])
    );
    expect(response.privacy).toMatchObject({
      admin_required: true,
      raw_birth_data_hidden: true,
      report_body_hidden: true,
      prompt_body_hidden: true
    });
    expect(JSON.stringify(response)).not.toMatch(/2000-08-16|03:30|Shanghai|openid|prompt body|report body/i);
  });

  test("promotes only consultant-confirmed rule profiles with second confirmation and audit logging", () => {
    expect(() =>
      promoteOpsRuleProfile({
        auth: { token: "phase10_admin_token", role: "support_agent", actor_id: "support_rules" },
        profile_id: "default_ziwei_v0_1",
        reason: "support should not promote",
        second_confirmed: true
      })
    ).toThrow(/role is not allowed/i);

    expect(() =>
      promoteOpsRuleProfile({
        auth: { ...adminAuth, actor_id: "ops_rules_lead" },
        profile_id: "default_ziwei_v0_1",
        reason: "missing second confirmation",
        second_confirmed: false
      })
    ).toThrow(/second confirmation/i);

    expect(() =>
      promoteOpsRuleProfile({
        auth: { ...adminAuth, actor_id: "ops_rules_lead" },
        profile_id: "experimental_sanhe_v0_1",
        reason: "production promotion review for 2000-08-16 03:30 Shanghai",
        second_confirmed: true
      })
    ).toThrow(/consultant-confirmed/i);

    const promoted = promoteOpsRuleProfile({
      auth: { ...adminAuth, actor_id: "ops_rules_lead" },
      profile_id: "default_ziwei_v0_1",
      reason: "consultant baseline remains default after 2000-08-16 03:30 Shanghai review",
      second_confirmed: true
    });
    const auditLogs = listOpsAdminAuditLogs({ auth: adminAuth });
    const persistedRuleDefault = productRepository.getActiveRuleVersionState();

    expect(promoted.previous_default_profile_id).toBe("default_ziwei_v0_1");
    expect(promoted.active_default_profile_id).toBe("default_ziwei_v0_1");
    expect(promoted.promoted_profile).toMatchObject({
      profile_id: "default_ziwei_v0_1",
      version_id: "rules_v0.2",
      consultant_review_status: "confirmed",
      is_active_default: true
    });
    expect(listRuleProfiles().default_profile_id).toBe("default_ziwei_v0_1");
    expect(promoted.audit_log.action).toBe("ops_rule_profile_promoted");
    expect(promoted.audit_log.actor_id).toBe("ops:ops_admin");
    expect(promoted.audit_log.metadata.reason).toContain("[birth_date_redacted]");
    expect(promoted.audit_log.metadata.reason).toContain("[birth_time_redacted]");
    expect(promoted.audit_log.metadata.reason).toContain("[location_redacted]");
    expect(persistedRuleDefault).toMatchObject({
      rule_version_id: "rules_v0.2",
      profile_id: "default_ziwei_v0_1",
      active_default: true,
      status: "confirmed"
    });
    expect(auditLogs.logs).toEqual(expect.arrayContaining([expect.objectContaining({ audit_log_id: promoted.audit_log.audit_log_id })]));
    expect(JSON.stringify({ promoted, auditLogs, persistedRuleDefault })).not.toMatch(/2000-08-16|03:30|Shanghai|openid|raw_prompt_secret|full_report_body/i);
  });
});
