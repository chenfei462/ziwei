import { createHash, createHmac, createVerify, randomBytes, timingSafeEqual } from "node:crypto";
import { evaluatePaymentLaunchGate, isChinaPaymentProviderProductionReady, resolveBaseLaunchPaymentConfig } from "../paymentLaunchGate.js";
import { ApiError } from "../errors.js";
import {
  getReportDraftRecord,
} from "../store.js";
import { productRepository } from "../repositories/productRepository.js";
import {
  orderPackageIds,
  paymentProviders,
  reportTierIds,
  type CheckoutSession,
  type CheckoutSessionRequest,
  type CommercialDashboardSummary,
  type CommercialPrivacy,
  type MemberEntitlement,
  type MemberEntitlementSummary,
  type Order,
  type OrderCreateRequest,
  type OrderPackageId,
  type PaymentEvent,
  type PaymentProvider,
  type PaymentWebhookRequest,
  type RefundRecord,
  type ReportTierId,
  type ReportType
} from "../types.js";

const privacy: CommercialPrivacy = {
  stores_full_birth_date: false,
  stores_birth_time: false,
  stores_location_detail: false,
  stores_video_frame: false
};

const privacyNote = "full birth date, birth time, and location detail hidden by default.";
const tierPrices: Record<ReportTierId, { amount_cents: number; currency: "cny" }> = {
  starter_19: { amount_cents: 1900, currency: "cny" },
  standard_49: { amount_cents: 4900, currency: "cny" },
  premium_99: { amount_cents: 9900, currency: "cny" }
};

type EntitlementProfile = Pick<MemberEntitlement, "access_level" | "benefits" | "can_read_report" | "export_preview_credits" | "favorite_enabled">;

const tierEntitlementProfiles: Record<ReportTierId, Required<EntitlementProfile>> = {
  starter_19: {
    access_level: "free_summary",
    benefits: ["free_summary", "redacted_share"],
    can_read_report: false,
    export_preview_credits: 1,
    favorite_enabled: false
  },
  standard_49: {
    access_level: "standard_report",
    benefits: ["full_report_read", "export_preview", "favorite_report"],
    can_read_report: true,
    export_preview_credits: 3,
    favorite_enabled: true
  },
  premium_99: {
    access_level: "premium_report",
    benefits: ["full_report_read", "export_preview", "favorite_report", "priority_support"],
    can_read_report: true,
    export_preview_credits: 6,
    favorite_enabled: true
  }
};

type RefundContext = {
  requested_by?: string;
  ticket_id?: string;
  provider_refund_id?: string;
};

export function createOrder(request: OrderCreateRequest): Order {
  validateOrderRequest(request);
  const draft = getReportDraftRecord(request.report_id);
  if (!draft) {
    throw new ApiError("REPORT_NOT_FOUND", "report draft not found.", { field: "report_id", status: 404 });
  }
  if (draft.review.status !== "approved") {
    throw new ApiError("REPORT_REVIEW_REQUIRED", "report must pass content review before an order can be created.", {
      field: "review_status",
      status: 409
    });
  }

  const now = new Date().toISOString();
  const price = tierPrices[request.tier_id];
  const order: Order = {
    order_id: createId("order"),
    report_id: sanitizeText(request.report_id),
    member_id: sanitizeText(request.member_id || "anonymous_member"),
    package_id: request.package_id,
    tier_id: request.tier_id,
    report_type: draft.report_type,
    amount_cents: price.amount_cents,
    currency: price.currency,
    status: "created",
    payment_provider: normalizeProvider(request.provider ?? "wechat_pay_reserved"),
    created_at: now,
    updated_at: now,
    compliance: {
      service_terms_accepted: request.consent.service_terms,
      privacy_policy_accepted: request.consent.privacy_policy,
      refund_policy_accepted: request.consent.refund_policy,
      cultural_entertainment_only: request.consent.cultural_entertainment_only
    },
    privacy
  };

  productRepository.saveOrder(order);
  return order;
}

export function getOrder(orderId: string): Order | undefined {
  return orderId ? productRepository.getOrder(orderId) : undefined;
}

export function listOrders(memberId?: string): { orders: Order[]; privacy: CommercialPrivacy } {
  return {
    orders: productRepository.listOrders(memberId).sort((left, right) => right.created_at.localeCompare(left.created_at)),
    privacy
  };
}

