import type { LaunchPaymentConfig, LaunchPaymentConfigInput, PaymentLaunchGateRequest, PaymentLaunchGateResult, PaymentProvider } from "./types.js";

export function resolveChinaPaymentProviderReadiness(): NonNullable<LaunchPaymentConfig["china_payment_providers"]> {
  const wechatRequiredEnv = [
    "WECHAT_PAY_MCH_ID",
    "WECHAT_PAY_APP_ID",
    "WECHAT_PAY_API_V3_KEY",
    "WECHAT_PAY_MERCHANT_CERT_SERIAL",
    "WECHAT_PAY_PRIVATE_KEY",
    "WECHAT_PAY_PLATFORM_CERT",
    "WECHAT_PAY_PLATFORM_CERT_SERIAL",
    "WECHAT_PAY_NOTIFY_URL",
    "WECHAT_PAY_CHECKOUT_BASE_URL"
  ] as const;
  const alipayRequiredEnv = [
    "ALIPAY_APP_ID",
    "ALIPAY_PRIVATE_KEY",
    "ALIPAY_PUBLIC_KEY",
    "ALIPAY_GATEWAY_URL",
    "ALIPAY_NOTIFY_URL",
    "ALIPAY_CHECKOUT_BASE_URL"
  ] as const;
  const wechatReady = wechatRequiredEnv.every((key) => Boolean(process.env[key]?.trim()));
  const alipayReady = alipayRequiredEnv.every((key) => Boolean(process.env[key]?.trim()));

  return {
    wechat_pay: {
      provider: "wechat_pay_reserved",
      ready: wechatReady,
      provider_mode: wechatReady ? "production" : "sandbox",
      requiredEnv: wechatRequiredEnv,
      callback_signature_header: "wechatpay-signature",
      blockers: wechatReady
        ? []
        : ["Configure WeChat Pay merchant credentials, API v3 key, certificates, notify URL, and checkout base URL before production traffic."]
    },
    alipay: {
      provider: "alipay_reserved",
      ready: alipayReady,
      provider_mode: alipayReady ? "production" : "sandbox",
      requiredEnv: alipayRequiredEnv,
      callback_signature_header: "alipay-signature",
      blockers: alipayReady
        ? []
        : ["Configure Alipay app credentials, keys, gateway, notify URL, and checkout base URL before production traffic."]
    }
  };
}

export function resolveBaseLaunchPaymentConfig(input: LaunchPaymentConfigInput = {}): Omit<
  LaunchPaymentConfig,
  "database" | "birth_data_encryption" | "login" | "wechat_share" | "ops_security" | "rate_limit" | "export_storage" | "observability"
