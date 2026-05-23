import { ApiError } from "../errors.js";
import { getCommercialDashboard, markManualRefund } from "../phase9/commerce.js";
import {
  getUnauthorizedOpsAccessCount,
  listLaunchGrowthEvents,
  listMemberEntitlements,
  listOpsOrderNotes,
  listOrderRecords,
  listPaymentEvents,
  listSupportTickets,
  saveLaunchGrowthEvent,
  saveOpsOrderNote,
  saveSupportTicket,
  getSupportTicketRecord,
  recordUnauthorizedOpsAccess
} from "../store.js";
import {
  launchGrowthEventTypes,
  opsRoles,
  orderStatuses,
  supportTicketCategories,
  supportTicketPriorities,
  supportTicketStatuses,
  type CommercialPrivacy,
  type GrowthDashboardSummary,
  type LaunchGrowthEvent,
  type LaunchGrowthEventRequest,
  type LaunchOperationsDashboard,
  type LaunchPaymentConfig,
  type LaunchPaymentConfigInput,
  type LaunchRiskSummary,
  type OpsAuth,
  type OpsOrderListRequest,
  type OpsOrderListResponse,
  type OpsOrderNote,
  type OpsRefundRequest,
  type OpsRefundResponse,
  type OpsRole,
  type PaymentLaunchGateRequest,
  type PaymentLaunchGateResult,
  type SupportOpsSummary,
  type SupportTicket,
  type SupportTicketRequest,
  type SupportTicketUpdateRequest
} from "../types.js";

const privacy: CommercialPrivacy = {
  stores_full_birth_date: false,
  stores_birth_time: false,
  stores_location_detail: false,
  stores_video_frame: false
};

const defaultOpsToken = "phase10_admin_token";
const sensitivePattern = /\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b|\b(?:[01]?\d|2[0-3]):[0-5]\d\b|\b(?:Shanghai|Beijing|Guangzhou|Shenzhen|Chengdu|Hangzhou|Nanjing|Wuhan)\b|data:image\/[a-zA-Z+.-]+;base64,[A-Za-z0-9+/=]+/i;

export function resolveLaunchPaymentConfig(input: LaunchPaymentConfigInput = {}): LaunchPaymentConfig {
  const stripeKey = input.stripe_secret_key ?? process.env.STRIPE_SECRET_KEY ?? "";
  const hasLiveKey = stripeKey.startsWith("sk_live_");
  const webhookSecretConfigured = input.webhook_secret_configured ?? Boolean(process.env.STRIPE_WEBHOOK_SECRET || process.env.PHASE10_WEBHOOK_SECRET_CONFIGURED === "true");
  const productionEnabled = input.production_payment_enabled ?? process.env.PHASE10_PRODUCTION_PAYMENT_ENABLED === "true";
  const rollbackEnabled = input.rollback_enabled ?? process.env.PHASE10_PAYMENT_ROLLBACK === "true";
  const rolloutPercent = clampPercent(input.rollout_percent ?? Number(process.env.PHASE10_PAYMENT_ROLLOUT_PERCENT ?? 0));
  const maxProductionAmount = input.max_production_amount_cents ?? Number(process.env.PHASE10_MAX_PRODUCTION_AMOUNT_CENTS ?? 9900);
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
          : "sandbox_only"
  };
}

export function evaluatePaymentLaunchGate(request: PaymentLaunchGateRequest): PaymentLaunchGateResult {
  const config = request.config ?? resolveLaunchPaymentConfig();
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
  return { allowed: true, reason: "production_allowed", rollout_bucket: rolloutBucket, provider_mode: config.provider_mode };
}

export function listOpsOrders(request: OpsOrderListRequest): OpsOrderListResponse {
  assertOpsAuth(request.auth, ["ops_admin", "support_agent", "content_reviewer"]);
  const status = request.status;
  if (status && !orderStatuses.includes(status)) {
    throw new ApiError("INVALID_ORDER_STATUS", "order status is invalid.", { field: "status" });
  }
  const orders = listOrderRecords(request.member_id).filter((order) => (status ? order.status === status : true));
  return {
    orders: orders.sort((left, right) => right.created_at.localeCompare(left.created_at)),
    filters: {
      status,
      member_id: request.member_id ? sanitizeText(request.member_id) : undefined
    },
    privacy
  };
}

export function listOpsPaymentEvents(request: { auth: OpsAuth }) {
  assertOpsAuth(request.auth, ["ops_admin", "support_agent"]);
  return {
    events: listPaymentEvents().sort((left, right) => right.received_at.localeCompare(left.received_at)),
    privacy
  };
}

export function listOpsEntitlements(request: { auth: OpsAuth; member_id?: string }) {
  assertOpsAuth(request.auth, ["ops_admin", "support_agent"]);
  return {
    entitlements: listMemberEntitlements(request.member_id),
    privacy
  };
}