export function createCheckoutSession(request: CheckoutSessionRequest): CheckoutSession {
  const provider = normalizeProvider(request?.provider);
  if (!request?.success_url || !request.cancel_url) {
    throw new ApiError("CHECKOUT_URL_REQUIRED", "success_url and cancel_url are required.", { field: "success_url" });
  }

  const order = productRepository.getOrder(request.order_id);
  if (!order) {
    throw new ApiError("ORDER_NOT_FOUND", "order not found.", { field: "order_id", status: 404 });
  }
  if (!["created", "pending_payment"].includes(order.status)) {
    throw new ApiError("ORDER_NOT_CHECKOUT_ELIGIBLE", "order is not eligible for checkout.", {
      field: "order_status",
      status: 409
    });
  }
  const providerMode = resolveProviderMode(provider);
  assertProductionCheckoutAllowed(provider, order.amount_cents, order.member_id, providerMode);

  const now = new Date();
  const existingSession = productRepository.findCheckoutSessionByOrder(order.order_id);
  const checkoutSessionId = existingSession?.checkout_session_id ?? createId("cs");
  const rawBody = JSON.stringify({
    event_id: createId("evt"),
    provider_event_id: createId(provider === "wechat_pay_reserved" ? "wx_evt" : provider === "alipay_reserved" ? "ali_evt" : "evt"),
    type: "checkout.session.completed",
    provider,
    data: {
      checkout_session_id: checkoutSessionId,
      order_id: order.order_id,
      payment_status: "paid",
      amount_total: order.amount_cents,
      currency: order.currency
    }
  });
  const session: CheckoutSession = {
    checkout_session_id: checkoutSessionId,
    order_id: order.order_id,
    provider,
    provider_mode: providerMode,
    checkout_url: buildCheckoutUrl(provider, checkoutSessionId, order.order_id, request.success_url, request.cancel_url),
    status: "open",
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    provider_requirements: getProviderAdapter(provider).requirements,
    sandbox_webhook:
      providerMode === "sandbox"
        ? {
            raw_body: rawBody,
            signature_header: signWebhookPayload(provider, rawBody)
          }
        : undefined
  };

  const updatedOrder: Order = {
    ...order,
    status: "pending_payment",
    payment_provider: provider,
    checkout_session_id: session.checkout_session_id,
    updated_at: now.toISOString()
  };
  productRepository.saveOrder(updatedOrder);
  productRepository.saveCheckoutSession(session);
  return session;
}

function assertProductionCheckoutAllowed(provider: PaymentProvider, amountCents: number, memberId: string, providerMode: "sandbox" | "production"): void {
  if (providerMode !== "production") return;
  const gate = evaluatePaymentLaunchGate({
    member_id: memberId,
    amount_cents: amountCents,
    provider,
    config: resolveBaseLaunchPaymentConfig()
  });
  if (!gate.allowed) {
    throw new ApiError("PAYMENT_PROVIDER_NOT_READY", `selected payment provider is not ready for production checkout: ${gate.reason}.`, {
      field: "provider",
      status: 503
    });
  }
}

export function confirmSandboxCheckout(checkoutSessionId: string): PaymentEvent {
  assertSandboxCheckoutConfirmationEnabled();
  const sessionId = sanitizeText(checkoutSessionId);
  if (!sessionId) {
    throw new ApiError("CHECKOUT_SESSION_REQUIRED", "checkout session id is required.", { field: "session_id" });
  }

  const session = productRepository.getCheckoutSession(sessionId);
  if (!session) {
    throw new ApiError("CHECKOUT_SESSION_NOT_FOUND", "checkout session not found.", { field: "session_id", status: 404 });
  }
  if (session.provider_mode !== "sandbox" || !session.sandbox_webhook) {
    throw new ApiError("CHECKOUT_SANDBOX_CONFIRM_UNAVAILABLE", "sandbox checkout confirmation is only available for sandbox sessions.", {
      field: "session_id",
      status: 409
    });
  }
  if (session.status !== "open" && session.status !== "completed") {
    throw new ApiError("CHECKOUT_SANDBOX_CONFIRM_UNAVAILABLE", "sandbox checkout confirmation is unavailable unless the session is open.", {
      field: "session_id",
      status: 409
    });
  }
  const expiresAtMs = Date.parse(session.expires_at);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) {
    throw new ApiError("CHECKOUT_SESSION_EXPIRED", "checkout session has expired.", { field: "session_id", status: 409 });
  }

  return processPaymentWebhook({
    provider: session.provider,
    raw_body: session.sandbox_webhook.raw_body,
    signature: session.sandbox_webhook.signature_header
  });
}

export function processPaymentWebhook(request: PaymentWebhookRequest): PaymentEvent {
  const provider = normalizeProvider(request?.provider);
  verifyWebhookSignature(provider, request.raw_body, request.signature);
  const payload = parseWebhookPayload(request.raw_body);
  const payloadProvider = payload.provider ? normalizeProvider(String(payload.provider) as PaymentProvider) : undefined;
  if (payloadProvider && payloadProvider !== provider) {
    throw new ApiError("PAYMENT_PROVIDER_MISMATCH", "webhook payload provider does not match the verified provider.", { field: "provider", status: 409 });
  }
  const eventId = sanitizeText(String(payload.event_id ?? payload.id ?? ""));
  const eventType = sanitizeText(String(payload.type ?? ""));
  if (!eventId || !eventType) {
    throw new ApiError("PAYMENT_WEBHOOK_INVALID", "payment webhook event_id and type are required.", { field: "raw_body" });
  }

  const providerEventId = sanitizeText(String(payload.provider_event_id ?? payload.id ?? eventId));
  const paymentEventId = `${provider}:${providerEventId}`;
  const existingEvent = productRepository.getPaymentEvent(paymentEventId);
  if (existingEvent) {
    return { ...existingEvent, is_duplicate: true };
  }

  const checkoutSessionId = sanitizeText(
    String(payload.data?.checkout_session_id ?? payload.data?.object?.id ?? payload.data?.object?.checkout_session_id ?? "")
  );
  const orderId = sanitizeText(
    String(payload.data?.order_id ?? payload.data?.object?.metadata?.order_id ?? payload.data?.object?.client_reference_id ?? "")
  );
  const session = checkoutSessionId ? productRepository.getCheckoutSession(checkoutSessionId) : undefined;
  const order = productRepository.getOrder(orderId || session?.order_id || "");
  if (!order || !session) {
    throw new ApiError("PAYMENT_ORDER_NOT_FOUND", "payment webhook could not resolve an order.", { field: "order_id", status: 404 });
  }
  if (session.provider !== provider || order.payment_provider !== provider) {
    throw new ApiError("PAYMENT_PROVIDER_MISMATCH", "webhook provider does not match the checkout session.", {
      field: "provider",
      status: 409
    });
  }

  const updatedOrder = applyPaymentEvent(order, session, eventType);
  const event: PaymentEvent = {
    payment_event_id: paymentEventId,
    provider,
    event_type: eventType,
    checkout_session_id: session.checkout_session_id,
    order_id: updatedOrder.order_id,
    received_at: new Date().toISOString(),
    signature_verified: true,
    is_duplicate: false,
    order: updatedOrder
  };
  productRepository.savePaymentEvent(event);
  return event;
}

