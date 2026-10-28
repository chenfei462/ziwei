import { resolveLoginProviderReadiness } from "../auth.js";
import { createHash, createHmac } from "node:crypto";
import { ApiError } from "../errors.js";
import { resolveBaseLaunchPaymentConfig } from "../paymentLaunchGate.js";
import { resolveRateLimitReadiness } from "../apiSecurity.js";
import { getCommercialDashboard, grantManualEntitlement, markManualRefund, markPartialRefund } from "../phase9/commerce.js";
import { getChannelDashboard } from "../phase14/channels.js";
import { resolveObservabilityReadiness } from "../observability.js";
import { resolveExportStorageReadiness } from "../phase8/reporting.js";
import { resolveBirthDataEncryptionReadiness, resolveProductionDatabaseReadiness } from "../repositories/productionDatabase.js";
import { productRepository } from "../repositories/productRepository.js";
import {
  getDefaultRuleProfileId,
  getRuleProfileRecord,
  listRuleProfileRecords,
  promoteDefaultRuleProfile
} from "../phase11/ruleProfileData.js";
import { resolveWechatJssdkReadiness } from "../wechatShare.js";
import {
  getUnauthorizedOpsAccessCount,
  countAnonymousVisitorRecords,
  countChartRecords,
  countReportDraftRecords,
  countShareLandingRecords,
  countUserRecords,
  getDataDeletionRequestRecord,
  listLaunchGrowthEvents,
  listChannelGrowthEvents,
  listDataDeletionRequests,
  listFeedback,
  listMemberEntitlements,
  listOpsOrderNotes,
  listOrderRecords,
  listPaymentEvents,
  listAnonymousVisitorRecords,
  listChartOwnerRecords,
  listReportDraftRecords,
  listShareLandingSnapshotRecords,
  listSupportTickets,
  listUserRecords,
  saveLaunchGrowthEvent,
  saveDataDeletionRequest,
  saveOpsOrderNote,
  saveSupportTicket,
  getSupportTicketRecord,
  recordUnauthorizedOpsAccess
} from "../store.js";
import {
  channelSources,
  type ChannelDashboardSummary,
  type ChannelGrowthEvent,
  type ChannelSource,
  launchGrowthEventTypes,
  opsRoles,
  orderStatuses,
  paymentProviders,
  supportTicketCategories,
  supportTicketPriorities,
  supportTicketStatuses,
  dataDeletionScopes,
  dataDeletionStatuses,
  opsSensitiveRecordTypes,
  type CommercialPrivacy,
  type ContentReviewQueueItem,
  type DataDeletionRequestRecord,
  type GrowthDashboardSummary,
  type InternalGrowthAnomaly,
  type InternalGrowthChannelMixItem,
  type InternalGrowthInsights,
  type InternalGrowthProxySummary,
  type LaunchGrowthEvent,
  type LaunchGrowthEventRequest,
  type LaunchOperationsDashboard,
  type LaunchPaymentConfig,
  type LaunchPaymentConfigInput,
  type LaunchRiskSummary,
  type AdminAuditLog,
  type ContentReviewSourceType,
  type ContentReviewStatus,
  type OpsAuth,
  type OpsAdminAuditListResponse,
  type OpsContentReviewListRequest,
  type OpsContentReviewListResponse,
  type OpsDataDeletionListRequest,
  type OpsDataDeletionListResponse,
  type OpsDataDeletionUpdateRequest,
  type OpsDataDeletionUpdateResponse,
  type OpsEntitlementReissueRequest,
  type OpsEntitlementReissueResponse,
  type OpsOverview,
  type OpsPaymentAlertWebhookPayload,
  type OpsPaymentAlertWebhookRequest,
  type OpsPaymentAlertWebhookResponse,
  type OpsPaymentAlertWebhookSenderResult,
  type OpsOrderListRequest,
  type OpsOrderListResponse,
  type OpsOrderNote,
  type OpsPaymentReconciliationAlert,
  type OpsPaymentReconciliationResponse,
  type OpsRefundRequest,
  type OpsRefundResponse,
  type OpsRuleProfileListResponse,
  type OpsRuleProfilePromotionRequest,
  type OpsRuleProfilePromotionResponse,
  type OpsRuleProfileSummary,
  type OpsRole,
  type OpsReportListResponse,
  type OpsShareListResponse,
  type OpsSensitiveRecordRevealRequest,
  type OpsSensitiveRecordRevealResponse,
  type OpsUserListResponse,
  type Order,
  type PaymentProvider,
  type ProviderStatement,
  type ProviderStatementImportRequest,
  type ProviderStatementImportResponse,
  type ProviderStatementPreviewResponse,
  type ProviderStatementRowType,
  type PrivacyDeletionRequestInput,
  type PrivacyDeletionRequestResponse,
  type RefundRecord,
  type SupportOpsSummary,
  type SupportTicket,
  type SupportTicketRequest,
  type SupportTicketUpdateRequest,
  type ShareLandingSourceType
} from "../types.js";

export { evaluatePaymentLaunchGate, resolveChinaPaymentProviderReadiness } from "../paymentLaunchGate.js";

const privacy: CommercialPrivacy = {
  stores_full_birth_date: false,
  stores_birth_time: false,
  stores_location_detail: false,
  stores_video_frame: false
};

const deletionPrivacy = {
  sensitive_fields_masked: true,
  destructive_action_requires_second_confirm: true,
  raw_birth_data_removed_from_ops_response: true
} as const;

const sensitivePattern = /\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b|\b(?:[01]?\d|2[0-3]):[0-5]\d\b|\b(?:Shanghai|Beijing|Guangzhou|Shenzhen|Chengdu|Hangzhou|Nanjing|Wuhan)\b|data:image\/[a-zA-Z+.-]+;base64,[A-Za-z0-9+/=]+/i;

/** Resolve the one server-side ops credential. Never ship a usable default. */
export function getConfiguredOpsToken(): string | undefined {
  const configured = process.env.PHASE10_ADMIN_TOKEN?.trim();
  if (configured) return configured;
  return undefined;
}

function configuredOpsRole(): OpsRole {
  const configured = process.env.PHASE10_ADMIN_ROLE?.trim();
  if (configured === "ops_admin" || configured === "support_agent" || configured === "content_reviewer") return configured;
  // Least privilege is the safe default when no role mapping is configured.
  return "support_agent";
}

export function resolveOpsSecurityReadiness() {
  const adminTokenConfigured = Boolean(process.env.PHASE10_ADMIN_TOKEN?.trim());
  const mfaEnabled = process.env.PHASE10_OPS_MFA_ENABLED === "true";
  const mfaConfigured = Boolean(process.env.PHASE10_OPS_MFA_CODE?.trim());
  const blockers: string[] = [];
  if (!adminTokenConfigured) blockers.push("PHASE10_ADMIN_TOKEN is required before enabling production ops access.");
  if (mfaEnabled) {
    if (!mfaConfigured) blockers.push("PHASE10_OPS_MFA_CODE is required when PHASE10_OPS_MFA_ENABLED=true.");
  } else {
    blockers.push("Set PHASE10_OPS_MFA_ENABLED=true and inject PHASE10_OPS_MFA_CODE before production ops access.");
  }
  return {
    mfa_enabled: mfaEnabled,
    mfa_configured: mfaConfigured,
    admin_token_configured: adminTokenConfigured,
    requiredEnv: ["PHASE10_OPS_MFA_ENABLED", "PHASE10_OPS_MFA_CODE"],
    blockers
  };
}