export function markOpsManualRefund(request: OpsRefundRequest): OpsRefundResponse {
  const auth = assertOpsAuth(request.auth, ["ops_admin"]);
  if (!request.reason?.trim()) {
    throw new ApiError("REFUND_REASON_REQUIRED", "manual refund reason is required.", { field: "reason" });
  }
  const order = markManualRefund(request.order_id, request.reason);
  const note = createOrderNote({
    order_id: order.order_id,
    ticket_id: request.ticket_id,
    action: "manual_refund_marked",
    note: request.reason,
    actor_role: auth.role,
    actor_id: auth.actor_id
  });
  return { order, note, privacy };
}

export function addOpsOrderNote(request: { auth: OpsAuth; order_id: string; ticket_id?: string; note: string }): { note: OpsOrderNote; privacy: CommercialPrivacy } {
  const auth = assertOpsAuth(request.auth, ["ops_admin", "support_agent"]);
  const note = createOrderNote({
    order_id: request.order_id,
    ticket_id: request.ticket_id,
    action: "support_note_added",
    note: request.note,
    actor_role: auth.role,
    actor_id: auth.actor_id
  });
  return { note, privacy };
}

export function createSupportTicket(request: SupportTicketRequest): SupportTicket {
  validateSupportTicketRequest(request);
  const now = new Date().toISOString();
  const ticket: SupportTicket = {
    ticket_id: createId("ticket"),
    member_id: sanitizeText(request.member_id),
    order_id: request.order_id ? sanitizeText(request.order_id) : undefined,
    report_id: request.report_id ? sanitizeText(request.report_id) : undefined,
    category: request.category,
    priority: request.priority,
    status: "open",
    subject: sanitizeText(request.subject),
    message: sanitizeText(request.message),
    created_at: now,
    updated_at: now,
    consent: request.consent,
    audit_trail: [
      {
        audit_id: createId("audit"),
        action: "support_ticket_created",
        actor_role: "user",
        created_at: now
      }
    ]
  };
  saveSupportTicket(ticket);
  return ticket;
}

export function updateSupportTicket(request: SupportTicketUpdateRequest): SupportTicket {
  const auth = assertOpsAuth(request.auth, ["ops_admin", "support_agent"]);
  if (!supportTicketStatuses.includes(request.status)) {
    throw new ApiError("INVALID_SUPPORT_TICKET_STATUS", "support ticket status is invalid.", { field: "status" });
  }
  const ticket = getSupportTicketRecord(request.ticket_id);
  if (!ticket) {
    throw new ApiError("SUPPORT_TICKET_NOT_FOUND", "support ticket not found.", { field: "ticket_id", status: 404 });
  }
  const now = new Date().toISOString();
  const updated: SupportTicket = {
    ...ticket,
    status: request.status,
    assignee: request.assignee ? sanitizeText(request.assignee) : ticket.assignee,
    updated_at: now,
    resolved_at: request.status === "resolved" || request.status === "closed" ? now : ticket.resolved_at,
    audit_trail: [
      ...ticket.audit_trail,
      {
        audit_id: createId("audit"),
        action: `support_ticket_${request.status}`,
        actor_role: auth.role,
        actor_id: auth.actor_id,
        note: request.note ? sanitizeText(request.note) : undefined,
        created_at: now
      }
    ]
  };
  saveSupportTicket(updated);
  return updated;
}

export function getSupportTicket(request: { auth: OpsAuth; ticket_id: string }): SupportTicket {
  assertOpsAuth(request.auth, ["ops_admin", "support_agent", "content_reviewer"]);
  const ticket = getSupportTicketRecord(request.ticket_id);
  if (!ticket) {
    throw new ApiError("SUPPORT_TICKET_NOT_FOUND", "support ticket not found.", { field: "ticket_id", status: 404 });
  }
  return ticket;
}

export function recordGrowthEvent(request: LaunchGrowthEventRequest): LaunchGrowthEvent {
  if (!launchGrowthEventTypes.includes(request.type)) {
    throw new ApiError("INVALID_GROWTH_EVENT_TYPE", "growth event type is invalid.", { field: "type" });
  }
  const event: LaunchGrowthEvent = {
    growth_event_id: createId("growth"),
    type: request.type,
    member_id: request.member_id ? sanitizeText(request.member_id) : undefined,
    report_id: request.report_id ? sanitizeText(request.report_id) : undefined,
    order_id: request.order_id ? sanitizeText(request.order_id) : undefined,
    value_cents: request.value_cents,
    created_at: new Date().toISOString()
  };
  saveLaunchGrowthEvent(event);
  return event;
}

export function getLaunchOperationsDashboard(request: { auth: OpsAuth }): LaunchOperationsDashboard {
  assertOpsAuth(request.auth, ["ops_admin", "support_agent", "content_reviewer"]);
  const orders = getCommercialDashboard();
  const support = summarizeSupport();
  const growth = summarizeGrowth();
  return {
    launch_config: resolveLaunchPaymentConfig(),
    orders,
    risk: summarizeRisk(orders),
    support,
    growth,
    privacy
  };
}