export function getReportEntitlement(reportId: string, memberId = "anonymous_member"): MemberEntitlement {
  const entitlement = productRepository.getMemberEntitlement(memberId, reportId);
  if (entitlement) return entitlement;

  return {
    entitlement_id: createId("ent_none"),
    member_id: sanitizeText(memberId),
    report_id: sanitizeText(reportId),
    source_order_id: "",
    has_access: false,
    can_read_report: false,
    export_preview_credits: 0,
    favorite_enabled: false,
    created_at: new Date().toISOString(),
    privacy_note: privacyNote
  };
}

export function getMemberEntitlements(memberId = "anonymous_member"): MemberEntitlementSummary {
  const entitlements = productRepository.listMemberEntitlements(memberId);
  return {
    member_id: sanitizeText(memberId),
    purchased_report_ids: entitlements.filter((entitlement) => entitlement.has_access).map((entitlement) => entitlement.report_id),
    light_membership_active: entitlements.some((entitlement) => {
      const order = productRepository.getOrder(entitlement.source_order_id);
      return order?.package_id === "light_membership" && order.status === "fulfilled";
    }),
    entitlements,
    privacy
  };
}

export function getCommercialDashboard(): CommercialDashboardSummary {
  const orders = productRepository.listOrders();
  const completedOrders = orders.filter((order) => ["paid", "fulfilled"].includes(normalizeStoredOrderStatus(order.status)));
  const totalRevenue = completedOrders.reduce((sum, order) => sum + order.amount_cents, 0);
  const reportTypeCounts = createReportTypeCounts();
  const providerCounts = createProviderCounts();
  for (const order of orders) {
    reportTypeCounts[order.report_type] += 1;
    providerCounts[order.payment_provider] += 1;
  }

  return {
    total_orders: orders.length,
    pending_orders: orders.filter((order) => normalizeStoredOrderStatus(order.status) === "pending_payment").length,
    paid_orders: orders.filter((order) => normalizeStoredOrderStatus(order.status) === "paid").length,
    fulfilled_orders: orders.filter((order) => normalizeStoredOrderStatus(order.status) === "fulfilled").length,
    failed_orders: orders.filter((order) => normalizeStoredOrderStatus(order.status) === "failed").length,
    cancelled_orders: orders.filter((order) => normalizeStoredOrderStatus(order.status) === "cancelled").length,
    refunded_orders: orders.filter((order) => normalizeStoredOrderStatus(order.status) === "refunded").length,
    partially_refunded_orders: orders.filter((order) => normalizeStoredOrderStatus(order.status) === "partially_refunded").length,
    refunded_manual_orders: orders.filter((order) => normalizeStoredOrderStatus(order.status) === "refunded").length,
    payment_conversion_rate: orders.length ? completedOrders.length / orders.length : 0,
    average_order_value_cents: completedOrders.length ? Math.round(totalRevenue / completedOrders.length) : 0,
    report_type_counts: reportTypeCounts,
    content_review_block_rate: 0,
    payment_provider_counts: providerCounts,
    privacy
  };
}

export function markManualRefund(orderId: string, reason = "manual_support_review", context: RefundContext = {}): Order {
  const order = productRepository.getOrder(orderId);
  if (!order) {
    throw new ApiError("ORDER_NOT_FOUND", "order not found.", { field: "order_id", status: 404 });
  }
  if (!["paid", "fulfilled", "partially_refunded"].includes(order.status)) {
    throw new ApiError("ORDER_NOT_REFUND_ELIGIBLE", "order is not eligible for a refund.", { field: "order_status", status: 409 });
  }
  const alreadyRefunded = productRepository.listRefundRecords(order.order_id)
    .filter((refund) => refund.status === "requested" || refund.status === "succeeded")
    .reduce((sum, refund) => sum + refund.amount_cents, 0);
  const remaining = order.amount_cents - alreadyRefunded;
  if (remaining <= 0) {
    throw new ApiError("ORDER_ALREADY_REFUNDED", "order has already been fully refunded.", { field: "order_status", status: 409 });
  }
  const now = new Date().toISOString();
  const sanitizedReason = sanitizeText(reason);
  const updatedOrder = {
    ...order,
    status: "refunded" as const,
    updated_at: now,
    refunded_at: now,
    refunded_amount_cents: alreadyRefunded + remaining,
    refund_reason: sanitizedReason
  };
  productRepository.saveOrder(updatedOrder);
  productRepository.saveRefundRecord(
    createRefundRecord({
      order: updatedOrder,
      amount_cents: remaining,
      reason: sanitizedReason,
      context,
      created_at: now
    })
  );
  revokeEntitlementForRefund(updatedOrder);
  return updatedOrder;
}

