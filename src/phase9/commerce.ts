import { createHmac, timingSafeEqual } from "node:crypto";
import { ApiError } from "../errors.js";
import {
  findCheckoutSessionByOrder,
  getCheckoutSessionRecord,
  getMemberEntitlementRecord,
  getOrderRecord,
  getPaymentEventRecord,
  getReportDraftRecord,
  listMemberEntitlements,
  listOrderRecords,
  saveCheckoutSession,
  saveMemberEntitlement,
  saveOrder,
  savePaymentEvent
} from "../store.js";
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
const sandboxWebhookSecret = "phase9_sandbox_webhook_secret";

const tierPrices: Record<ReportTierId, { amount_cents: number; currency: "cny" }> = {
  starter_19: { amount_cents: 1900, currency: "cny" },
  standard_49: { amount_cents: 4900, currency: "cny" },
  premium_99: { amount_cents: 9900, currency: "cny" }
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
    status: "draft",
    payment_provider: "stripe_checkout",
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

  saveOrder(order);
  return order;
}

export function getOrder(orderId: string): Order | undefined {
  return orderId ? getOrderRecord(orderId) : undefined;
}

export function listOrders(memberId?: string): { orders: Order[]; privacy: CommercialPrivacy } {
  return {
    orders: listOrderRecords(memberId).sort((left, right) => right.created_at.localeCompare(left.created_at)),
    privacy
  };
}