function assertOpsAuth(auth: OpsAuth | undefined, allowedRoles: readonly OpsRole[]): Required<OpsAuth> {
  const token = auth?.token || "";
  const role = auth?.role || "support_agent";
  if (token !== (process.env.PHASE10_ADMIN_TOKEN || defaultOpsToken) || !opsRoles.includes(role)) {
    recordUnauthorizedOpsAccess();
    throw new ApiError("OPS_AUTH_REQUIRED", "ops access is not authorized.", { field: "x-admin-token", status: 401 });
  }
  if (!allowedRoles.includes(role)) {
    recordUnauthorizedOpsAccess();
    throw new ApiError("OPS_ROLE_FORBIDDEN", "ops role is not allowed for this action.", { field: "x-admin-role", status: 403 });
  }
  return {
    token,
    role,
    actor_id: auth?.actor_id || role
  };
}

function validateSupportTicketRequest(request: SupportTicketRequest): void {
  if (!request?.consent?.agreed || !request.consent.no_sensitive_birth_data) {
    throw new ApiError("SUPPORT_CONSENT_REQUIRED", "support consent and no_sensitive_birth_data confirmation are required.", { field: "consent" });
  }
  if (!supportTicketCategories.includes(request.category)) {
    throw new ApiError("INVALID_SUPPORT_CATEGORY", "support ticket category is invalid.", { field: "category" });
  }
  if (!supportTicketPriorities.includes(request.priority)) {
    throw new ApiError("INVALID_SUPPORT_PRIORITY", "support ticket priority is invalid.", { field: "priority" });
  }
  if (!request.subject?.trim() || !request.message?.trim()) {
    throw new ApiError("SUPPORT_TICKET_TEXT_REQUIRED", "support ticket subject and message are required.", { field: "message" });
  }
}

function createOrderNote(input: Omit<OpsOrderNote, "note_id" | "created_at">): OpsOrderNote {
  const note: OpsOrderNote = {
    note_id: createId("ops_note"),
    order_id: sanitizeText(input.order_id),
    ticket_id: input.ticket_id ? sanitizeText(input.ticket_id) : undefined,
    action: input.action,
    note: sanitizeText(input.note),
    actor_role: input.actor_role,
    actor_id: input.actor_id ? sanitizeText(input.actor_id) : undefined,
    created_at: new Date().toISOString()
  };
  saveOpsOrderNote(note);
  return note;
}

function summarizeRisk(orders: LaunchOperationsDashboard["orders"]): LaunchRiskSummary {
  const totalOrders = orders.total_orders || 1;
  const paymentFailures = orders.failed_orders + orders.pending_orders;
  const notes = listOpsOrderNotes();
  const tickets = listSupportTickets();
  return {
    payment_failure_rate: paymentFailures / totalOrders,
    refund_rate: orders.refunded_manual_orders / Math.max(orders.fulfilled_orders + orders.refunded_manual_orders, 1),
    webhook_exception_count: notes.filter((note) => note.action === "webhook_exception").length,
    content_review_block_rate: orders.content_review_block_rate,
    privacy_scan_violations: countPrivacyViolations([...notes, ...tickets]),
    unauthorized_access_attempts: getUnauthorizedOpsAccessCount()
  };
}

function summarizeSupport(): SupportOpsSummary {
  const tickets = listSupportTickets();
  return {
    total_tickets: tickets.length,
    open_tickets: tickets.filter((ticket) => ticket.status === "open" || ticket.status === "in_progress").length,
    resolved_tickets: tickets.filter((ticket) => ticket.status === "resolved" || ticket.status === "closed").length,
    high_priority_tickets: tickets.filter((ticket) => ticket.priority === "high" || ticket.priority === "urgent").length,
    refund_request_tickets: tickets.filter((ticket) => ticket.category === "refund_request").length,
    privacy_deletion_tickets: tickets.filter((ticket) => ticket.category === "privacy_deletion").length,
    sla_attention_required: tickets.filter((ticket) => ticket.priority === "urgent" && ticket.status !== "resolved" && ticket.status !== "closed").length
  };
}

function summarizeGrowth(): GrowthDashboardSummary {
  const summary = Object.fromEntries(launchGrowthEventTypes.map((type) => [type, 0])) as GrowthDashboardSummary;
  for (const event of listLaunchGrowthEvents()) {
    summary[event.type] += 1;
  }
  return summary;
}

function countPrivacyViolations(records: unknown[]): number {
  return records.filter((record) => sensitivePattern.test(extractUserTextForPrivacyScan(record))).length;
}

function extractUserTextForPrivacyScan(record: unknown): string {
  if (typeof record !== "object" || record === null) return String(record ?? "");
  const values: string[] = [];
  const maybeRecord = record as {
    note?: unknown;
    subject?: unknown;
    message?: unknown;
    audit_trail?: Array<{ note?: unknown }>;
  };
  if (typeof maybeRecord.note === "string") values.push(maybeRecord.note);
  if (typeof maybeRecord.subject === "string") values.push(maybeRecord.subject);
  if (typeof maybeRecord.message === "string") values.push(maybeRecord.message);
  for (const audit of maybeRecord.audit_trail ?? []) {
    if (typeof audit.note === "string") values.push(audit.note);
  }
  return values.join(" ");
}

function stableBucket(value: string): number {
  const text = sanitizeText(value || "anonymous");
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