export function markPartialRefund(orderId: string, amountCents: number, reason = "manual_support_review", context: RefundContext = {}): Order {
  const order = productRepository.getOrder(orderId);
  if (!order) {
    throw new ApiError("ORDER_NOT_FOUND", "order not found.", { field: "order_id", status: 404 });
  }
  if (!["paid", "fulfilled", "partially_refunded"].includes(order.status)) {
    throw new ApiError("ORDER_NOT_REFUND_ELIGIBLE", "order is not eligible for a partial refund.", { field: "order_status", status: 409 });
  }
  const refundedSoFar = productRepository.listRefundRecords(order.order_id)
    .filter((refund) => refund.status === "requested" || refund.status === "succeeded")
    .reduce((sum, refund) => sum + refund.amount_cents, 0);
  const remaining = order.amount_cents - refundedSoFar;
  if (!Number.isFinite(amountCents) || amountCents <= 0 || amountCents > remaining) {
    throw new ApiError("PARTIAL_REFUND_AMOUNT_INVALID", "partial refund amount must be greater than 0 and no greater than the remaining order balance.", {
      field: "amount_cents"
    });
  }
  const now = new Date().toISOString();
  const roundedAmount = Math.round(amountCents);
  if (roundedAmount <= 0 || roundedAmount > remaining) {
    throw new ApiError("PARTIAL_REFUND_AMOUNT_INVALID", "refund amount must be at least one cent.", { field: "amount_cents" });
  }
  const sanitizedReason = sanitizeText(reason);
  const totalRefunded = refundedSoFar + roundedAmount;
  const fullyRefunded = totalRefunded >= order.amount_cents;
  const updatedOrder: Order = {
    ...order,
    status: fullyRefunded ? "refunded" : "partially_refunded",
    updated_at: now,
    refunded_at: now,
    refunded_amount_cents: totalRefunded,
    refund_reason: sanitizedReason
  };
  productRepository.saveOrder(updatedOrder);
  productRepository.saveRefundRecord(
    createRefundRecord({
      order: updatedOrder,
      amount_cents: roundedAmount,
      reason: sanitizedReason,
      context,
      created_at: now
    })
  );
  if (fullyRefunded) revokeEntitlementForRefund(updatedOrder);
  return updatedOrder;
}

export function grantManualEntitlement(request: {
  member_id: string;
  report_id: string;
  source_order_id: string;
  tier_id?: ReportTierId;
  export_preview_credits?: number;
}): MemberEntitlement {
  const draft = getReportDraftRecord(request.report_id);
  const profile = request.tier_id ? tierEntitlementProfiles[request.tier_id] : undefined;
  const entitlement: MemberEntitlement = {
    entitlement_id: createId("ent_manual"),
    member_id: sanitizeText(request.member_id),
    report_id: sanitizeText(request.report_id),
    source_order_id: sanitizeText(request.source_order_id),
    tier_id: request.tier_id,
    access_level: profile?.access_level ?? "manual_full_access",
    benefits: profile?.benefits ?? ["full_report_read", "export_preview", "favorite_report", "manual_reissue"],
    has_access: true,
    can_read_report: profile?.can_read_report ?? true,
    export_preview_credits: request.export_preview_credits ?? profile?.export_preview_credits ?? 3,
    favorite_enabled: profile?.favorite_enabled ?? true,
    created_at: new Date().toISOString(),
    privacy_note: privacyNote,
    report_snapshot: draft
  };
  productRepository.saveMemberEntitlement(entitlement);
  return entitlement;
}

function createRefundRecord(input: {
  order: Order;
  amount_cents: number;
  reason: string;
  context: RefundContext;
  created_at: string;
}): RefundRecord {
  const providerRefundId = input.context.provider_refund_id ? sanitizeText(input.context.provider_refund_id) : undefined;
  const refundId = createRefundId(input.order.order_id, input.amount_cents, input.created_at, providerRefundId);
  return {
    refund_id: refundId,
    order_id: input.order.order_id,
    provider: input.order.payment_provider,
    provider_refund_id: providerRefundId,
    amount_cents: input.amount_cents,
    status: "succeeded",
    reason: input.reason,
    requested_by: sanitizeText(input.context.requested_by ?? "ops_admin:manual_support_review"),
    ticket_id: input.context.ticket_id ? sanitizeText(input.context.ticket_id) : undefined,
    provider_refund_request: createProviderRefundRequestEnvelope(input.order, input.amount_cents, input.reason, refundId),
    created_at: input.created_at,
    updated_at: input.created_at,
    privacy_note: "Refund record stores order/provider finance metadata only; raw birth data, phone, third-party identities, and full report content are not persisted."
  };
}