> {
  const stripeKey = input.stripe_secret_key ?? process.env.STRIPE_SECRET_KEY ?? "";
  const hasLiveKey = stripeKey.startsWith("sk_live_");
  const webhookSecretConfigured = input.webhook_secret_configured ?? Boolean(process.env.STRIPE_WEBHOOK_SECRET || process.env.PHASE10_WEBHOOK_SECRET_CONFIGURED === "true");
  const productionEnabled = input.production_payment_enabled ?? process.env.PHASE10_PRODUCTION_PAYMENT_ENABLED === "true";
  const rollbackEnabled = input.rollback_enabled ?? process.env.PHASE10_PAYMENT_ROLLBACK === "true";
  const rolloutPercent = clampPercent(input.rollout_percent ?? Number(process.env.PHASE10_PAYMENT_ROLLOUT_PERCENT ?? 0));
  const maxProductionAmount = input.max_production_amount_cents ?? Number(process.env.PHASE10_MAX_PRODUCTION_AMOUNT_CENTS ?? 9900);
  const sandboxCheckoutConfirmEnabled = input.sandbox_checkout_confirm_enabled ?? process.env.ZIWEI_ENABLE_SANDBOX_CHECKOUT_CONFIRM === "true";
  const productionReady = hasLiveKey && webhookSecretConfigured && productionEnabled && !rollbackEnabled && rolloutPercent > 0;

  return {
    provider: "stripe_checkout",
    provider_mode: productionReady ? "production" : "sandbox",
    production_payment_enabled: productionEnabled,
    rollout_percent: rolloutPercent,
    rollback_enabled: rollbackEnabled,
    webhook_secret_configured: webhookSecretConfigured,
    max_production_amount_cents: Number.isFinite(maxProductionAmount) && maxProductionAmount > 0 ? maxProductionAmount : 9900,
    public_status: rollbackEnabled
      ? "rollback_active"
      : !webhookSecretConfigured && productionEnabled
        ? "needs_webhook_secret"
        : productionReady
          ? "production_ready"
          : "sandbox_only",
    sandbox_checkout_confirm: {
      enabled: sandboxCheckoutConfirmEnabled,
      production_safe: false,
      route: "/api/checkout/sandbox/confirm",
      page: "/commercial/checkout-sandbox",
      requiredEnv: ["ZIWEI_ENABLE_SANDBOX_CHECKOUT_CONFIRM"],
      allowedEnvironments: ["local", "test", "preproduction"],
      blockers: sandboxCheckoutConfirmEnabled
        ? [
            "Disable ZIWEI_ENABLE_SANDBOX_CHECKOUT_CONFIRM for production traffic; production fulfillment must come from verified WeChat Pay or Alipay webhooks."
          ]
        : []
    },
    china_payment_providers: resolveChinaPaymentProviderReadiness()
  };
}

export function evaluatePaymentLaunchGate(request: PaymentLaunchGateRequest): PaymentLaunchGateResult {
  const config = request.config ?? resolveBaseLaunchPaymentConfig();
  const rolloutBucket = stableBucket(request.member_id);
  if (config.rollback_enabled) {
    return { allowed: false, reason: "rollback_enabled", rollout_bucket: rolloutBucket, provider_mode: "sandbox" };
  }
  if (!config.production_payment_enabled) {
    return { allowed: false, reason: "production_disabled", rollout_bucket: rolloutBucket, provider_mode: "sandbox" };
  }
  if (!config.webhook_secret_configured) {
    return { allowed: false, reason: "webhook_secret_missing", rollout_bucket: rolloutBucket, provider_mode: "sandbox" };
  }
  if (request.amount_cents > config.max_production_amount_cents) {
    return { allowed: false, reason: "amount_exceeds_limit", rollout_bucket: rolloutBucket, provider_mode: "sandbox" };
  }
  if (rolloutBucket >= config.rollout_percent) {
    return { allowed: false, reason: "outside_rollout", rollout_bucket: rolloutBucket, provider_mode: "sandbox" };
  }
  if (!isSelectedChinaPaymentProviderReady(config, request.provider)) {
    return { allowed: false, reason: "china_payment_provider_not_ready", rollout_bucket: rolloutBucket, provider_mode: "sandbox" };
  }
  return { allowed: true, reason: "production_allowed", rollout_bucket: rolloutBucket, provider_mode: config.provider_mode };
}

export function isChinaPaymentProviderProductionReady(provider: PaymentProvider): boolean {
  const readiness = resolveChinaPaymentProviderReadiness();
  if (provider === "wechat_pay_reserved") return readiness.wechat_pay.ready;
  if (provider === "alipay_reserved") return readiness.alipay.ready;
  return false;
}

function isSelectedChinaPaymentProviderReady(config: LaunchPaymentConfig, provider?: PaymentProvider): boolean {
  if (provider === "wechat_pay_reserved") return Boolean(config.china_payment_providers?.wechat_pay.ready);
  if (provider === "alipay_reserved") return Boolean(config.china_payment_providers?.alipay.ready);
  return Boolean(config.china_payment_providers?.wechat_pay.ready || config.china_payment_providers?.alipay.ready);
}

function stableBucket(value: string): number {
  const text = String(value || "anonymous")
    .replace(/\s+/g, " ")
    .trim();
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 100;
  }
  return hash;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}