export function resolveLaunchPaymentConfig(input: LaunchPaymentConfigInput = {}): LaunchPaymentConfig {
  return {
    ...resolveBaseLaunchPaymentConfig(input),
    database: resolveProductionDatabaseReadiness(),
    birth_data_encryption: resolveBirthDataEncryptionReadiness(),
    login: resolveLoginProviderReadiness(),
    wechat_share: {
      ...resolveWechatJssdkReadiness(),
      jsApiList: ["updateAppMessageShareData", "updateTimelineShareData"],
      manualVerification: ["微信公众平台 JS 接口安全域名已配置", "微信内置浏览器真机分享标题、描述、缩略图已验收", "分享页不暴露完整生日、出生时间、地点或私密报告全文"]
    },
    ops_security: resolveOpsSecurityReadiness(),
    rate_limit: resolveRateLimitReadiness(),
    export_storage: resolveExportStorageReadiness(),
    observability: resolveObservabilityReadiness()
  };
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

export function getOpsPaymentReconciliation(request: { auth: OpsAuth }): OpsPaymentReconciliationResponse {
  assertOpsAuth(request.auth, ["ops_admin", "support_agent"]);
  const orders = listOrderRecords();
  const events = listPaymentEvents();
  const refunds = productRepository.listRefundRecords();
  const providerStatements = productRepository.listProviderStatements();
  const byProvider = createReconciliationProviderSummary();
  for (const order of orders) {
    const providerSummary = byProvider[order.payment_provider];
    providerSummary.order_count += 1;
    if (["paid", "fulfilled", "refunded", "partially_refunded"].includes(order.status)) {
      providerSummary.gross_amount_cents += order.amount_cents;
      providerSummary.refunded_amount_cents += order.refunded_amount_cents ?? (order.status === "refunded" ? order.amount_cents : 0);
    }
  }
  for (const event of events) {
    byProvider[event.provider].payment_event_count += 1;
  }
  for (const refund of refunds) {
    byProvider[refund.provider].refund_record_count += 1;
  }
  for (const summary of Object.values(byProvider)) {
    summary.net_amount_cents = summary.gross_amount_cents - summary.refunded_amount_cents;
  }
  const entitlementGaps = orders
    .filter((order) => ["paid", "fulfilled", "partially_refunded"].includes(order.status))
    .filter((order) => !listMemberEntitlements(order.member_id).some((entitlement) => entitlement.report_id === order.report_id && entitlement.has_access))
    .map((order) => ({
      order_id: order.order_id,
      report_id: order.report_id,
      member_id: order.member_id,
      status: order.status
    }));
  const providerStatementSummary = summarizeProviderStatements(providerStatements, orders, refunds);
  return {
    summary: {
      order_count: orders.length,
      payment_event_count: events.length,
      gross_amount_cents: Object.values(byProvider).reduce((sum, item) => sum + item.gross_amount_cents, 0),
      refunded_amount_cents: Object.values(byProvider).reduce((sum, item) => sum + item.refunded_amount_cents, 0),
      net_amount_cents: Object.values(byProvider).reduce((sum, item) => sum + item.net_amount_cents, 0),
      entitlement_gap_count: entitlementGaps.length,
      duplicate_webhook_count: events.filter((event) => event.is_duplicate).length,
      refund_record_count: refunds.length
    },
    by_provider: byProvider,
    provider_statements: providerStatementSummary,
    refunds: refunds.map((refund) => ({
      refund_id: refund.refund_id,
      order_id: refund.order_id,
      provider: refund.provider,
      amount_cents: refund.amount_cents,
      status: refund.status,
      requested_by: refund.requested_by,
      ticket_id: refund.ticket_id,
      created_at: refund.created_at,
      privacy_note: refund.privacy_note
    })),
    entitlement_gaps: entitlementGaps,
    alerts: createReconciliationAlerts({
      providerStatements: providerStatementSummary,
      entitlementGapCount: entitlementGaps.length,
      duplicateWebhookCount: events.filter((event) => event.is_duplicate).length
    }),
    privacy
  };
}

export function importOpsProviderStatement(request: ProviderStatementImportRequest): ProviderStatementImportResponse {
  const auth = assertOpsAuth(request.auth, ["ops_admin"]);
  const statement = buildProviderStatementFromRequest(request, auth);
  productRepository.saveProviderStatement(statement);
  const providerStatementSummary = summarizeProviderStatements([statement], listOrderRecords(), productRepository.listRefundRecords());
  const summary = providerStatementSummary.summary;
  productRepository.saveAdminAuditLog(
    createAdminAuditLog({
      auth,
      action: "ops_provider_statement_imported",
      target_type: "provider_statement",
      target_id: statement.statement_id,
      metadata: {
        provider: statement.provider,
        statement_id: statement.statement_id,
        period_start: statement.period_start,
        period_end: statement.period_end,
        row_count: statement.row_count,
        matched_row_count: summary.matched_row_count,
        amount_mismatch_count: summary.amount_mismatch_count,
        orphan_provider_row_count: summary.orphan_provider_row_count,
        import_format: request.csv?.trim() ? "csv" : "json_rows",
        raw_reference_storage: "digest_only"
      }
    })
  );
  return {
    statement,
    reconciliation: {
      matched_row_count: summary.matched_row_count,
      amount_mismatch_count: summary.amount_mismatch_count,
      orphan_provider_row_count: summary.orphan_provider_row_count,
      alerts: createProviderStatementAlerts(providerStatementSummary)
    },
    privacy
  };
}

export function previewOpsProviderStatement(request: ProviderStatementImportRequest): ProviderStatementPreviewResponse {
  const auth = assertOpsAuth(request.auth, ["ops_admin"]);
  const statement = buildProviderStatementFromRequest(request, auth);
  const providerStatementSummary = summarizeProviderStatements([statement], listOrderRecords(), productRepository.listRefundRecords());
  const summary = providerStatementSummary.summary;
  return {
    statement,
    reconciliation: {
      matched_row_count: summary.matched_row_count,
      amount_mismatch_count: summary.amount_mismatch_count,
      orphan_provider_row_count: summary.orphan_provider_row_count,
      alerts: createProviderStatementAlerts(providerStatementSummary)
    },
    persistence: {
      persisted: false,
      audit_written: false,
      raw_reference_storage: "digest_only"
    },
    privacy
  };
}

export async function sendOpsPaymentAlertWebhook(request: OpsPaymentAlertWebhookRequest): Promise<OpsPaymentAlertWebhookResponse> {
  const auth = assertOpsAuth(request.auth, ["ops_admin"]);
  const mode = request.mode ?? "dry_run";
  if (mode !== "dry_run" && mode !== "send") {
    throw new ApiError("OPS_ALERT_WEBHOOK_MODE_INVALID", "payment alert webhook mode is invalid.", { field: "mode" });
  }
  if (!request.reason?.trim()) {
    throw new ApiError("OPS_ALERT_WEBHOOK_REASON_REQUIRED", "payment alert webhook drill reason is required.", { field: "reason" });
  }
  const reconciliation = getOpsPaymentReconciliation({ auth });
  const now = new Date().toISOString();
  const eventId = createId("ops_payment_alert");
  const payload: OpsPaymentAlertWebhookPayload = {
    event_type: "ops.payment_reconciliation_alerts",
    event_id: eventId,
    created_at: now,
    summary: {
      alert_count: reconciliation.alerts.length,
      critical_count: reconciliation.alerts.filter((alert) => alert.severity === "critical").length,
      warning_count: reconciliation.alerts.filter((alert) => alert.severity === "warning").length,
      info_count: reconciliation.alerts.filter((alert) => alert.severity === "info").length
    },
    alerts: reconciliation.alerts.map(sanitizePaymentAlert),
    privacy_note:
      "Payment alert webhook payloads include sanitized alert summaries only; raw provider references, webhook payloads, member contact data, birth data, and report bodies are excluded."
  };
  const webhookUrl = process.env.OBS_ALERT_WEBHOOK_URL?.trim();
  const webhookSecret = process.env.OBS_ALERT_WEBHOOK_SECRET?.trim();
  const configured = Boolean(webhookUrl && webhookSecret);
  const configurationRequired = webhookUrl ? "OBS_ALERT_WEBHOOK_SECRET" : "OBS_ALERT_WEBHOOK_URL";
  const payloadDigest = digestStatementReference(JSON.stringify(payload));
  const signatureDigest = createHmac("sha256", webhookSecret || "ops-alert-webhook-dry-run-secret").update(JSON.stringify(payload)).digest("hex");
  const idempotencyKey = `ops-payment-alert:${payloadDigest}`;
  const deliveryBody = JSON.stringify(payload);
  const deliveryHeaders = {
    "content-type": "application/json",
    "x-ziwei-alert-event": payload.event_type,
    "x-ziwei-alert-idempotency-key": idempotencyKey,
    "x-ziwei-alert-signature-algorithm": "HMAC-SHA256",
    "x-ziwei-alert-signature": `sha256=${signatureDigest}`
  };
  const deliveryResult = mode === "send" && configured ? await deliverPaymentAlertWebhook(request, webhookUrl as string, deliveryHeaders, deliveryBody) : undefined;
  const attempted = Boolean(deliveryResult);
  const status: OpsPaymentAlertWebhookResponse["status"] =
    mode === "dry_run" ? "dry_run" : !configured ? "blocked" : deliveryResult ? (deliveryResult.ok ? "delivered" : "failed") : "ready_to_send";
  const auditLog = createAdminAuditLog({
    auth,
    action: "ops_payment_alert_webhook_prepared",
    target_type: "payment_reconciliation_alerts",
    target_id: eventId,
    metadata: {
      mode,
      status,
      alert_count: payload.summary.alert_count,
      critical_count: payload.summary.critical_count,
      warning_count: payload.summary.warning_count,
      webhook_configured: configured,
      delivery_attempted: attempted,
      delivery_status: deliveryResult?.status,
      delivery_ok: deliveryResult?.ok,
      payload_digest: payloadDigest,
      signature_algorithm: "HMAC-SHA256",
      reason: sanitizeText(request.reason)
    }
  });
  productRepository.saveAdminAuditLog(auditLog);
  return {
    status,
    payload,
    delivery: {
      configured,
      attempted,
      endpoint_digest: configured ? digestStatementReference(webhookUrl as string) : undefined,
      http_status: deliveryResult?.status,
      response_digest: deliveryResult?.response_digest ? sanitizeText(deliveryResult.response_digest) : undefined,
      error_code: deliveryResult && !deliveryResult.ok ? "ALERT_WEBHOOK_DELIVERY_FAILED" : undefined,
      signature_algorithm: "HMAC-SHA256",
      signature_digest: signatureDigest,
      idempotency_key: idempotencyKey,
      configuration_required: configured ? undefined : configurationRequired
    },
    audit_log: sanitizeAdminAuditLog(auditLog),
    privacy: {
      sensitive_fields_redacted: true,
      raw_provider_reference_hidden: true,
      raw_webhook_url_hidden: true,
      admin_required: true
    }
  };
}

export function listOpsAiGenerations(request: { auth: OpsAuth }) {
  assertOpsAuth(request.auth, ["ops_admin", "content_reviewer"]);
  return {
    records: productRepository.listAiGenerationRecords().sort((left, right) => right.created_at.localeCompare(left.created_at)),
    privacy: {
      raw_prompt_persisted: false,
      raw_birth_data_persisted: false,
      digests_only: true
    }
  };
}

export function listOpsRuleProfiles(request: { auth: OpsAuth }): OpsRuleProfileListResponse {
  assertOpsAuth(request.auth, ["ops_admin", "support_agent", "content_reviewer"]);
  const activeDefaultProfileId = getDefaultRuleProfileId();
  return {
    active_default_profile_id: activeDefaultProfileId,
    profiles: listRuleProfileRecords().map((profile) => summarizeRuleProfileForOps(profile, activeDefaultProfileId)),
    privacy: {
      admin_required: true,
      raw_birth_data_hidden: true,
      report_body_hidden: true,
      prompt_body_hidden: true,
      rule_config_visible: true
    }
  };
}

export function promoteOpsRuleProfile(request: OpsRuleProfilePromotionRequest): OpsRuleProfilePromotionResponse {
  const auth = assertOpsAuth(request.auth, ["ops_admin"]);
  if (!request.second_confirmed) {
    throw new ApiError("OPS_RULE_PROFILE_SECOND_CONFIRM_REQUIRED", "rule profile promotion requires second confirmation.", {
      field: "second_confirmed",
      status: 400
    });
  }
  const profile = getRuleProfileRecord(request.profile_id);
  if (profile.consultant_review_status !== "confirmed") {
    throw new ApiError("RULE_PROFILE_NOT_APPROVED", "rule profile must be consultant-confirmed before it can become the production default.", {
      field: "profile_id",
      status: 409
    });
  }
  const previousDefaultProfileId = getDefaultRuleProfileId();
  const promoted = promoteDefaultRuleProfile(profile.profile_id);
  const activeDefaultProfileId = promoted.active_default_profile_id;
  productRepository.saveRuleVersionState(buildRuleVersionStateRecord(promoted.profile, true));
  const auditLog = createAdminAuditLog({
    auth,
    action: "ops_rule_profile_promoted",
    target_type: "rule_profile",
    target_id: promoted.profile.profile_id,
    metadata: {
      profile_id: promoted.profile.profile_id,
      version_id: promoted.profile.version.version_id,
      previous_default_profile_id: previousDefaultProfileId,
      active_default_profile_id: activeDefaultProfileId,
      consultant_review_status: promoted.profile.consultant_review_status,
      reason: sanitizeText(request.reason),
      ticket_id: request.ticket_id ? sanitizeText(request.ticket_id) : undefined,
      second_confirmed: true
    }
  });
  productRepository.saveAdminAuditLog(auditLog);
  return {
    previous_default_profile_id: previousDefaultProfileId,
    active_default_profile_id: activeDefaultProfileId,
    promoted_profile: summarizeRuleProfileForOps(promoted.profile, activeDefaultProfileId),
    audit_log: sanitizeAdminAuditLog(auditLog),
    privacy: {
      admin_required: true,
      requires_second_confirmation: true,
      audit_logged: true,
      raw_birth_data_hidden: true,
      report_body_hidden: true,
      prompt_body_hidden: true
    }
  };
}

export function listOpsContentReviews(request: OpsContentReviewListRequest): OpsContentReviewListResponse {
  assertOpsAuth(request.auth, ["ops_admin", "content_reviewer"]);
  validateContentReviewFilters(request);
  const records = productRepository.listContentReviewRecords({
    status: request.status,
    report_id: request.report_id,
    source_type: request.source_type
  });
  return {
    reviews: records.map(sanitizeContentReviewRecord).sort((left, right) => right.checked_at.localeCompare(left.checked_at)),
    summary: summarizeContentReviews(records),
    filters: {
      status: request.status,
      report_id: request.report_id ? sanitizeText(request.report_id) : undefined,
      source_type: request.source_type
    },
    privacy: {
      sensitive_fields_masked: true,
      raw_content_hidden: true,
      admin_required: true
    }
  };
}

export function listOpsUsers(request: { auth: OpsAuth; member_id?: string; visitor_id?: string }): OpsUserListResponse {
  assertOpsAuth(request.auth, ["ops_admin", "support_agent"]);
  const chartOwners = listChartOwnerRecords();
  const orders = listOrderRecords();
  const entitlements = listMemberEntitlements();
  const tickets = listSupportTickets();
  const users = listUserRecords()
    .filter((user) => (request.member_id ? user.member_id === request.member_id : true))
    .map((user) => ({
      member_id: sanitizeText(user.member_id),
      display_name: sanitizeText(user.display_name),
      created_at: user.created_at,
      upgraded_from_visitor_id: user.upgraded_from_visitor_id ? sanitizeText(user.upgraded_from_visitor_id) : undefined,
      has_email_hash: Boolean(user.email_hash),
      has_phone_hash: Boolean(user.phone_hash),
      chart_count: chartOwners.filter((owner) => owner.member_id === user.member_id).length,
      report_count: listReportDraftRecords().filter((report) => report.chart_ref?.chart_id && chartOwners.some((owner) => owner.chart_id === report.chart_ref?.chart_id && owner.member_id === user.member_id)).length,
      order_count: orders.filter((order) => order.member_id === user.member_id).length,
      entitlement_count: entitlements.filter((entitlement) => entitlement.member_id === user.member_id).length,
      support_ticket_count: tickets.filter((ticket) => ticket.member_id === user.member_id).length,
      privacy_note: "Ops user summaries hide contact hashes, raw identities, and birth data."
    }));
  const anonymousVisitors = listAnonymousVisitorRecords()
    .filter((visitor) => (request.visitor_id ? visitor.visitor_id === request.visitor_id : true))
    .map((visitor) => ({
      visitor_id: sanitizeText(visitor.visitor_id),
      first_seen_at: visitor.first_seen_at,
      upgraded_member_id: visitor.upgraded_member_id ? sanitizeText(visitor.upgraded_member_id) : undefined,
      upgraded_at: visitor.upgraded_at,
      chart_count: chartOwners.filter((owner) => owner.visitor_id === visitor.visitor_id).length,
      privacy_note: "Ops anonymous visitor summaries hide raw browser identifiers and birth data."
    }));
  const memberFallbacks =
    request.member_id && !users.length
      ? summarizeMemberFallback(request.member_id, chartOwners, orders, entitlements, tickets)
      : [];
  return {
    users: [...users, ...memberFallbacks],
    anonymous_visitors: anonymousVisitors,
    filters: {
      member_id: request.member_id ? sanitizeText(request.member_id) : undefined,
      visitor_id: request.visitor_id ? sanitizeText(request.visitor_id) : undefined
    },
    privacy: {
      sensitive_fields_masked: true,
      contact_hashes_hidden: true,
      admin_required: true
    }
  };
}

export function listOpsReports(request: { auth: OpsAuth; report_id?: string; chart_id?: string; review_status?: ContentReviewStatus }): OpsReportListResponse {
  assertOpsAuth(request.auth, ["ops_admin", "support_agent", "content_reviewer"]);
  if (request.review_status && !["approved", "needs_review", "blocked"].includes(request.review_status)) {
    throw new ApiError("INVALID_CONTENT_REVIEW_STATUS", "content review status is invalid.", { field: "review_status" });
  }
  return {
    reports: listReportDraftRecords()
      .filter((report) => (request.report_id ? report.report_id === request.report_id : true))
      .filter((report) => (request.chart_id ? report.chart_ref?.chart_id === request.chart_id : true))
      .filter((report) => (request.review_status ? report.review.status === request.review_status : true))
      .map((report) => ({
        report_id: sanitizeText(report.report_id),
        report_type: report.report_type,
        mode: report.mode,
        title: sanitizeText(report.title),
        created_at: report.created_at,
        rule_profile_id: report.rule_profile_id ? sanitizeText(report.rule_profile_id) : undefined,
        rule_version: report.rule_version ? sanitizeText(report.rule_version) : undefined,
        report_version: report.report_version ?? 1,
        prompt_version: sanitizeText(report.lineage?.prompt_version ?? "legacy_prompt_unrecorded"),
        access_policy: report.access?.policy ?? "private_paid",
        free_summary_enabled: report.access?.free_summary_enabled ?? Boolean(report.share_summary),
        template_id: sanitizeText(report.template_id),
        template_version: report.template_version,
        chart_id: report.chart_ref?.chart_id ? sanitizeText(report.chart_ref.chart_id) : undefined,
        review_status: report.review.status,
        section_count: report.sections.length,
        creator_asset_count: report.creator_assets.length,
        safety_flags: report.safety_flags.map(sanitizeText),
        price_tier_hint: report.price_tier_hint,
        privacy_note: "Ops report summaries hide report body, trace detail, full birth data, and private paid content."
      }))
      .sort((left, right) => right.created_at.localeCompare(left.created_at)),
    filters: {
      report_id: request.report_id ? sanitizeText(request.report_id) : undefined,
      chart_id: request.chart_id ? sanitizeText(request.chart_id) : undefined,
      review_status: request.review_status
    },
    privacy: {
      sensitive_fields_masked: true,
      report_body_hidden: true,
      admin_required: true
    }
  };
}

export function listOpsShares(request: { auth: OpsAuth; share_id?: string; source_id?: string; source_type?: ShareLandingSourceType }): OpsShareListResponse {
  assertOpsAuth(request.auth, ["ops_admin", "support_agent", "content_reviewer"]);
  return {
    shares: listShareLandingSnapshotRecords()
      .filter((share) => (request.share_id ? share.share_id === request.share_id : true))
      .filter((share) => (request.source_id ? share.source_id === request.source_id : true))
      .filter((share) => (request.source_type ? share.source_type === request.source_type : true))
      .map((share) => ({
        share_id: sanitizeText(share.share_id),
        source_type: share.source_type,
        source_id: sanitizeText(share.source_id),
        title: sanitizeText(share.title),
        summary: sanitizeText(share.summary),
        keyword_count: share.keywords.length,
        safety_flags: share.safety_flags.map(sanitizeText),
        created_at: share.created_at,
        privacy_note: sanitizeText(share.privacy_note)
      }))
      .sort((left, right) => right.created_at.localeCompare(left.created_at)),
    filters: {
      share_id: request.share_id ? sanitizeText(request.share_id) : undefined,
      source_id: request.source_id ? sanitizeText(request.source_id) : undefined,
      source_type: request.source_type
    },
    privacy: {
      sensitive_fields_masked: true,
      share_snapshot_redacted: true,
      admin_required: true
    }
  };
}

export function revealOpsSensitiveRecord(request: OpsSensitiveRecordRevealRequest): OpsSensitiveRecordRevealResponse {
  const auth = assertOpsAuth(request.auth, ["ops_admin"]);
  validateSensitiveRecordRevealRequest(request);
  const record = resolveSensitiveRecord(request.record_type, request.record_id);
  const auditLog = createAdminAuditLog({
    auth,
    action: "ops_sensitive_record_revealed",
    target_type: request.record_type,
    target_id: request.record_id,
    metadata: {
      reason: sanitizeText(request.reason),
      second_confirmed: true,
      ticket_id: request.ticket_id ? sanitizeText(request.ticket_id) : undefined,
      raw_birth_profile_decryption_available: false
    }
  });
  productRepository.saveAdminAuditLog(auditLog);
  return {
    record_type: request.record_type,
    record_id: sanitizeText(request.record_id),
    record,
    audit_log: sanitizeAdminAuditLog(auditLog),
    privacy: {
      sensitive_fields_visible: true,
      admin_only: true,
      requires_second_confirmation: true,
      audit_logged: true,
      raw_birth_profile_decryption_available: false
    }
  };
}

export function listOpsAdminAuditLogs(request: { auth: OpsAuth }): OpsAdminAuditListResponse {
  assertOpsAuth(request.auth, ["ops_admin"]);
  return {
    logs: productRepository
      .listAdminAuditLogs()
      .map(sanitizeAdminAuditLog)
      .sort((left, right) => right.created_at.localeCompare(left.created_at)),
    privacy: {
      metadata_redacted: true,
      admin_required: true,
      raw_birth_data_hidden: true
    }
  };
}

export function markOpsManualRefund(request: OpsRefundRequest): OpsRefundResponse {
  const auth = assertOpsAuth(request.auth, ["ops_admin"]);
  if (!request.reason?.trim()) {
    throw new ApiError("REFUND_REASON_REQUIRED", "manual refund reason is required.", { field: "reason" });
  }
  const existingOrder = listOrderRecords().find((item) => item.order_id === request.order_id);
  const order =
    request.amount_cents !== undefined
      ? markPartialRefund(request.order_id, request.amount_cents, request.reason)
      : markManualRefund(request.order_id, request.reason);
  const note = createOrderNote({
    order_id: order.order_id,
    ticket_id: request.ticket_id,
    action: order.status === "partially_refunded" ? "partial_refund_marked" : "manual_refund_marked",
    note: `${order.status === "partially_refunded" ? "partial_refund" : "manual_refund"} amount_cents=${order.refunded_amount_cents ?? existingOrder?.amount_cents ?? order.amount_cents}; ${request.reason}`,
    actor_role: auth.role,
    actor_id: auth.actor_id
  });
  const refund = productRepository
    .listRefundRecords(order.order_id)
    .sort((left, right) => right.created_at.localeCompare(left.created_at))[0];
  if (!refund) {
    throw new ApiError("REFUND_RECORD_NOT_FOUND", "refund record was not created for the manual refund.", { field: "refund_id", status: 500 });
  }
  return { order, refund, note, privacy };
}

export function reissueOpsEntitlement(request: OpsEntitlementReissueRequest): OpsEntitlementReissueResponse {
  const auth = assertOpsAuth(request.auth, ["ops_admin", "support_agent"]);
  if (!request.reason?.trim()) {
    throw new ApiError("ENTITLEMENT_REISSUE_REASON_REQUIRED", "entitlement reissue reason is required.", { field: "reason" });
  }
  const order = listOrderRecords().find((item) => item.order_id === request.order_id);
  if (!order) {
    throw new ApiError("ORDER_NOT_FOUND", "order not found.", { field: "order_id", status: 404 });
  }
  if (!["paid", "fulfilled", "partially_refunded", "refunded"].includes(order.status)) {
    throw new ApiError("ORDER_NOT_ENTITLEMENT_ELIGIBLE", "order is not eligible for entitlement reissue.", { field: "order_status", status: 409 });
  }
  const entitlement = grantManualEntitlement({
    member_id: order.member_id,
    report_id: order.report_id,
    source_order_id: order.order_id,
    export_preview_credits: request.export_preview_credits
  });
  const note = createOrderNote({
    order_id: order.order_id,
    ticket_id: request.ticket_id,
    action: "entitlement_reissued",
    note: request.reason,
    actor_role: auth.role,
    actor_id: auth.actor_id
  });
  return { entitlement, note, privacy };
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

export function createOpsSupportTicket(request: {
  auth: OpsAuth;
  order_id: string;
  category: SupportTicketRequest["category"];
  priority: SupportTicketRequest["priority"];
  subject: string;
  message: string;
  consent: SupportTicketRequest["consent"];
}): SupportTicket {
  const auth = assertOpsAuth(request.auth, ["ops_admin", "support_agent"]);
  const order = listOrderRecords().find((item) => item.order_id === request.order_id);
  if (!order) {
    throw new ApiError("ORDER_NOT_FOUND", "order not found.", { field: "order_id", status: 404 });
  }
  const ticket = createSupportTicket({
    member_id: order.member_id,
    order_id: order.order_id,
    report_id: order.report_id,
    category: request.category,
    priority: request.priority,
    subject: request.subject,
    message: request.message,
    consent: request.consent
  });
  const now = new Date().toISOString();
  const updated: SupportTicket = {
    ...ticket,
    audit_trail: [
      ...ticket.audit_trail,
      {
        audit_id: createId("audit"),
        action: "ops_support_ticket_created",
        actor_role: auth.role,
        actor_id: auth.actor_id,
        note: sanitizeText(`Created from order ${order.order_id}.`),
        created_at: now
      }
    ]
  };
  saveSupportTicket(updated);
  createOrderNote({
    order_id: order.order_id,
    ticket_id: updated.ticket_id,
    action: "support_note_added",
    note: sanitizeText("Ops support ticket created from order context."),
    actor_role: auth.role,
    actor_id: auth.actor_id
  });
  return updated;
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

export function createPrivacyDeletionRequest(request: PrivacyDeletionRequestInput): PrivacyDeletionRequestResponse {
  const memberId = request.member_id ? sanitizeText(request.member_id) : undefined;
  const visitorId = request.visitor_id ? sanitizeText(request.visitor_id) : undefined;
  if (!memberId && !visitorId) {
    throw new ApiError("DELETION_SUBJECT_REQUIRED", "member_id or visitor_id is required.", { field: "member_id" });
  }
  const scope = request.scope ?? "all_personal_data";
  if (!dataDeletionScopes.includes(scope)) {
    throw new ApiError("INVALID_DELETION_SCOPE", "deletion scope is invalid.", { field: "scope" });
  }

  const message = sanitizeText(request.message ?? "用户请求删除出生资料、命盘、报告、分享、订单和权益关联数据。");
  const ticket = createSupportTicket({
    member_id: memberId ?? visitorId ?? "privacy_subject",
    category: "privacy_deletion",
    priority: "high",
    subject: "隐私数据删除/账号注销请求",
    message,
    consent: {
      agreed: true,
      no_sensitive_birth_data: true
    }
  });
  const now = new Date().toISOString();
  const deletionRequest: DataDeletionRequestRecord = {
    deletion_request_id: createId("deletion"),
    member_id: memberId,
    visitor_id: visitorId,
    ticket_id: ticket.ticket_id,
    status: "requested",
    scope,
    requested_at: now,
    updated_at: now,
    audit_trail: [
      {
        audit_id: createId("audit"),
        action: "data_deletion_requested",
        actor_role: "user",
        note: "Request created from privacy deletion API.",
        created_at: now
      }
    ],
    privacy_note: "Deletion requests persist subject ids, scope, status, audit trail, and support ticket linkage; raw birth data is redacted."
  };
  saveDataDeletionRequest(deletionRequest);
  return {
    deletion_request: sanitizeDataDeletionRequest(deletionRequest),
    ticket,
    privacy: deletionPrivacy
  };
}

export function listOpsDataDeletionRequests(request: OpsDataDeletionListRequest): OpsDataDeletionListResponse {
  assertOpsAuth(request.auth, ["ops_admin", "support_agent"]);
  validateDeletionFilters(request);
  const records = listDataDeletionRequests().filter((record) => {
    if (request.status && record.status !== request.status) return false;
    if (request.member_id && record.member_id !== request.member_id) return false;
    if (request.visitor_id && record.visitor_id !== request.visitor_id) return false;
    return true;
  });
  return {
    requests: records.map(sanitizeDataDeletionRequest).sort((left, right) => right.requested_at.localeCompare(left.requested_at)),
    summary: summarizeDataDeletionRequests(records),
    filters: {
      status: request.status,
      member_id: request.member_id ? sanitizeText(request.member_id) : undefined,
      visitor_id: request.visitor_id ? sanitizeText(request.visitor_id) : undefined
    },
    privacy: deletionPrivacy
  };
}

export function updateOpsDataDeletionRequest(request: OpsDataDeletionUpdateRequest): OpsDataDeletionUpdateResponse {
  const auth = assertOpsAuth(request.auth, ["ops_admin"]);
  if (!dataDeletionStatuses.includes(request.status)) {
    throw new ApiError("INVALID_DELETION_STATUS", "deletion status is invalid.", { field: "status" });
  }
  if (!request.note?.trim()) {
    throw new ApiError("DELETION_NOTE_REQUIRED", "deletion status update note is required.", { field: "note" });
  }
  if (["completed", "rejected", "cancelled"].includes(request.status) && !request.second_confirmed) {
    throw new ApiError("DELETION_SECOND_CONFIRM_REQUIRED", "destructive deletion actions require second confirmation.", {
      field: "second_confirmed",
      status: 409
    });
  }
  const current = getDataDeletionRequestRecord(request.deletion_request_id);
  if (!current) {
    throw new ApiError("DELETION_REQUEST_NOT_FOUND", "data deletion request not found.", { field: "deletion_request_id", status: 404 });
  }

  const now = new Date().toISOString();
  const action = `data_deletion_${request.status}`;
  const updated: DataDeletionRequestRecord = {
    ...current,
    status: request.status,
    updated_at: now,
    completed_at: request.status === "completed" ? now : current.completed_at,
    audit_log_id: request.status === "completed" ? createId("audit") : current.audit_log_id,
    audit_trail: [
      ...current.audit_trail,
      {
        audit_id: createId("audit"),
        action,
        actor_role: auth.role,
        actor_id: auth.actor_id,
        note: sanitizeText(request.note),
        created_at: now
      }
    ]
  };
  saveDataDeletionRequest(updated);
  const ticket = current.ticket_id ? getSupportTicketRecord(current.ticket_id) : undefined;
  if (ticket && (request.status === "completed" || request.status === "rejected" || request.status === "cancelled")) {
    updateSupportTicket({
      auth,
      ticket_id: ticket.ticket_id,
      status: request.status === "completed" ? "resolved" : "closed",
      assignee: auth.actor_id,
      note: `Data deletion ${request.status}: ${request.note}`
    });
  }
  return {
    deletion_request: sanitizeDataDeletionRequest(updated),
    ticket: ticket ? getSupportTicketRecord(ticket.ticket_id) : undefined,
    privacy: deletionPrivacy
  };
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

export function getInternalGrowthInsights(request: { auth: OpsAuth }): InternalGrowthInsights {
  assertOpsAuth(request.auth, ["ops_admin", "support_agent", "content_reviewer"]);
  const launchGrowth = summarizeGrowth();
  const channelDashboard = getChannelDashboard().dashboard;
  const channelEvents = listChannelGrowthEvents();
  const channelMix = summarizeChannelMix(channelEvents, channelDashboard);
  const proxy = summarizeGrowthProxy(channelEvents, launchGrowth, channelDashboard);
  const anomalies = summarizeGrowthAnomalies(channelEvents, channelMix, proxy);
  return {
    launch_growth: launchGrowth,
    channel_dashboard: channelDashboard,
    channel_mix: channelMix,
    proxy,
    anomalies,
    measurement_note:
      "Exact ROI is not available because channel events and launch events are not joined to provider cost data. The numbers below are conservative proxies derived from shared member overlap, channel volume, and recorded launch value_cents only.",
    privacy
  };
}

export function getOpsOverview(request: { auth: OpsAuth }): OpsOverview {
  const auth = assertOpsAuth(request.auth, ["ops_admin", "support_agent", "content_reviewer"]);
  const supportTickets = listSupportTickets();
  const adminAuditLogCount = productRepository.listAdminAuditLogs().length;
  return {
    modules: {
      users: countUserRecords(),
      anonymous_visitors: countAnonymousVisitorRecords(),
      charts: countChartRecords(),
      reports: countReportDraftRecords(),
      orders: listOrderRecords().length,
      payment_events: listPaymentEvents().length,
      entitlements: listMemberEntitlements().length,
      support_tickets: supportTickets.length,
      data_deletion_requests: listDataDeletionRequests().length,
      feedback: listFeedback().length,
      content_rules: 2,
      content_reviews: productRepository.listContentReviewRecords().length,
      shares: countShareLandingRecords(),
      channel_events: listChannelGrowthEvents().length,
      system_logs: listOpsOrderNotes().length + supportTickets.length,
      admin_audit_logs: adminAuditLogCount
    },
    privacy: {
      sensitive_fields_masked: true,
      exports_redacted: true,
      admin_required: true
    }
  };
}

function validateSensitiveRecordRevealRequest(request: OpsSensitiveRecordRevealRequest): void {
  if (!opsSensitiveRecordTypes.includes(request.record_type)) {
    throw new ApiError("INVALID_OPS_SENSITIVE_RECORD_TYPE", "sensitive record type is invalid.", { field: "record_type" });
  }
  if (!request.record_id?.trim()) {
    throw new ApiError("OPS_SENSITIVE_RECORD_ID_REQUIRED", "sensitive record id is required.", { field: "record_id" });
  }
  if (!request.reason?.trim()) {
    throw new ApiError("OPS_SENSITIVE_REASON_REQUIRED", "sensitive record reveal reason is required.", { field: "reason" });
  }
  if (!request.second_confirmed) {
    throw new ApiError("OPS_SENSITIVE_SECOND_CONFIRM_REQUIRED", "sensitive record reveal requires second confirmation.", {
      field: "second_confirmed",
      status: 409
    });
  }
}

function resolveSensitiveRecord(recordType: OpsSensitiveRecordRevealRequest["record_type"], recordId: string): Record<string, unknown> {
  if (recordType === "chart") {
    const chart = productRepository.getChart(recordId);
    const owner = productRepository.getChartOwner(recordId);
    if (!chart) throw new ApiError("OPS_SENSITIVE_RECORD_NOT_FOUND", "chart record not found.", { field: "record_id", status: 404 });
    return {
      chart_id: sanitizeText(chart.chart_id),
      owner: owner
        ? {
            chart_id: sanitizeText(owner.chart_id),
            visitor_id: owner.visitor_id ? sanitizeText(owner.visitor_id) : undefined,
            member_id: owner.member_id ? sanitizeText(owner.member_id) : undefined,
            created_at: owner.created_at
          }
        : undefined,
      rule_profile_id: sanitizeText(chart.rule_profile_id),
      rule_version: sanitizeText(chart.rule_version),
      normalized_birth: chart.normalized_birth,
      trace: chart.trace,
      warnings: chart.warnings,
      privacy_note: "Full chart calculation context is visible only to ops_admin after second confirmation and audit logging; encrypted raw birth_profile fields are not decrypted by this endpoint."
    };
  }
  if (recordType === "report") {
    const report = productRepository.getReportDraft(recordId);
    if (!report) throw new ApiError("OPS_SENSITIVE_RECORD_NOT_FOUND", "report record not found.", { field: "record_id", status: 404 });
    return {
      ...report,
      privacy_note: "Full report body is visible only to ops_admin after second confirmation and audit logging."
    } as unknown as Record<string, unknown>;
  }
  if (recordType === "order") {
    const order = productRepository.getOrder(recordId);
    if (!order) throw new ApiError("OPS_SENSITIVE_RECORD_NOT_FOUND", "order record not found.", { field: "record_id", status: 404 });
    return {
      ...order,
      privacy_note: "Full order linkage is visible only to ops_admin after second confirmation and audit logging."
    } as unknown as Record<string, unknown>;
  }
  if (recordType === "share") {
    const share = productRepository.getShareLandingSnapshot(recordId);
    if (!share) throw new ApiError("OPS_SENSITIVE_RECORD_NOT_FOUND", "share record not found.", { field: "record_id", status: 404 });
    return {
      ...share,
      privacy_note: "Share snapshots remain redacted; ops_admin reveal confirms no full birth data is present."
    } as unknown as Record<string, unknown>;
  }
  const ticket = productRepository.getSupportTicket(recordId);
  if (!ticket) throw new ApiError("OPS_SENSITIVE_RECORD_NOT_FOUND", "support ticket record not found.", { field: "record_id", status: 404 });
  return {
    ...ticket,
    privacy_note: "Support ticket text is sanitized before storage; ops_admin reveal is still second-confirmed and audited."
  } as unknown as Record<string, unknown>;
}

function createAdminAuditLog(input: {
  auth: Required<OpsAuth>;
  action: string;
  target_type: string;
  target_id?: string;
  metadata: AdminAuditLog["metadata"];
}): AdminAuditLog {
  return {
    audit_log_id: createId("audit_log"),
    actor_id: sanitizeText(input.auth.actor_id),
    actor_role: input.auth.role,
    action: sanitizeText(input.action),
    target_type: sanitizeText(input.target_type),
    target_id: input.target_id ? sanitizeText(input.target_id) : undefined,
    metadata: sanitizeAuditMetadata(input.metadata),
    created_at: new Date().toISOString(),
    privacy_note: "Admin audit logs store actor, action, target, and redacted metadata only; raw birth data, phone numbers, and report bodies are not stored."
  };
}

function sanitizeAdminAuditLog(log: AdminAuditLog): AdminAuditLog {
  return {
    ...log,
    audit_log_id: sanitizeText(log.audit_log_id),
    actor_id: sanitizeText(log.actor_id),
    action: sanitizeText(log.action),
    target_type: sanitizeText(log.target_type),
    target_id: log.target_id ? sanitizeText(log.target_id) : undefined,
    metadata: sanitizeAuditMetadata(log.metadata),
    ip_hash: log.ip_hash ? sanitizeText(log.ip_hash) : undefined,
    privacy_note: sanitizeText(log.privacy_note)
  };
}

function sanitizePaymentAlert(alert: OpsPaymentReconciliationAlert): OpsPaymentReconciliationAlert {
  return {
    code: alert.code,
    severity: alert.severity,
    provider: alert.provider,
    count: alert.count,
    title: sanitizeText(alert.title),
    detail: sanitizeText(alert.detail),
    action: sanitizeText(alert.action),
    privacy_note: sanitizeText(alert.privacy_note)
  };
}

async function deliverPaymentAlertWebhook(
  request: OpsPaymentAlertWebhookRequest,
  url: string,
  headers: Record<string, string>,
  body: string
): Promise<OpsPaymentAlertWebhookSenderResult> {
  try {
    if (request.sender) {
      return await request.sender({ url, headers, body });
    }
    const response = await fetch(url, {
      method: "POST",
      headers,
      body
    });
    const responseText = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      response_digest: responseText ? digestStatementReference(responseText.slice(0, 4096)) : undefined
    };
  } catch {
    return {
      ok: false,
      status: 0,
      response_digest: undefined
    };
  }
}

function sanitizeAuditMetadata(metadata: AdminAuditLog["metadata"]): AdminAuditLog["metadata"] {
  return Object.fromEntries(
    Object.entries(metadata)
      .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)
      .map(([key, value]) => [sanitizeText(key), typeof value === "string" ? sanitizeText(value) : value])
  );
}

function assertOpsAuth(auth: OpsAuth | undefined, allowedRoles: readonly OpsRole[]): Required<OpsAuth> {
  const token = auth?.token || "";
  const role = process.env.NODE_ENV === "test" ? auth?.role || "support_agent" : configuredOpsRole();
  const expectedToken = getConfiguredOpsToken();
  if (!expectedToken || token !== expectedToken || !opsRoles.includes(role)) {
    recordUnauthorizedOpsAccess();
    throw new ApiError("OPS_AUTH_REQUIRED", "ops access is not authorized.", { field: "x-admin-token", status: 401 });
  }
  if (!allowedRoles.includes(role)) {
    recordUnauthorizedOpsAccess();
    throw new ApiError("OPS_ROLE_FORBIDDEN", "ops role is not allowed for this action.", { field: "x-admin-role", status: 403 });
  }
  assertOpsMfa(auth);
  return {
    token,
    role,
    // Actor identity is server-derived; never trust a client supplied actor.
    actor_id: `ops:${role}`,
    mfa_code: auth?.mfa_code || ""
  };
}

function assertOpsMfa(auth: OpsAuth | undefined): void {
  if (process.env.PHASE10_OPS_MFA_ENABLED !== "true") return;
  const configuredCode = process.env.PHASE10_OPS_MFA_CODE?.trim();
  if (!configuredCode) {
    recordUnauthorizedOpsAccess();
    throw new ApiError("OPS_MFA_NOT_CONFIGURED", "ops second factor is not configured.", { field: "PHASE10_OPS_MFA_CODE", status: 503 });
  }
  if ((auth?.mfa_code || "").trim() !== configuredCode) {
    recordUnauthorizedOpsAccess();
    throw new ApiError("OPS_MFA_REQUIRED", "ops second factor is required.", { field: "x-admin-mfa-code", status: 403 });
  }
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

function validateDeletionFilters(request: OpsDataDeletionListRequest): void {
  if (request.status && !dataDeletionStatuses.includes(request.status)) {
    throw new ApiError("INVALID_DELETION_STATUS", "deletion status is invalid.", { field: "status" });
  }
}

function sanitizeDataDeletionRequest(record: DataDeletionRequestRecord): DataDeletionRequestRecord {
  return {
    ...record,
    deletion_request_id: sanitizeText(record.deletion_request_id),
    member_id: record.member_id ? sanitizeText(record.member_id) : undefined,
    visitor_id: record.visitor_id ? sanitizeText(record.visitor_id) : undefined,
    ticket_id: record.ticket_id ? sanitizeText(record.ticket_id) : undefined,
    audit_log_id: record.audit_log_id ? sanitizeText(record.audit_log_id) : undefined,
    audit_trail: record.audit_trail.map((entry) => ({
      ...entry,
      audit_id: sanitizeText(entry.audit_id),
      actor_id: entry.actor_id ? sanitizeText(entry.actor_id) : undefined,
      note: entry.note ? sanitizeText(entry.note) : undefined
    })),
    privacy_note: sanitizeText(record.privacy_note)
  };
}

function summarizeDataDeletionRequests(records: DataDeletionRequestRecord[]): OpsDataDeletionListResponse["summary"] {
  return {
    total: records.length,
    requested: records.filter((record) => record.status === "requested").length,
    verifying: records.filter((record) => record.status === "verifying").length,
    processing: records.filter((record) => record.status === "processing").length,
    completed: records.filter((record) => record.status === "completed").length,
    rejected: records.filter((record) => record.status === "rejected").length,
    cancelled: records.filter((record) => record.status === "cancelled").length
  };
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

function createReconciliationProviderSummary(): Record<PaymentProvider, OpsPaymentReconciliationResponse["by_provider"][PaymentProvider]> {
  return {
    stripe_checkout: createProviderReconciliation("stripe_checkout"),
    mock_checkout: createProviderReconciliation("mock_checkout"),
    wechat_pay_reserved: createProviderReconciliation("wechat_pay_reserved"),
    alipay_reserved: createProviderReconciliation("alipay_reserved")
  };
}

function createProviderReconciliation(provider: PaymentProvider): OpsPaymentReconciliationResponse["by_provider"][PaymentProvider] {
  return {
    provider,
    order_count: 0,
    payment_event_count: 0,
    refund_record_count: 0,
    gross_amount_cents: 0,
    refunded_amount_cents: 0,
    net_amount_cents: 0
  };
}

function summarizeProviderStatements(
  statements: ProviderStatement[],
  orders: Order[],
  refunds: RefundRecord[]
): OpsPaymentReconciliationResponse["provider_statements"] {
  const ordersById = new Map(orders.map((order) => [order.order_id, order]));
  const refundsById = new Map(refunds.map((refund) => [refund.refund_id, refund]));
  let matchedRowCount = 0;
  const discrepancies: OpsPaymentReconciliationResponse["provider_statements"]["discrepancies"] = [];

  for (const statement of statements) {
    for (const row of statement.rows) {
      const internalAmount =
        row.type === "refund"
          ? findStatementRefund(row.refund_id, refundsById)?.amount_cents
          : findStatementOrder(row.order_id, ordersById)?.amount_cents;
      if (internalAmount === undefined) {
        discrepancies.push({
          type: "orphan_provider_row",
          provider: statement.provider,
          provider_transaction_id: sanitizeText(row.provider_transaction_id),
          order_id: row.order_id ? sanitizeText(row.order_id) : undefined,
          refund_id: row.refund_id ? sanitizeText(row.refund_id) : undefined,
          statement_amount_cents: row.amount_cents,
          privacy_note: "Provider statement row could not be matched; raw provider reference is hidden and only digest metadata may be stored."
        });
        continue;
      }
      if (internalAmount !== row.amount_cents) {
        discrepancies.push({
          type: "amount_mismatch",
          provider: statement.provider,
          provider_transaction_id: sanitizeText(row.provider_transaction_id),
          order_id: row.order_id ? sanitizeText(row.order_id) : undefined,
          refund_id: row.refund_id ? sanitizeText(row.refund_id) : undefined,
          statement_amount_cents: row.amount_cents,
          internal_amount_cents: internalAmount,
          privacy_note: "Provider statement amount differs from internal finance records; no user contact, birth data, or raw provider memo is exposed."
        });
        continue;
      }
      matchedRowCount += 1;
    }
  }

  return {
    summary: {
      statement_count: statements.length,
      statement_row_count: statements.reduce((sum, statement) => sum + statement.row_count, 0),
      matched_row_count: matchedRowCount,
      amount_mismatch_count: discrepancies.filter((item) => item.type === "amount_mismatch").length,
      orphan_provider_row_count: discrepancies.filter((item) => item.type === "orphan_provider_row").length
    },
    statements: statements
      .map((statement) => ({
        statement_id: sanitizeText(statement.statement_id),
        provider: statement.provider,
        period_start: sanitizeText(statement.period_start),
        period_end: sanitizeText(statement.period_end),
        imported_at: statement.imported_at,
        imported_by: sanitizeText(statement.imported_by),
        row_count: statement.row_count,
        privacy_note: sanitizeText(statement.privacy_note)
      }))
      .sort((left, right) => right.imported_at.localeCompare(left.imported_at)),
    discrepancies
  };
}

function findStatementOrder(orderId: string | undefined, ordersById: Map<string, Order>): Order | undefined {
  if (!orderId) return undefined;
  return ordersById.get(orderId);
}

function findStatementRefund(refundId: string | undefined, refundsById: Map<string, RefundRecord>): RefundRecord | undefined {
  if (!refundId) return undefined;
  return refundsById.get(refundId);
}

function createReconciliationAlerts(input: {
  providerStatements: OpsPaymentReconciliationResponse["provider_statements"];
  entitlementGapCount: number;
  duplicateWebhookCount: number;
}): OpsPaymentReconciliationAlert[] {
  const alerts = createProviderStatementAlerts(input.providerStatements);
  if (input.entitlementGapCount > 0) {
    alerts.push({
      code: "ENTITLEMENT_GAP_DETECTED",
      severity: "critical",
      count: input.entitlementGapCount,
      title: "Paid orders missing entitlements",
      detail: `${input.entitlementGapCount} paid or fulfilled order(s) have no active report entitlement.`,
      action: "Reissue entitlement or investigate fulfillment before closing daily reconciliation.",
      privacy_note: "Alert exposes counts only; member ids, report bodies, and birth data stay hidden in the default finance view."
    });
  }
  if (input.duplicateWebhookCount > 0) {
    alerts.push({
      code: "DUPLICATE_WEBHOOK_REPLAY",
      severity: "warning",
      count: input.duplicateWebhookCount,
      title: "Duplicate payment webhooks detected",
      detail: `${input.duplicateWebhookCount} payment webhook replay(s) were marked duplicate.`,
      action: "Verify idempotency keys and provider retry windows before changing payment state manually.",
      privacy_note: "Alert exposes replay counts only and does not include raw webhook payloads or signatures."
    });
  }
  return alerts;
}

function createProviderStatementAlerts(providerStatements: OpsPaymentReconciliationResponse["provider_statements"]): OpsPaymentReconciliationAlert[] {
  const alerts: OpsPaymentReconciliationAlert[] = [];
  const mismatchByProvider = countDiscrepanciesByProvider(providerStatements.discrepancies, "amount_mismatch");
  const orphanByProvider = countDiscrepanciesByProvider(providerStatements.discrepancies, "orphan_provider_row");
  for (const [provider, count] of mismatchByProvider) {
    alerts.push({
      code: "PROVIDER_STATEMENT_AMOUNT_MISMATCH",
      severity: "warning",
      provider,
      count,
      title: "Provider statement amount mismatch",
      detail: `${count} provider statement row(s) differ from internal finance records.`,
      action: "Review the order, provider transaction, and refund state before settlement close.",
      privacy_note: "Alert hides raw provider references, user contact data, birth data, and report content."
    });
  }
  for (const [provider, count] of orphanByProvider) {
    alerts.push({
      code: "PROVIDER_STATEMENT_ORPHAN_ROWS",
      severity: "critical",
      provider,
      count,
      title: "Provider statement orphan rows",
      detail: `${count} provider statement row(s) cannot be matched to an internal order or refund.`,
      action: "Open a finance review ticket and verify the provider transaction before fulfillment or refund handling.",
      privacy_note: "Alert hides raw provider references, user contact data, birth data, and report content."
    });
  }
  return alerts;
}

function countDiscrepanciesByProvider(
  discrepancies: OpsPaymentReconciliationResponse["provider_statements"]["discrepancies"],
  type: OpsPaymentReconciliationResponse["provider_statements"]["discrepancies"][number]["type"]
): Map<PaymentProvider, number> {
  const counts = new Map<PaymentProvider, number>();
  for (const item of discrepancies) {
    if (item.type !== type) continue;
    counts.set(item.provider, (counts.get(item.provider) ?? 0) + 1);
  }
  return counts;
}

function buildProviderStatementFromRequest(request: ProviderStatementImportRequest, auth: Required<OpsAuth>): ProviderStatement {
  if (!paymentProviders.includes(request.provider)) {
    throw new ApiError("INVALID_PAYMENT_PROVIDER", "provider is invalid.", { field: "provider" });
  }
  if (!request.statement_id?.trim()) {
    throw new ApiError("PROVIDER_STATEMENT_ID_REQUIRED", "statement_id is required.", { field: "statement_id" });
  }
  const inputRows = resolveProviderStatementRows(request);
  if (inputRows.length === 0) {
    throw new ApiError("PROVIDER_STATEMENT_ROWS_REQUIRED", "provider statement rows are required.", { field: "rows" });
  }
  const now = new Date().toISOString();
  return {
    statement_id: sanitizeText(request.statement_id),
    provider: request.provider,
    period_start: sanitizeText(request.period_start),
    period_end: sanitizeText(request.period_end),
    imported_at: now,
    imported_by: sanitizeText(auth.actor_id ?? auth.role),
    row_count: inputRows.length,
    rows: inputRows.map((row) => ({
      provider_transaction_id: sanitizeText(row.provider_transaction_id),
      order_id: row.order_id ? sanitizeText(row.order_id) : undefined,
      refund_id: row.refund_id ? sanitizeText(row.refund_id) : undefined,
      type: row.type,
      amount_cents: Math.round(row.amount_cents),
      occurred_at: row.occurred_at,
      raw_reference_digest: row.raw_reference ? digestStatementReference(row.raw_reference) : undefined
    })),
    privacy_note:
      "Provider statement previews and imports expose provider transaction ids, order/refund ids, amounts, timestamps, and optional raw reference digests only; raw third-party identities, contact data, birth data, names, and report content are not returned."
  };
}

type ProviderStatementInputRow = NonNullable<ProviderStatementImportRequest["rows"]>[number];

function resolveProviderStatementRows(request: ProviderStatementImportRequest): ProviderStatementInputRow[] {
  if (typeof request.csv === "string" && request.csv.trim()) {
    return parseProviderStatementCsv(request.csv);
  }
  if (Array.isArray(request.rows)) {
    return request.rows.map((row, index) => normalizeProviderStatementInputRow(row, index + 1));
  }
  return [];
}

function parseProviderStatementCsv(csv: string): ProviderStatementInputRow[] {
  const records = parseCsvRecords(csv);
  if (records.length < 2) {
    throw new ApiError("PROVIDER_STATEMENT_CSV_EMPTY", "provider statement CSV must include a header and at least one row.", { field: "csv" });
  }
  const headers = records[0]?.map(normalizeCsvHeader) ?? [];
  if (headers.length === 0) {
    throw new ApiError("PROVIDER_STATEMENT_CSV_HEADER_REQUIRED", "provider statement CSV header is required.", { field: "csv" });
  }
  return records
    .slice(1)
    .filter((record) => record.some((value) => value.trim()))
    .map((record, index) => {
      const row = Object.fromEntries(headers.map((header, headerIndex) => [header, record[headerIndex]?.trim() ?? ""]));
      return normalizeProviderStatementInputRow(
        {
          provider_transaction_id: readCsvAlias(row, [
            "provider_transaction_id",
            "transaction_id",
            "wechat_transaction_id",
            "alipay_transaction_id",
            "trade_no",
            "transaction_no",
            "平台交易号",
            "微信支付订单号",
            "支付宝交易号"
          ]) ?? "",
          order_id: readCsvAlias(row, ["order_id", "out_trade_no", "merchant_order_id", "商户订单号", "商户单号"]),
          refund_id: readCsvAlias(row, ["refund_id", "out_refund_no", "merchant_refund_id", "商户退款单号", "退款单号"]),
          type: normalizeProviderStatementRowType(readCsvAlias(row, ["type", "trade_type", "账务类型", "业务类型", "收支类型"]), row),
          amount_cents: readCsvAmountCents(row),
          occurred_at: normalizeStatementOccurredAt(
            readCsvAlias(row, ["occurred_at", "success_time", "payment_time", "refund_time", "交易时间", "支付完成时间", "退款成功时间"])
          ),
          raw_reference: readCsvAlias(row, ["raw_reference", "memo", "remark", "buyer_openid", "buyer_id", "用户标识", "备注"])
        },
        index + 2
      );
    });
}

function normalizeProviderStatementInputRow(row: ProviderStatementInputRow, rowNumber: number): ProviderStatementInputRow {
  const providerTransactionId = sanitizeText(row.provider_transaction_id ?? "");
  const occurredAt = normalizeStatementOccurredAt(row.occurred_at);
  const amountCents = Math.round(Number(row.amount_cents));
  if (!providerTransactionId) {
    throw new ApiError("PROVIDER_STATEMENT_ROW_INVALID", "provider statement row requires provider_transaction_id.", { field: `rows.${rowNumber}.provider_transaction_id` });
  }
  if (row.type !== "payment" && row.type !== "refund") {
    throw new ApiError("PROVIDER_STATEMENT_ROW_INVALID", "provider statement row type must be payment or refund.", { field: `rows.${rowNumber}.type` });
  }
  if (!Number.isFinite(amountCents)) {
    throw new ApiError("PROVIDER_STATEMENT_ROW_INVALID", "provider statement row amount is invalid.", { field: `rows.${rowNumber}.amount_cents` });
  }
  if (!occurredAt) {
    throw new ApiError("PROVIDER_STATEMENT_ROW_INVALID", "provider statement row occurred_at is invalid.", { field: `rows.${rowNumber}.occurred_at` });
  }
  return {
    provider_transaction_id: providerTransactionId,
    order_id: row.order_id ? sanitizeText(row.order_id) : undefined,
    refund_id: row.refund_id ? sanitizeText(row.refund_id) : undefined,
    type: row.type,
    amount_cents: amountCents,
    occurred_at: occurredAt,
    raw_reference: row.raw_reference
  };
}

function parseCsvRecords(csv: string): string[][] {
  const records: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current);
      records.push(row);
      row = [];
      current = "";
      continue;
    }
    current += char;
  }
  row.push(current);
  records.push(row);
  return records.filter((record) => record.some((value) => value.trim()));
}

function normalizeCsvHeader(value: string): string {
  return value.trim().replace(/^\uFEFF/, "").toLowerCase();
}

function readCsvAlias(row: Record<string, string>, aliases: string[]): string | undefined {
  for (const alias of aliases) {
    const value = row[normalizeCsvHeader(alias)];
    if (value?.trim()) return value.trim();
  }
  return undefined;
}

function readCsvAmountCents(row: Record<string, string>): number {
  const cents = readCsvAlias(row, ["amount_cents", "金额分"]);
  if (cents) return Number(cents);
  const yuan = readCsvAlias(row, ["amount_yuan", "total_amount", "refund_amount", "amount", "金额", "订单金额", "退款金额"]);
  if (!yuan) return Number.NaN;
  return Math.round(Number(yuan.replace(/[￥¥,\s]/g, "")) * 100);
}

function normalizeProviderStatementRowType(value: string | undefined, row: Record<string, string>): ProviderStatementRowType {
  const normalized = sanitizeText(value ?? "").toLowerCase();
  if (normalized.includes("refund") || normalized.includes("退款") || readCsvAlias(row, ["refund_id", "out_refund_no", "商户退款单号"])) {
    return "refund";
  }
  return "payment";
}

function normalizeStatementOccurredAt(value: string | undefined): string {
  if (!value?.trim()) return "";
  const trimmed = value.trim();
  const isoCandidate = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  const withTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(isoCandidate) ? isoCandidate : `${isoCandidate}Z`;
  const parsed = new Date(withTimezone);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function digestStatementReference(value: string): string {
  return createHash("sha256").update(sanitizeText(value)).digest("hex");
}

function validateContentReviewFilters(request: OpsContentReviewListRequest): void {
  if (request.status && !["approved", "needs_review", "blocked"].includes(request.status)) {
    throw new ApiError("INVALID_CONTENT_REVIEW_STATUS", "content review status is invalid.", { field: "status" });
  }
  if (request.source_type && !["report", "ai_followup", "manual"].includes(request.source_type)) {
    throw new ApiError("INVALID_CONTENT_REVIEW_SOURCE_TYPE", "content review source type is invalid.", { field: "source_type" });
  }
}

function summarizeMemberFallback(
  memberId: string,
  chartOwners: Array<{ chart_id: string; visitor_id?: string; member_id?: string; created_at: string }>,
  orders: ReturnType<typeof listOrderRecords>,
  entitlements: ReturnType<typeof listMemberEntitlements>,
  tickets: ReturnType<typeof listSupportTickets>
): OpsUserListResponse["users"] {
  const hasRecords =
    chartOwners.some((owner) => owner.member_id === memberId) ||
    orders.some((order) => order.member_id === memberId) ||
    entitlements.some((entitlement) => entitlement.member_id === memberId) ||
    tickets.some((ticket) => ticket.member_id === memberId);
  if (!hasRecords) return [];
  return [
    {
      member_id: sanitizeText(memberId),
      display_name: "未绑定正式账号",
      created_at: new Date(0).toISOString(),
      has_email_hash: false,
      has_phone_hash: false,
      chart_count: chartOwners.filter((owner) => owner.member_id === memberId).length,
      report_count: 0,
      order_count: orders.filter((order) => order.member_id === memberId).length,
      entitlement_count: entitlements.filter((entitlement) => entitlement.member_id === memberId).length,
      support_ticket_count: tickets.filter((ticket) => ticket.member_id === memberId).length,
      privacy_note: "Fallback member summary is derived from related records and hides contact hashes and birth data."
    }
  ];
}

function sanitizeContentReviewRecord(record: ContentReviewQueueItem): ContentReviewQueueItem {
  return {
    ...record,
    review_id: sanitizeText(record.review_id),
    report_id: sanitizeText(record.report_id),
    source_id: sanitizeText(record.source_id),
    reviewer_id: record.reviewer_id ? sanitizeText(record.reviewer_id) : undefined,
    blocked_terms: record.blocked_terms.map(sanitizeText),
    privacy_flags: record.privacy_flags.map(sanitizeText),
    safety_flags: record.safety_flags.map(sanitizeText),
    notes: record.notes.map(sanitizeText)
  };
}

function summarizeRuleProfileForOps(profile: ReturnType<typeof getRuleProfileRecord>, activeDefaultProfileId: string): OpsRuleProfileSummary {
  return {
    profile_id: sanitizeText(profile.profile_id),
    label: sanitizeText(profile.label),
    description: sanitizeText(profile.description),
    version_id: sanitizeText(profile.version.version_id),
    version_label: sanitizeText(profile.version.label),
    released_at: sanitizeText(profile.version.released_at),
    source: sanitizeText(profile.version.source),
    consultant_review_status: profile.consultant_review_status,
    is_active_default: profile.profile_id === activeDefaultProfileId,
    can_promote_to_default: profile.consultant_review_status === "confirmed",
    risk_note: sanitizeText(profile.risk_note),
    supported_features: profile.supported_features.map(sanitizeText),
    safety_flags: profile.safety_flags.map(sanitizeText),
    rule_config_summary: {
      school_id: profile.rule_config.school_id,
      zi_hour_day_boundary: profile.rule_config.zi_hour_day_boundary,
      leap_month_policy: profile.rule_config.leap_month_policy,
      true_solar_time_policy: profile.rule_config.true_solar_time_policy,
      four_transform_policy: profile.rule_config.four_transform_policy,
      interpretation_style: profile.rule_config.interpretation_style
    }
  };
}

function buildRuleVersionStateRecord(profile: ReturnType<typeof getRuleProfileRecord>, activeDefault: boolean) {
  return {
    rule_version_id: profile.version.version_id,
    profile_id: profile.profile_id,
    label: profile.version.label,
    status: profile.consultant_review_status,
    active_default: activeDefault,
    config: profile.rule_config,
    released_at: profile.version.released_at ? new Date(profile.version.released_at).toISOString() : undefined,
    updated_at: new Date().toISOString(),
    privacy_note: "rule version state stores rule metadata only; no birth data, prompts, report bodies, or user identifiers."
  };
}

function summarizeContentReviews(records: ContentReviewQueueItem[]): OpsContentReviewListResponse["summary"] {
  return {
    total: records.length,
    approved: records.filter((record) => record.status === "approved").length,
    needs_review: records.filter((record) => record.status === "needs_review").length,
    blocked: records.filter((record) => record.status === "blocked").length
  };
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

function summarizeChannelMix(
  events: ChannelGrowthEvent[],
  dashboard: ChannelDashboardSummary
): InternalGrowthChannelMixItem[] {
  const uniqueVisitorsByChannel = new Map<ChannelSource, Set<string>>();
  const duplicateCountsByChannel = new Map<ChannelSource, number>();
  const eventCountsByChannel = new Map<ChannelSource, number>();
  for (const channel of channelSources) {
    uniqueVisitorsByChannel.set(channel, new Set());
    duplicateCountsByChannel.set(channel, 0);
    eventCountsByChannel.set(channel, 0);
  }
  for (const event of events) {
    eventCountsByChannel.set(event.channel, (eventCountsByChannel.get(event.channel) ?? 0) + 1);
    if (event.visitor_id) {
      uniqueVisitorsByChannel.get(event.channel)?.add(event.visitor_id);
    }
    if (event.is_duplicate) {
      duplicateCountsByChannel.set(event.channel, (duplicateCountsByChannel.get(event.channel) ?? 0) + 1);
    }
  }
  const totalEvents = Math.max(dashboard.total_channel_events, events.length, 1);
  const totalVisitors = Math.max(dashboard.unique_visitors, new Set(events.filter((event) => event.visitor_id).map((event) => event.visitor_id as string)).size, 1);
  return channelSources.map((channel) => {
    const eventCount = eventCountsByChannel.get(channel) ?? 0;
    const uniqueVisitors = uniqueVisitorsByChannel.get(channel)?.size ?? 0;
    const duplicateCount = duplicateCountsByChannel.get(channel) ?? 0;
    const eventSharePercent = Math.round((eventCount / totalEvents) * 100);
    const visitorSharePercent = Math.round((uniqueVisitors / totalVisitors) * 100);
    return {
      channel,
      event_count: eventCount,
      unique_visitors: uniqueVisitors,
      event_share_percent: eventSharePercent,
      visitor_share_percent: visitorSharePercent,
      status: summarizeChannelStatus({ eventCount, uniqueVisitors, eventSharePercent, duplicateCount })
    };
  });
}

function summarizeGrowthProxy(
  events: ChannelGrowthEvent[],
  launchGrowth: GrowthDashboardSummary,
  dashboard: ChannelDashboardSummary
): InternalGrowthProxySummary {
  const launchEvents = Object.values(launchGrowth).reduce((sum, count) => sum + count, 0);
  const launchMembers = new Set<string>();
  const channelMembers = new Set<string>();
  const overlappingMembers = new Set<string>();
  let launchValueCents = 0;
  let sharedLaunchEvents = 0;
  for (const event of listLaunchGrowthEvents()) {
    if (event.member_id) launchMembers.add(event.member_id);
    if (event.value_cents) launchValueCents += event.value_cents;
  }
  for (const event of events) {
    if (event.member_id) {
      channelMembers.add(event.member_id);
      if (launchMembers.has(event.member_id)) {
        overlappingMembers.add(event.member_id);
      }
    }
  }
  for (const event of listLaunchGrowthEvents()) {
    if (event.member_id && channelMembers.has(event.member_id)) {
      sharedLaunchEvents += 1;
    }
  }
  const channelEvents = Math.max(dashboard.total_channel_events, 0);
  return {
    mode: "proxy_only",
    exact_roi_available: false,
    channel_events: channelEvents,
    unique_visitors: dashboard.unique_visitors,
    launch_events: launchEvents,
    launch_members: launchMembers.size,
    shared_members: overlappingMembers.size,
    shared_launch_events: sharedLaunchEvents,
    launch_value_cents: launchValueCents,
    proxy_conversion_rate: channelEvents > 0 ? sharedLaunchEvents / channelEvents : 0,
    proxy_value_per_shared_member_cents: overlappingMembers.size > 0 ? Math.round(launchValueCents / overlappingMembers.size) : 0,
    proxy_value_per_channel_event_cents: channelEvents > 0 ? Math.round(launchValueCents / channelEvents) : 0
  };
}

function summarizeGrowthAnomalies(
  events: ChannelGrowthEvent[],
  channelMix: InternalGrowthChannelMixItem[],
  proxy: InternalGrowthProxySummary
): InternalGrowthAnomaly[] {
  const anomalies: InternalGrowthAnomaly[] = [];
  const duplicateCount = events.filter((event) => event.is_duplicate).length;
  const duplicateRate = events.length > 0 ? duplicateCount / events.length : 0;
  const dominant = [...channelMix].sort((left, right) => right.event_count - left.event_count)[0];

  if (events.length === 0) {
    anomalies.push({
      code: "NO_CHANNEL_EVENTS",
      severity: "info",
      title: "No channel events captured yet",
      detail: "The channel dashboard has not received any events, so proxy ROI cannot be estimated.",
      recommendation: "Add at least one tracked channel entry and one share-open or report-intent event before judging channel quality.",
      affected_channels: []
    });
    return anomalies;
  }

  if (duplicateRate >= 0.2) {
    anomalies.push({
      code: "DUPLICATE_CHANNEL_EVENTS",
      severity: duplicateRate >= 0.4 ? "critical" : "warn",
      title: "Duplicate channel events are elevated",
      detail: `${duplicateCount} of ${events.length} channel events are marked duplicate.`,
      recommendation: "Audit the corresponding landing pages, share payloads, and replay protection before spending more traffic.",
      affected_channels: channelMix.filter((item) => item.status !== "healthy").map((item) => item.channel)
    });
  }

  if (dominant && dominant.event_share_percent >= 70) {
    anomalies.push({
      code: "CHANNEL_DOMINANCE",
      severity: dominant.event_share_percent >= 85 ? "critical" : "warn",
      title: "One channel is dominating traffic",
      detail: `${dominant.channel} accounts for ${dominant.event_share_percent}% of tracked channel events.`,
      recommendation: "Reduce channel concentration risk by validating at least one alternate source before scaling spend.",
      affected_channels: [dominant.channel]
    });
  }

  if (proxy.channel_events > 0 && proxy.launch_events > 0 && proxy.shared_launch_events === 0) {
    anomalies.push({
      code: "NO_MEMBER_OVERLAP",
      severity: "warn",
      title: "No shared member overlap between channel and launch events",
      detail: "Tracked channel events and launch activity have not met on the same member_id yet.",
      recommendation: "Verify the landing flow, identity binding, and event emission before using the proxy conversion rate for decisions.",
      affected_channels: channelMix.filter((item) => item.event_count > 0).map((item) => item.channel)
    });
  }

  if (proxy.proxy_conversion_rate > 0 && proxy.proxy_conversion_rate < 0.05 && proxy.channel_events >= 10) {
    anomalies.push({
      code: "LOW_PROXY_CONVERSION",
      severity: "warn",
      title: "Proxy conversion is low",
      detail: `Proxy conversion sits at ${Math.round(proxy.proxy_conversion_rate * 100)}% across ${proxy.channel_events} channel events.`,
      recommendation: "Keep the same measurement window, then compare copy, route, and channel mix before changing the offer.",
      affected_channels: channelMix.filter((item) => item.event_count > 0).map((item) => item.channel)
    });
  }

  return anomalies;
}

function summarizeChannelStatus(input: {
  eventCount: number;
  uniqueVisitors: number;
  eventSharePercent: number;
  duplicateCount: number;
}): InternalGrowthChannelMixItem["status"] {
  if (input.eventCount === 0) return "healthy";
  if (input.duplicateCount >= Math.max(2, Math.ceil(input.eventCount * 0.3))) return "pause_candidate";
  if (input.eventSharePercent >= 70) return "pause_candidate";
  if (input.eventSharePercent >= 35 || input.uniqueVisitors < input.eventCount) return "watch";
  return "healthy";
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