function createProviderRefundRequestEnvelope(
  order: Order,
  amountCents: number,
  reason: string,
  refundId: string
): NonNullable<RefundRecord["provider_refund_request"]> {
  const commonPayload = {
    refund_id: refundId,
    order_id: order.order_id,
    checkout_session_id: order.checkout_session_id ?? "",
    amount_cents: amountCents,
    total_amount_cents: order.amount_cents,
    currency: order.currency,
    reason
  };
  if (order.payment_provider === "wechat_pay_reserved") {
    const payload = JSON.stringify({
      out_trade_no: order.order_id,
      out_refund_no: refundId,
      reason,
      amount: {
        refund: amountCents,
        total: order.amount_cents,
        currency: order.currency.toUpperCase()
      }
    });
    return {
      provider: "wechat_pay_reserved",
      method: "POST",
      endpoint: "/v3/refund/domestic/refunds",
      idempotency_key: `refund:${refundId}`,
      signature_algorithm: "WECHATPAY2-SHA256-RSA2048",
      signed_payload_digest: digestPayload(payload),
      submission_status: isWechatRefundConfigReady() ? "sandbox_ready" : "external_configuration_required",
      requiredEnv: [
        "WECHAT_PAY_MCH_ID",
        "WECHAT_PAY_APP_ID",
        "WECHAT_PAY_API_V3_KEY",
        "WECHAT_PAY_MERCHANT_CERT_SERIAL",
        "WECHAT_PAY_PRIVATE_KEY",
        "WECHAT_PAY_PLATFORM_CERT",
        "WECHAT_PAY_PLATFORM_CERT_SERIAL"
      ],
      privacy_note: "Provider refund request stores endpoint, digest, idempotency key, and required env names only; raw birth data and private keys are not persisted."
    };
  }
  if (order.payment_provider === "alipay_reserved") {
    const payload = new URLSearchParams({
      method: "alipay.trade.refund",
      out_trade_no: order.order_id,
      out_request_no: refundId,
      refund_amount: (amountCents / 100).toFixed(2),
      refund_reason: reason
    }).toString();
    return {
      provider: "alipay_reserved",
      method: "POST",
      endpoint: "alipay.trade.refund",
      idempotency_key: `refund:${refundId}`,
      signature_algorithm: "RSA2",
      signed_payload_digest: digestPayload(payload),
      submission_status: isAlipayRefundConfigReady() ? "sandbox_ready" : "external_configuration_required",
      requiredEnv: ["ALIPAY_APP_ID", "ALIPAY_PRIVATE_KEY", "ALIPAY_PUBLIC_KEY", "ALIPAY_GATEWAY_URL"],
      privacy_note: "Provider refund request stores endpoint, digest, idempotency key, and required env names only; raw birth data and private keys are not persisted."
    };
  }
  return {
    provider: order.payment_provider,
    method: "POST",
    endpoint: "mock.refund",
    idempotency_key: `refund:${refundId}`,
    signature_algorithm: "HMAC-SHA256",
    signed_payload_digest: digestPayload(JSON.stringify(commonPayload)),
    submission_status: "mock_submitted",
    requiredEnv: ["MOCK_PAYMENT_WEBHOOK_SECRET"],
    privacy_note: "Mock refund request metadata is test-only and does not persist raw birth data."
  };
}

function isWechatRefundConfigReady(): boolean {
  return Boolean(
    process.env.WECHAT_PAY_MCH_ID?.trim() &&
      process.env.WECHAT_PAY_API_V3_KEY?.trim() &&
      process.env.WECHAT_PAY_MERCHANT_CERT_SERIAL?.trim() &&
      process.env.WECHAT_PAY_PRIVATE_KEY?.trim()
  );
}

function isAlipayRefundConfigReady(): boolean {
  return Boolean(process.env.ALIPAY_APP_ID?.trim() && process.env.ALIPAY_PRIVATE_KEY?.trim() && process.env.ALIPAY_PUBLIC_KEY?.trim() && process.env.ALIPAY_GATEWAY_URL?.trim());
}

function digestPayload(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}

function validateOrderRequest(request: OrderCreateRequest): void {
  if (!request?.report_id) {
    throw new ApiError("REPORT_NOT_FOUND", "report_id is required.", { field: "report_id", status: 404 });
  }
  if (!orderPackageIds.includes(request.package_id)) {
    throw new ApiError("INVALID_ORDER_PACKAGE", "package_id must be single_report or light_membership.", { field: "package_id" });
  }
  if (!reportTierIds.includes(request.tier_id)) {
    throw new ApiError("INVALID_REPORT_TIER", "tier_id must be starter_19, standard_49, or premium_99.", { field: "tier_id" });
  }
  if (
    !request.consent?.agreed ||
    !request.consent.service_terms ||
    !request.consent.privacy_policy ||
    !request.consent.refund_policy ||
    !request.consent.cultural_entertainment_only
  ) {
    throw new ApiError("ORDER_CONSENT_REQUIRED", "commercial consent, service terms, privacy policy, refund policy, and cultural entertainment disclaimer are required.", {
      field: "consent"
    });
  }
}

function assertSandboxCheckoutConfirmationEnabled(): void {
  if (process.env.NODE_ENV === "production" && process.env.ZIWEI_ENABLE_SANDBOX_CHECKOUT_CONFIRM !== "true") {
    throw new ApiError(
      "SANDBOX_CHECKOUT_CONFIRM_DISABLED",
      "sandbox checkout confirmation is disabled unless ZIWEI_ENABLE_SANDBOX_CHECKOUT_CONFIRM is explicitly enabled.",
      { field: "ZIWEI_ENABLE_SANDBOX_CHECKOUT_CONFIRM", status: 403 }
    );
  }
}

function applyPaymentEvent(order: Order, session: CheckoutSession, eventType: string): Order {
  const now = new Date().toISOString();
  const sessionUpdate: CheckoutSession = {
    ...session,
    status:
      eventType === "checkout.session.completed"
        ? "completed"
        : eventType === "checkout.session.expired" && session.status !== "completed"
          ? "expired"
          : session.status
  };
  productRepository.saveCheckoutSession(sessionUpdate);

  if (eventType === "checkout.session.completed") {
    if (["fulfilled", "paid", "refunded", "partially_refunded"].includes(order.status)) return order;
    const paidOrder: Order = {
      ...order,
      status: "paid",
      updated_at: now
    };
    const fulfilledOrder: Order = {
      ...paidOrder,
      status: "fulfilled",
      fulfilled_at: now,
      updated_at: now
    };
    productRepository.saveOrder(fulfilledOrder);
    if (!productRepository.getMemberEntitlement(fulfilledOrder.member_id, fulfilledOrder.report_id)?.has_access) {
      grantEntitlement(fulfilledOrder);
    }
    return fulfilledOrder;
  }

  if (eventType === "checkout.session.canceled") {
    if (!["created", "pending_payment"].includes(order.status)) return order;
    const canceledOrder: Order = {
      ...order,
      status: "cancelled",
      updated_at: now
    };
    productRepository.saveOrder(canceledOrder);
    return canceledOrder;
  }

  if (eventType === "checkout.session.expired" || eventType === "payment_intent.payment_failed") {
    if (!["created", "pending_payment"].includes(order.status)) return order;
    const failedOrder: Order = {
      ...order,
      status: "failed",
      updated_at: now
    };
    productRepository.saveOrder(failedOrder);
    return failedOrder;
  }

  productRepository.saveOrder(order);
  return order;
}