export function createCheckoutSession(request: CheckoutSessionRequest): CheckoutSession {
  const provider = normalizeProvider(request?.provider);
  if (provider !== "stripe_checkout") {
    throw new ApiError("PAYMENT_PROVIDER_RESERVED", "Only stripe_checkout is implemented in phase 9.", {
      field: "provider",
      status: 501
    });
  }
  if (!request?.success_url || !request.cancel_url) {
    throw new ApiError("CHECKOUT_URL_REQUIRED", "success_url and cancel_url are required.", { field: "success_url" });
  }

  const order = getOrderRecord(request.order_id);
  if (!order) {
    throw new ApiError("ORDER_NOT_FOUND", "order not found.", { field: "order_id", status: 404 });
  }
  if (!["draft", "pending_payment"].includes(order.status)) {
    throw new ApiError("ORDER_NOT_CHECKOUT_ELIGIBLE", "order is not eligible for checkout.", {
      field: "order_status",
      status: 409
    });
  }

  const now = new Date();
  const existingSession = findCheckoutSessionByOrder(order.order_id);
  const checkoutSessionId = existingSession?.checkout_session_id ?? createId("cs");
  const rawBody = JSON.stringify({
    event_id: createId("evt"),
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
    provider_mode: resolveProviderMode(),
    checkout_url: buildCheckoutUrl(checkoutSessionId, order.order_id, request.success_url, request.cancel_url),
    status: "open",
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    sandbox_webhook:
      resolveProviderMode() === "sandbox"
        ? {
            raw_body: rawBody,
            signature_header: signWebhookPayload(rawBody)
          }
        : undefined
  };

  const updatedOrder: Order = {
    ...order,
    status: "pending_payment",
    checkout_session_id: session.checkout_session_id,
    updated_at: now.toISOString()
  };
  saveOrder(updatedOrder);
  saveCheckoutSession(session);
  return session;
}

export function processPaymentWebhook(request: PaymentWebhookRequest): PaymentEvent {
  const provider = normalizeProvider(request?.provider);
  verifyWebhookSignature(request.raw_body, request.signature);
  const payload = parseWebhookPayload(request.raw_body);
  const eventId = sanitizeText(String(payload.event_id ?? payload.id ?? ""));
  const eventType = sanitizeText(String(payload.type ?? ""));
  if (!eventId || !eventType) {
    throw new ApiError("PAYMENT_WEBHOOK_INVALID", "payment webhook event_id and type are required.", { field: "raw_body" });
  }

  const existingEvent = getPaymentEventRecord(eventId);
  if (existingEvent) {
    return { ...existingEvent, is_duplicate: true };
  }

  const checkoutSessionId = sanitizeText(
    String(payload.data?.checkout_session_id ?? payload.data?.object?.id ?? payload.data?.object?.checkout_session_id ?? "")
  );
  const orderId = sanitizeText(
    String(payload.data?.order_id ?? payload.data?.object?.metadata?.order_id ?? payload.data?.object?.client_reference_id ?? "")
  );
  const session = checkoutSessionId ? getCheckoutSessionRecord(checkoutSessionId) : undefined;
  const order = getOrderRecord(orderId || session?.order_id || "");
  if (!order || !session) {
    throw new ApiError("PAYMENT_ORDER_NOT_FOUND", "payment webhook could not resolve an order.", { field: "order_id", status: 404 });
  }

  const updatedOrder = applyPaymentEvent(order, session, eventType);
  const event: PaymentEvent = {
    payment_event_id: eventId,
    provider,
    event_type: eventType,
    checkout_session_id: session.checkout_session_id,
    order_id: updatedOrder.order_id,
    received_at: new Date().toISOString(),
    signature_verified: true,
    is_duplicate: false,
    order: updatedOrder
  };
  savePaymentEvent(event);
  return event;
}

export function getReportEntitlement(reportId: string, memberId = "anonymous_member"): MemberEntitlement {
  const entitlement = getMemberEntitlementRecord(memberId, reportId);
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
  const entitlements = listMemberEntitlements(memberId);
  return {
    member_id: sanitizeText(memberId),
    purchased_report_ids: entitlements.filter((entitlement) => entitlement.has_access).map((entitlement) => entitlement.report_id),
    light_membership_active: entitlements.some((entitlement) => {
      const order = getOrderRecord(entitlement.source_order_id);
      return order?.package_id === "light_membership" && order.status === "fulfilled";
    }),
    entitlements,
    privacy
  };
}

export function getCommercialDashboard(): CommercialDashboardSummary {
  const orders = listOrderRecords();
  const completedOrders = orders.filter((order) => ["paid", "fulfilled"].includes(order.status));
  const totalRevenue = completedOrders.reduce((sum, order) => sum + order.amount_cents, 0);
  const reportTypeCounts = createReportTypeCounts();
  const providerCounts = createProviderCounts();
  for (const order of orders) {
    reportTypeCounts[order.report_type] += 1;
    providerCounts[order.payment_provider] += 1;
  }

  return {
    total_orders: orders.length,
    pending_orders: orders.filter((order) => order.status === "pending_payment").length,
    paid_orders: orders.filter((order) => order.status === "paid").length,
    fulfilled_orders: orders.filter((order) => order.status === "fulfilled").length,
    failed_orders: orders.filter((order) => order.status === "failed").length,
    refunded_manual_orders: orders.filter((order) => order.status === "refunded_manual").length,
    payment_conversion_rate: orders.length ? completedOrders.length / orders.length : 0,
    average_order_value_cents: completedOrders.length ? Math.round(totalRevenue / completedOrders.length) : 0,
    report_type_counts: reportTypeCounts,
    content_review_block_rate: 0,
    payment_provider_counts: providerCounts,
    privacy
  };
}

export function markManualRefund(orderId: string, reason = "manual_support_review"): Order {
  const order = getOrderRecord(orderId);
  if (!order) {
    throw new ApiError("ORDER_NOT_FOUND", "order not found.", { field: "order_id", status: 404 });
  }
  const now = new Date().toISOString();
  const updatedOrder = {
    ...order,
    status: "refunded_manual" as const,
    updated_at: now,
    refunded_at: now
  };
  saveOrder(updatedOrder);
  void reason;
  return updatedOrder;
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

function applyPaymentEvent(order: Order, session: CheckoutSession, eventType: string): Order {
  const now = new Date().toISOString();
  const sessionUpdate: CheckoutSession = {
    ...session,
    status: eventType === "checkout.session.completed" ? "completed" : session.status
  };
  saveCheckoutSession(sessionUpdate);

  if (eventType === "checkout.session.completed") {
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
    saveOrder(fulfilledOrder);
    grantEntitlement(fulfilledOrder);
    return fulfilledOrder;
  }

  if (eventType === "checkout.session.expired" || eventType === "payment_intent.payment_failed") {
    const failedOrder: Order = {
      ...order,
      status: eventType === "checkout.session.expired" ? "expired" : "failed",
      updated_at: now
    };
    saveOrder(failedOrder);
    return failedOrder;
  }

  saveOrder(order);
  return order;
}

function grantEntitlement(order: Order): MemberEntitlement {
  const draft = getReportDraftRecord(order.report_id);
  const entitlement: MemberEntitlement = {
    entitlement_id: createId("ent"),
    member_id: order.member_id,
    report_id: order.report_id,
    source_order_id: order.order_id,
    has_access: true,
    can_read_report: true,
    export_preview_credits: order.package_id === "light_membership" ? 10 : 3,
    favorite_enabled: true,
    created_at: new Date().toISOString(),
    privacy_note: privacyNote,
    report_snapshot: draft
  };
  saveMemberEntitlement(entitlement);
  return entitlement;
}

function parseWebhookPayload(rawBody: string): {
  event_id?: unknown;
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
  try {
    return JSON.parse(rawBody) as ReturnType<typeof parseWebhookPayload>;
  } catch {
    throw new ApiError("PAYMENT_WEBHOOK_INVALID_JSON", "payment webhook body must be valid JSON.", { field: "raw_body" });
  }
}

function normalizeProvider(provider: PaymentProvider): PaymentProvider {
  if (!paymentProviders.includes(provider)) {
    throw new ApiError("INVALID_PAYMENT_PROVIDER", "provider must be stripe_checkout or a reserved provider.", { field: "provider" });
  }
  return provider;
}

function buildCheckoutUrl(checkoutSessionId: string, orderId: string, successUrl: string, cancelUrl: string): string {
  if (resolveProviderMode() === "production" && process.env.STRIPE_CHECKOUT_BASE_URL) {
    return `${process.env.STRIPE_CHECKOUT_BASE_URL.replace(/\/$/, "")}/${checkoutSessionId}`;
  }
  const params = new URLSearchParams({
    session_id: checkoutSessionId,
    order_id: orderId,
    success_url: successUrl,
    cancel_url: cancelUrl
  });
  return `/commercial/checkout-sandbox?${params.toString()}`;
}

function resolveProviderMode(): "sandbox" | "production" {
  const liveKeyConfigured = Boolean(process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_"));
  const productionEnabled = process.env.PHASE10_PRODUCTION_PAYMENT_ENABLED === "true";
  const webhookSecretConfigured = Boolean(process.env.STRIPE_WEBHOOK_SECRET);
  const rollbackEnabled = process.env.PHASE10_PAYMENT_ROLLBACK === "true";
  const rolloutPercent = Number(process.env.PHASE10_PAYMENT_ROLLOUT_PERCENT ?? 0);
  return liveKeyConfigured && productionEnabled && webhookSecretConfigured && !rollbackEnabled && rolloutPercent > 0 ? "production" : "sandbox";
}

function signWebhookPayload(rawBody: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${rawBody}`;
  const signature = createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET || sandboxWebhookSecret).update(signedPayload).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

function verifyWebhookSignature(rawBody: string, signatureHeader: string): void {
  if (!rawBody || !signatureHeader) {
    throw new ApiError("PAYMENT_WEBHOOK_SIGNATURE_INVALID", "payment webhook signature is required.", {
      field: "stripe-signature"
    });
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
      field: "stripe-signature"
    });
  }
  const expected = createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET || sandboxWebhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    throw new ApiError("PAYMENT_WEBHOOK_SIGNATURE_INVALID", "payment webhook signature is invalid.", {
      field: "stripe-signature"
    });
  }
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
    wechat_pay_reserved: 0,
    alipay_reserved: 0
  };
}

function sanitizeText(text: string): string {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/g, "[birth_date_redacted]")
    .replace(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g, "[birth_time_redacted]")
    .replace(/\b(?:Shanghai|Beijing|Guangzhou|Shenzhen|Chengdu|Hangzhou|Nanjing|Wuhan)\b/gi, "[location_redacted]")
    .replace(/data:image\/[a-zA-Z+.-]+;base64,[A-Za-z0-9+/=]+/g, "[image_payload_redacted]");
}

function createId(prefix: string): string {
  return `${prefix}_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}_${Math.random().toString(36).slice(2, 8)}`;
}