function grantEntitlement(order: Order): MemberEntitlement {
  const draft = getReportDraftRecord(order.report_id);
  const profile = tierEntitlementProfiles[order.tier_id];
  const entitlement: MemberEntitlement = {
    entitlement_id: createId("ent"),
    member_id: order.member_id,
    report_id: order.report_id,
    source_order_id: order.order_id,
    tier_id: order.tier_id,
    access_level: profile.access_level,
    benefits: profile.benefits,
    has_access: true,
    can_read_report: profile.can_read_report,
    export_preview_credits: order.package_id === "light_membership" ? Math.max(profile.export_preview_credits, 10) : profile.export_preview_credits,
    favorite_enabled: profile.favorite_enabled,
    created_at: new Date().toISOString(),
    privacy_note: privacyNote,
    report_snapshot: draft
  };
  productRepository.saveMemberEntitlement(entitlement);
  return entitlement;
}

function revokeEntitlementForRefund(order: Order): MemberEntitlement {
  const existing = productRepository.getMemberEntitlement(order.member_id, order.report_id);
  const entitlement: MemberEntitlement = {
    entitlement_id: existing?.entitlement_id ?? createId("ent_revoked"),
    member_id: order.member_id,
    report_id: order.report_id,
    source_order_id: order.order_id,
    tier_id: existing?.tier_id ?? order.tier_id,
    access_level: existing?.access_level,
    benefits: existing?.benefits,
    has_access: false,
    can_read_report: false,
    export_preview_credits: 0,
    favorite_enabled: false,
    created_at: new Date().toISOString(),
    privacy_note: `${privacyNote} Access revoked after refund.`,
    report_snapshot: existing?.report_snapshot
  };
  productRepository.saveMemberEntitlement(entitlement);
  return entitlement;
}

function normalizeStoredOrderStatus(status: Order["status"] | string): Order["status"] {
  if (status === "draft") return "created";
  if (status === "canceled") return "cancelled";
  if (status === "expired") return "failed";
  if (status === "refunded_manual") return "refunded";
  return status as Order["status"];
}

function parseWebhookPayload(rawBody: string): {
  event_id?: unknown;
  provider_event_id?: unknown;
  provider?: unknown;
  id?: unknown;
  type?: unknown;
  data?: {
    checkout_session_id?: unknown;
    order_id?: unknown;
    object?: {
      id?: unknown;
      checkout_session_id?: unknown;
      client_reference_id?: unknown;
      metadata?: {
        order_id?: unknown;
      };
    };
  };
} {
  const formPayload = parseFormWebhookPayload(rawBody);
  if (formPayload) return formPayload;
  try {
    return JSON.parse(rawBody) as ReturnType<typeof parseWebhookPayload>;
  } catch {
    throw new ApiError("PAYMENT_WEBHOOK_INVALID_JSON", "payment webhook body must be valid JSON.", { field: "raw_body" });
  }
}

function parseFormWebhookPayload(rawBody: string): ReturnType<typeof parseWebhookPayload> | undefined {
  const trimmed = rawBody.trim();
  if (!trimmed || trimmed.startsWith("{") || trimmed.startsWith("[")) return undefined;
  const params = new URLSearchParams(trimmed);
  if (!Array.from(params.keys()).length) return undefined;
  const orderId = params.get("order_id") ?? params.get("out_trade_no") ?? "";
  const checkoutSessionId = params.get("checkout_session_id") ?? params.get("passback_params") ?? "";
  const tradeStatus = params.get("trade_status") ?? "";
  return {
    event_id: params.get("event_id") ?? params.get("notify_id") ?? params.get("trade_no") ?? "",
    provider_event_id: params.get("trade_no") ?? params.get("notify_id") ?? params.get("event_id") ?? "",
    type: params.get("type") ?? mapAlipayTradeStatus(tradeStatus),
    data: {
      checkout_session_id: checkoutSessionId,
      order_id: orderId
    }
  };
}

function normalizeProvider(provider: PaymentProvider): PaymentProvider {
  if (!paymentProviders.includes(provider)) {
    throw new ApiError("INVALID_PAYMENT_PROVIDER", "provider must be stripe_checkout or a reserved provider.", { field: "provider" });
  }
  return provider;
}

function buildCheckoutUrl(provider: PaymentProvider, checkoutSessionId: string, orderId: string, successUrl: string, cancelUrl: string): string {
  const adapter = getProviderAdapter(provider);
  if (resolveProviderMode(provider) === "production" && adapter.productionBaseUrl) {
    return `${adapter.productionBaseUrl.replace(/\/$/, "")}/${checkoutSessionId}`;
  }
  const params = new URLSearchParams({
    session_id: checkoutSessionId,
    order_id: orderId,
    success_url: successUrl,
    cancel_url: cancelUrl
  });
  return `/commercial/checkout-sandbox?${params.toString()}`;
}

function resolveProviderMode(provider: PaymentProvider): "sandbox" | "production" {
  if (provider === "mock_checkout") return "sandbox";
  if (provider === "wechat_pay_reserved") {
    return isChinaPaymentProviderProductionReady(provider) ? "production" : "sandbox";
  }
  if (provider === "alipay_reserved") {
    return isChinaPaymentProviderProductionReady(provider) ? "production" : "sandbox";
  }
  const liveKeyConfigured = Boolean(process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_"));
  const productionEnabled = process.env.PHASE10_PRODUCTION_PAYMENT_ENABLED === "true";
  const webhookSecretConfigured = Boolean(process.env.STRIPE_WEBHOOK_SECRET);
  const rollbackEnabled = process.env.PHASE10_PAYMENT_ROLLBACK === "true";
  const rolloutPercent = Number(process.env.PHASE10_PAYMENT_ROLLOUT_PERCENT ?? 0);
  return liveKeyConfigured && productionEnabled && webhookSecretConfigured && !rollbackEnabled && rolloutPercent > 0 ? "production" : "sandbox";
}

function signWebhookPayload(provider: PaymentProvider, rawBody: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${rawBody}`;
  const adapter = getProviderAdapter(provider);
  const signature = createHmac("sha256", adapter.webhookSecret).update(signedPayload).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

function verifyWebhookSignature(provider: PaymentProvider, rawBody: string, signatureHeader: string): void {
  if (!rawBody || !signatureHeader) {
    throw new ApiError("PAYMENT_WEBHOOK_SIGNATURE_INVALID", "payment webhook signature is required.", {
      field: getProviderAdapter(provider).requirements.signature_header
    });
  }
  if (provider === "wechat_pay_reserved" && signatureHeader.includes("wechatpay-signature=")) {
    verifyWechatPayApiV3Signature(rawBody, signatureHeader);
    return;
  }
  if (provider === "alipay_reserved" && !signatureHeader.includes("v1=")) {
    verifyAlipayRsa2Signature(rawBody);
    return;
  }
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key, value];
    })
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) {
    throw new ApiError("PAYMENT_WEBHOOK_SIGNATURE_INVALID", "payment webhook signature is malformed.", {
      field: getProviderAdapter(provider).requirements.signature_header
    });
  }
  const expected = createHmac("sha256", getProviderAdapter(provider).webhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    throw new ApiError("PAYMENT_WEBHOOK_SIGNATURE_INVALID", "payment webhook signature is invalid.", {
      field: getProviderAdapter(provider).requirements.signature_header
    });
  }
}

function verifyWechatPayApiV3Signature(rawBody: string, signatureHeader: string): void {
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const separatorIndex = part.indexOf("=");
      return [part.slice(0, separatorIndex).trim().toLowerCase(), part.slice(separatorIndex + 1).trim()];
    })
  );
  const timestamp = parts["wechatpay-timestamp"];
  const nonce = parts["wechatpay-nonce"];
  const serial = parts["wechatpay-serial"];
  const signature = parts["wechatpay-signature"];
  const certificate = process.env.WECHAT_PAY_PLATFORM_CERT?.trim();
  const expectedSerial = process.env.WECHAT_PAY_PLATFORM_CERT_SERIAL?.trim();
  if (!timestamp || !nonce || !serial || !signature) {
    throw new ApiError("PAYMENT_WEBHOOK_SIGNATURE_INVALID", "WeChat Pay webhook signature headers are incomplete.", {
      field: "wechatpay-signature"
    });
  }
  if (expectedSerial && serial !== expectedSerial) {
    throw new ApiError("PAYMENT_WEBHOOK_SIGNATURE_INVALID", "WeChat Pay platform certificate serial does not match configured certificate.", {
      field: "wechatpay-serial"
    });
  }
  assertWechatPayTimestampFresh(timestamp);
  if (!certificate) {
    throw new ApiError("PAYMENT_WEBHOOK_SIGNATURE_INVALID", "WECHAT_PAY_PLATFORM_CERT is required to verify WeChat Pay callbacks.", {
      field: "WECHAT_PAY_PLATFORM_CERT"
    });
  }
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${timestamp}\n${nonce}\n${rawBody}\n`);
  verifier.end();
  if (!verifier.verify(certificate, signature, "base64")) {
    throw new ApiError("PAYMENT_WEBHOOK_SIGNATURE_INVALID", "payment webhook signature is invalid.", {
      field: "wechatpay-signature"
    });
  }
}

function assertWechatPayTimestampFresh(timestamp: string): void {
  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs)) {
    throw new ApiError("PAYMENT_WEBHOOK_SIGNATURE_INVALID", "WeChat Pay webhook timestamp is invalid.", {
      field: "wechatpay-timestamp"
    });
  }
  if (Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
    throw new ApiError("PAYMENT_WEBHOOK_SIGNATURE_INVALID", "WeChat Pay webhook timestamp is outside the accepted verification window.", {
      field: "wechatpay-timestamp"
    });
  }
}

function verifyAlipayRsa2Signature(rawBody: string): void {
  const params = new URLSearchParams(rawBody);
  const signature = params.get("sign") ?? "";
  const signType = params.get("sign_type") ?? "RSA2";
  const publicKey = process.env.ALIPAY_PUBLIC_KEY?.trim();
  if (!signature || signType !== "RSA2") {
    throw new ApiError("PAYMENT_WEBHOOK_SIGNATURE_INVALID", "Alipay webhook sign and sign_type=RSA2 are required.", {
      field: "alipay-signature"
    });
  }
  if (!publicKey) {
    throw new ApiError("PAYMENT_WEBHOOK_SIGNATURE_INVALID", "ALIPAY_PUBLIC_KEY is required to verify Alipay callbacks.", {
      field: "ALIPAY_PUBLIC_KEY"
    });
  }
  const content = Array.from(params.entries())
    .filter(([key]) => key !== "sign" && key !== "sign_type")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const verifier = createVerify("RSA-SHA256");
  verifier.update(content);
  verifier.end();
  if (!verifier.verify(publicKey, signature, "base64")) {
    throw new ApiError("PAYMENT_WEBHOOK_SIGNATURE_INVALID", "payment webhook signature is invalid.", {
      field: "alipay-signature"
    });
  }
}

function mapAlipayTradeStatus(status: string): string {
  if (status === "TRADE_SUCCESS" || status === "TRADE_FINISHED") return "checkout.session.completed";
  if (status === "TRADE_CLOSED") return "checkout.session.canceled";
  return status || "payment_intent.payment_failed";
}

function createReportTypeCounts(): Record<ReportType, number> {
  return {
    single_chart: 0,
    synastry: 0,
    timeline: 0
  };
}

function createProviderCounts(): Record<PaymentProvider, number> {
  return {
    stripe_checkout: 0,
    mock_checkout: 0,
    wechat_pay_reserved: 0,
    alipay_reserved: 0
  };
}

function getProviderAdapter(provider: PaymentProvider): {
  webhookSecret: string;
  productionBaseUrl?: string;
  requirements: CheckoutSession["provider_requirements"];
} {
  if (provider === "mock_checkout") {
    return {
      webhookSecret: resolveWebhookSecret("MOCK_PAYMENT_WEBHOOK_SECRET"),
      requirements: {
        webhook_secret_env: "MOCK_PAYMENT_WEBHOOK_SECRET",
        signature_header: "mock-signature",
        idempotency_key_source: "event_id"
      }
    };
  }
  if (provider === "wechat_pay_reserved") {
    return {
      webhookSecret: resolveWebhookSecret("WECHAT_PAY_API_V3_KEY"),
      productionBaseUrl: process.env.WECHAT_PAY_CHECKOUT_BASE_URL,
      requirements: {
        webhook_secret_env: "WECHAT_PAY_API_V3_KEY",
        signature_header: "wechatpay-signature",
        idempotency_key_source: "provider_event_id",
        production_base_url_env: "WECHAT_PAY_CHECKOUT_BASE_URL"
      }
    };
  }
  if (provider === "alipay_reserved") {
    return {
      webhookSecret: resolveWebhookSecret("ALIPAY_PUBLIC_KEY"),
      productionBaseUrl: process.env.ALIPAY_CHECKOUT_BASE_URL,
      requirements: {
        webhook_secret_env: "ALIPAY_PUBLIC_KEY",
        signature_header: "alipay-signature",
        idempotency_key_source: "provider_event_id",
        production_base_url_env: "ALIPAY_CHECKOUT_BASE_URL"
      }
    };
  }
  return {
    webhookSecret: resolveWebhookSecret("STRIPE_WEBHOOK_SECRET"),
    productionBaseUrl: process.env.STRIPE_CHECKOUT_BASE_URL,
    requirements: {
      webhook_secret_env: "STRIPE_WEBHOOK_SECRET",
      signature_header: "stripe-signature",
      idempotency_key_source: "event_id",
      production_base_url_env: "STRIPE_CHECKOUT_BASE_URL"
    }
  };
}

const testSandboxSecrets = new Map<string, string>();

function resolveWebhookSecret(envName: string): string {
  const configured = process.env[envName]?.trim();
  if (configured) return configured;
  // Vitest does not set NODE_ENV in this repository; an absent NODE_ENV is
  // treated as test-only fixture execution. Next development/production
  // processes always set it and therefore fail closed when secrets are absent.
  if (process.env.VITEST || process.env.NODE_ENV === undefined || process.env.NODE_ENV === "test") {
    const existing = testSandboxSecrets.get(envName);
    if (existing) return existing;
    const generated = randomBytes(32).toString("hex");
    testSandboxSecrets.set(envName, generated);
    return generated;
  }
  throw new ApiError("PAYMENT_WEBHOOK_SECRET_NOT_CONFIGURED", `${envName} must be configured before payment webhooks are enabled.`, {
    field: envName,
    status: 503
  });
}

function sanitizeText(text: string): string {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/g, "[birth_date_redacted]")
    .replace(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g, "[birth_time_redacted]")
    .replace(/\b(?:Shanghai|Beijing|Guangzhou|Shenzhen|Chengdu|Hangzhou|Nanjing|Wuhan)\b|(?:北京|上海|广州|深圳|成都|杭州|南京|武汉)/gi, "[location_redacted]")
    .replace(/data:image\/[a-zA-Z+.-]+;base64,[A-Za-z0-9+/=]+/g, "[image_payload_redacted]");
}

function createId(prefix: string): string {
  return `${prefix}_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}_${Math.random().toString(36).slice(2, 8)}`;
}

function createRefundId(orderId: string, amountCents: number, createdAt: string, providerRefundId?: string): string {
  const digest = createHmac("sha256", "refund_id_namespace")
    .update(`${orderId}:${amountCents}:${createdAt}:${providerRefundId ?? ""}:${Math.random().toString(36).slice(2)}`)
    .digest("hex")
    .slice(0, 12);
  return `refund_${digest}`;
}
