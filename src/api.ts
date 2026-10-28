import { createChart } from "./chartEngine.js";
import { persistAnonymousMemberLinkSync } from "./accountLinking.js";
import { recordProductEvent } from "./analytics.js";
import { ApiError, toErrorEnvelope } from "./errors.js";
import type { RequestIdentity } from "./auth.js";
import { interpret } from "./interpret.js";
import { submitClosedTestFeedback, summarizeClosedTestFeedback } from "./phase4/feedback.js";
import { createShareCard, saveFavoriteSnapshot, submitReportIntent, summarizeBetaDashboard } from "./phase5/beta.js";
import { createImmersiveSession, getImmersiveSession, getImmersiveStream, recordStageEvent } from "./phase6/immersive.js";
import { createSynastry, interpretTimeline } from "./phase7/synastryTimeline.js";
import { createExportPreview, createReportDraft, getReportDraft } from "./phase8/reporting.js";
import {
  createCheckoutSession,
  createOrder,
  getCommercialDashboard,
  getMemberEntitlements,
  getOrder,
  getReportEntitlement,
  listOrders,
  processPaymentWebhook
} from "./phase9/commerce.js";
import {
  addOpsOrderNote,
  createPrivacyDeletionRequest,
  createOpsSupportTicket,
  createSupportTicket,
  getOpsPaymentReconciliation,
  getLaunchOperationsDashboard,
  getOpsOverview,
  getSupportTicket,
  importOpsProviderStatement,
  listOpsAdminAuditLogs,
  listOpsContentReviews,
  listOpsDataDeletionRequests,
  listOpsEntitlements,
  listOpsAiGenerations,
  listOpsOrders,
  listOpsPaymentEvents,
  listOpsReports,
  listOpsRuleProfiles,
  listOpsShares,
  listOpsUsers,
  markOpsManualRefund,
  previewOpsProviderStatement,
  promoteOpsRuleProfile,
  recordGrowthEvent,
  revealOpsSensitiveRecord,
  reissueOpsEntitlement,
  resolveLaunchPaymentConfig,
  updateOpsDataDeletionRequest,
  updateSupportTicket
} from "./phase10/launchOps.js";
import { getConfiguredOpsToken } from "./phase10/launchOps.js";
import { compareRuleProfiles, getKnowledgeNode, getRuleProfile, listRuleProfiles, searchKnowledge } from "./phase11/ruleKnowledge.js";
import { createDailyTheme, getMemberAchievements, getStarAtlasCard, listStarAtlas, recordDailyCheckIn } from "./phase12/daily.js";
import {
  checkInChallenge,
  createShareLandingSnapshot,
  getDailyStreak,
  getShareLandingSnapshot,
  joinChallenge,
  listCommunityChallenges,
  recordReferralEvent
} from "./phase13/growth.js";
import {
  createChannelEntry,
  createChannelShare,
  getChannelDashboard,
  linkAnonymousMember,
  recordChannelGrowthEvent
} from "./phase14/channels.js";
import {
  createMiniProgramShare,
  getMiniProgramReleaseGate,
  linkMiniProgramMember,
  loginMiniProgram,
  recordMiniProgramReminderEvent,
  subscribeMiniProgramTemplate
} from "./phase15/miniProgram.js";
import { getChart } from "./store.js";
import type {
  ChallengeCheckInRequest,
  ChallengeJoinRequest,
  DailyCheckInRequest,
  DailyThemeRequest,
  BetaFavoriteRequest,
  BetaReportIntentRequest,
  BetaShareCardRequest,
  ChartCreateRequest,
  CheckoutSessionRequest,
  AnonymousLinkRequest,
  ChannelEntryRequest,
  ChannelGrowthEventRequest,
  ChannelShareCreateRequest,
  ClosedTestFeedbackRequest,
  CreateImmersiveSessionRequest,
  ExportPreviewRequest,
  InterpretRequest,
  KnowledgeNodeType,
  LaunchGrowthEventRequest,
  MiniProgramLinkMemberRequest,
  MiniProgramLoginRequest,
  MiniProgramReminderEventRequest,
  MiniProgramShareCreateRequest,
  MiniProgramSubscribeRequest,
  OpsAuth,
  OpsDataDeletionUpdateRequest,
  OpsRuleProfilePromotionRequest,
  ProviderStatementImportRequest,
  OpsSensitiveRecordRevealRequest,
  OrderCreateRequest,
  PaymentWebhookRequest,
  PrivacyDeletionRequestInput,
  ReferralEventRequest,
  ReportDraftRequest,
  PaymentEvent,
  ContentReviewSourceType,
  ContentReviewStatus,
  DataDeletionStatus,
  ShareLandingSourceType,
  RuleCompareRequest,
  ShareCreateRequest,
  StageEventRequest,
  SupportTicketRequest,
  SupportTicketUpdateRequest,
  SynastryCreateRequest,
  TimelineInterpretRequest
} from "./types.js";

export type ApiResponse = {
  status: number;
  body: Record<string, unknown>;
};

export type ApiRequestContext = {
  identity?: RequestIdentity;
};

export function handleApiRequest(method: string, path: string, body?: unknown, context: ApiRequestContext = {}): ApiResponse {
  try {
    if (method === "POST" && path === "/api/chart/create") {
      const response = createChart(body as ChartCreateRequest);
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    const chartMatch = /^\/api\/chart\/([^/]+)$/.exec(path);
    if (method === "GET" && chartMatch) {
      const chart = getChart(chartMatch[1]);
      if (!chart) {
        throw new ApiError("CHART_NOT_FOUND", "未找到指定命盘。", { field: "chart_id", status: 404 });
      }
      return { status: 200, body: chart as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/interpret") {
      const response = interpret(body as InterpretRequest);
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    const ruleProfileMatch = /^\/api\/ops\/rule-profiles\/([^/?]+)(?:\?(.*))?$/.exec(path);
    if (method === "GET" && ruleProfileMatch) {
      assertInternalOpsAuth(readOpsAuth(ruleProfileMatch[2], body));
      const response = getRuleProfile(ruleProfileMatch[1]);
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/ops/chart/compare-rules") {
      const payload = body as RuleCompareRequest & { auth?: OpsAuth };
      assertInternalOpsAuth(payload.auth);
      const response = compareRuleProfiles(payload);
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    const knowledgeSearchMatch = /^\/api\/ops\/knowledge\/search(?:\?(.*))?$/.exec(path);
    if (method === "GET" && knowledgeSearchMatch) {
      const query = knowledgeSearchMatch[1];
      assertInternalOpsAuth(readOpsAuth(query, body));
      const response = searchKnowledge({
        query: readQueryValue(query, "q"),
        node_type: readQueryValue(query, "type") as KnowledgeNodeType | undefined,
        source_title: readQueryValue(query, "source_title"),
        rule_usage: readQueryValue(query, "rule_usage"),
        limit: readOptionalNumber(query, "limit")
      });
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    const knowledgeNodeMatch = /^\/api\/ops\/knowledge\/node\/([^/?]+)(?:\?(.*))?$/.exec(path);
    if (method === "GET" && knowledgeNodeMatch) {
      assertInternalOpsAuth(readOpsAuth(knowledgeNodeMatch[2], body));
      const response = getKnowledgeNode(knowledgeNodeMatch[1]);
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/ops/internal-feedback") {
      const payload = body as ClosedTestFeedbackRequest & { auth?: OpsAuth };
      assertInternalOpsAuth(payload.auth);
      const response = submitClosedTestFeedback(payload);
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    const internalFeedbackMatch = /^\/api\/ops\/internal-feedback(?:\?(.*))?$/.exec(path);
    if (method === "GET" && internalFeedbackMatch) {
      assertInternalOpsAuth(readOpsAuth(internalFeedbackMatch[1], body));
      const response = summarizeClosedTestFeedback();
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/ops/product-signals/share-card") {
      const payload = body as BetaShareCardRequest & { auth?: OpsAuth };
      assertInternalOpsAuth(payload.auth);
      const response = createShareCard(payload);
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/ops/product-signals/favorite") {
      const payload = body as BetaFavoriteRequest & { auth?: OpsAuth };
      assertInternalOpsAuth(payload.auth);
      const response = saveFavoriteSnapshot(payload);
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/ops/product-signals/report-intent") {
      const payload = body as BetaReportIntentRequest & { auth?: OpsAuth };
      assertInternalOpsAuth(payload.auth);
      const response = submitReportIntent(payload);
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    const productSignalsDashboardMatch = /^\/api\/ops\/product-signals\/dashboard(?:\?(.*))?$/.exec(path);
    if (method === "GET" && productSignalsDashboardMatch) {
      assertInternalOpsAuth(readOpsAuth(productSignalsDashboardMatch[1], body));
      const response = summarizeBetaDashboard();
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/ops/synastry/create") {
      const payload = body as SynastryCreateRequest & { auth?: OpsAuth };
      assertInternalOpsAuth(payload.auth);
      const response = createSynastry(payload);
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/ops/timeline/interpret") {
      const payload = body as TimelineInterpretRequest & { auth?: OpsAuth };
      assertInternalOpsAuth(payload.auth);
      const response = interpretTimeline(payload);
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/report/draft") {
      const response = createReportDraft(body as ReportDraftRequest);
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    const reportMatch = /^\/api\/report\/([^/]+)$/.exec(path);
    if (method === "GET" && reportMatch) {
      const report = getReportDraft(reportMatch[1]);
      if (!report) {
        throw new ApiError("REPORT_NOT_FOUND", "report draft not found.", { field: "report_id", status: 404 });
      }
      return { status: 200, body: report as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/report/export-preview") {
      const response = createExportPreview(body as ExportPreviewRequest);
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/order/create") {
      const response = createOrder(body as OrderCreateRequest);
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    const orderListMatch = /^\/api\/order\/list(?:\?(.*))?$/.exec(path);
    if (method === "GET" && orderListMatch) {
      const response = listOrders(readQueryValue(orderListMatch[1], "member_id"));
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    const orderMatch = /^\/api\/order\/([^/?]+)$/.exec(path);
    if (method === "GET" && orderMatch) {
      const order = getOrder(orderMatch[1]);
      if (!order) {
        throw new ApiError("ORDER_NOT_FOUND", "order not found.", { field: "order_id", status: 404 });
      }
      return { status: 200, body: order as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/checkout/session") {
      const response = createCheckoutSession(body as CheckoutSessionRequest);
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/payment/webhook") {
      const event = processPaymentWebhook(body as PaymentWebhookRequest);
      if (event.payment_event_id && !event.is_duplicate) {
        recordProductEvent("payment_result", {
          order_id: event.order_id,
          result: event.order.status,
          metadata: { event_type: event.event_type, duplicate: event.is_duplicate, provider: event.provider }
        });
      }
      return { status: 200, body: event as unknown as Record<string, unknown> };
    }

    const entitlementMatch = /^\/api\/entitlement\/report\/([^/?]+)(?:\?(.*))?$/.exec(path);
    if (method === "GET" && entitlementMatch) {
      const response = getReportEntitlement(entitlementMatch[1], readQueryValue(entitlementMatch[2], "member_id"));
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    const memberMatch = /^\/api\/member\/me(?:\?(.*))?$/.exec(path);
    if (method === "GET" && memberMatch) {
      const response = getMemberEntitlements(readQueryValue(memberMatch[1], "member_id"));
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    const opsCommercialDashboardMatch = /^\/api\/ops\/commercial\/dashboard(?:\?(.*))?$/.exec(path);
    if (method === "GET" && opsCommercialDashboardMatch) {
      assertInternalOpsAuth(readOpsAuth(opsCommercialDashboardMatch[1], body));
      const response = getCommercialDashboard();
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/daily/theme") {
      const response = createDailyTheme(body as DailyThemeRequest);
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/daily/check-in") {
      const response = recordDailyCheckIn(body as DailyCheckInRequest);
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    const starAtlasMatch = /^\/api\/star-atlas(?:\?(.*))?$/.exec(path);
    if (method === "GET" && starAtlasMatch) {
      const response = listStarAtlas({
        member_id: readQueryValue(starAtlasMatch[1], "member_id")
      });
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    const starAtlasCardMatch = /^\/api\/star-atlas\/([^/?]+)(?:\?(.*))?$/.exec(path);
    if (method === "GET" && starAtlasCardMatch) {
      const response = getStarAtlasCard(starAtlasCardMatch[1], readQueryValue(starAtlasCardMatch[2], "member_id"));
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    const achievementMatch = /^\/api\/member\/achievements(?:\?(.*))?$/.exec(path);
    if (method === "GET" && achievementMatch) {
      const response = getMemberAchievements(readQueryValue(achievementMatch[1], "member_id"));
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    const dailyStreakMatch = /^\/api\/daily\/streak(?:\?(.*))?$/.exec(path);
    if (method === "GET" && dailyStreakMatch) {
      const response = getDailyStreak({
        member_id: readQueryValue(dailyStreakMatch[1], "member_id"),
        as_of_date: readQueryValue(dailyStreakMatch[1], "as_of_date")
      });
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/channel/entry") {
      const response = createChannelEntry(body as ChannelEntryRequest);
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/member/link-anonymous") {
      const response = linkAnonymousMember(body as AnonymousLinkRequest);
      persistAnonymousMemberLinkSync(response);
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/mini-program/login") {
      const response = loginMiniProgram(body as MiniProgramLoginRequest);
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/mini-program/link-member") {
      const response = linkMiniProgramMember(body as MiniProgramLinkMemberRequest);
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/share/create") {
      const payload = body as Partial<ChannelShareCreateRequest & MiniProgramShareCreateRequest>;
      const response =
        payload.mini_program_share_format
          ? createMiniProgramShare(body as MiniProgramShareCreateRequest)
          : payload.share_format || payload.channel
          ? createChannelShare(body as ChannelShareCreateRequest)
          : createShareLandingSnapshot(body as ShareCreateRequest);
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    const shareLandingMatch = /^\/api\/share\/([^/?]+)$/.exec(path);
    if (method === "GET" && shareLandingMatch) {
      const response = getShareLandingSnapshot(shareLandingMatch[1]);
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/growth/referral-event") {
      const response = recordReferralEvent(body as ReferralEventRequest);
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/growth/channel-event") {
      const response = recordChannelGrowthEvent(body as ChannelGrowthEventRequest);
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    const opsChannelDashboardMatch = /^\/api\/ops\/growth\/channel-dashboard(?:\?(.*))?$/.exec(path);
    if (method === "GET" && opsChannelDashboardMatch) {
      assertInternalOpsAuth(readOpsAuth(opsChannelDashboardMatch[1], body));
      const response = getChannelDashboard();
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/mini-program/subscribe") {
      const response = subscribeMiniProgramTemplate(body as MiniProgramSubscribeRequest);
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/mini-program/reminder-event") {
      const response = recordMiniProgramReminderEvent(body as MiniProgramReminderEventRequest);
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    if (method === "GET" && path === "/api/mini-program/release-gate") {
      const response = getMiniProgramReleaseGate();
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    const challengeListMatch = /^\/api\/challenge\/list(?:\?(.*))?$/.exec(path);
    if (method === "GET" && challengeListMatch) {
      const response = listCommunityChallenges({
        member_id: readQueryValue(challengeListMatch[1], "member_id")
      });
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/challenge/join") {
      const response = joinChallenge(body as ChallengeJoinRequest);
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/challenge/check-in") {
      const response = checkInChallenge(body as ChallengeCheckInRequest);
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    if (method === "GET" && path === "/api/launch/config") {
      const response = resolveLaunchPaymentConfig();
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    const launchDashboardMatch = /^\/api\/ops\/launch\/dashboard(?:\?(.*))?$/.exec(path);
    if (method === "GET" && launchDashboardMatch) {
      const response = getLaunchOperationsDashboard({ auth: readOpsAuth(launchDashboardMatch[1], body) });
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    const opsOrdersMatch = /^\/api\/ops\/orders(?:\?(.*))?$/.exec(path);
    if (method === "GET" && opsOrdersMatch) {
      const query = opsOrdersMatch[1];
      const response = listOpsOrders({
        auth: readOpsAuth(query, body),
        status: readQueryValue(query, "status") as never,
        member_id: readQueryValue(query, "member_id")
      });
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    const opsPaymentEventsMatch = /^\/api\/ops\/payment-events(?:\?(.*))?$/.exec(path);
    if (method === "GET" && opsPaymentEventsMatch) {
      const response = listOpsPaymentEvents({ auth: readOpsAuth(opsPaymentEventsMatch[1], body) });
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    const opsReconciliationMatch = /^\/api\/ops\/reconciliation(?:\?(.*))?$/.exec(path);
    if (method === "GET" && opsReconciliationMatch) {
      const response = getOpsPaymentReconciliation({ auth: readOpsAuth(opsReconciliationMatch[1], body) });
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/ops/reconciliation/import") {
      const response = importOpsProviderStatement(body as ProviderStatementImportRequest);
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/ops/reconciliation/preview") {
      const response = previewOpsProviderStatement(body as ProviderStatementImportRequest);
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    const opsEntitlementsMatch = /^\/api\/ops\/entitlements(?:\?(.*))?$/.exec(path);
    if (method === "GET" && opsEntitlementsMatch) {
      const response = listOpsEntitlements({
        auth: readOpsAuth(opsEntitlementsMatch[1], body),
        member_id: readQueryValue(opsEntitlementsMatch[1], "member_id")
      });
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    const opsOverviewMatch = /^\/api\/ops\/overview(?:\?(.*))?$/.exec(path);
    if (method === "GET" && opsOverviewMatch) {
      const response = getOpsOverview({ auth: readOpsAuth(opsOverviewMatch[1], body) });
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    const opsAiGenerationsMatch = /^\/api\/ops\/ai-generations(?:\?(.*))?$/.exec(path);
    if (method === "GET" && opsAiGenerationsMatch) {
      const response = listOpsAiGenerations({ auth: readOpsAuth(opsAiGenerationsMatch[1], body) });
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    const opsContentReviewsMatch = /^\/api\/ops\/content-reviews(?:\?(.*))?$/.exec(path);
    if (method === "GET" && opsContentReviewsMatch) {
      const query = opsContentReviewsMatch[1];
      const response = listOpsContentReviews({
        auth: readOpsAuth(query, body),
        status: readQueryValue(query, "status") as ContentReviewStatus | undefined,
        report_id: readQueryValue(query, "report_id"),
        source_type: readQueryValue(query, "source_type") as ContentReviewSourceType | undefined
      });
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    const opsRuleProfilesMatch = /^\/api\/ops\/rule-profiles(?:\?(.*))?$/.exec(path);
    if (method === "GET" && opsRuleProfilesMatch) {
      const response = listOpsRuleProfiles({ auth: readOpsAuth(opsRuleProfilesMatch[1], body) });
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/ops/rule-profiles/default") {
      const payload = body as Partial<OpsRuleProfilePromotionRequest>;
      const response = promoteOpsRuleProfile({
        auth: payload.auth ?? {},
        profile_id: payload.profile_id ?? "",
        reason: payload.reason ?? "",
        second_confirmed: payload.second_confirmed,
        ticket_id: payload.ticket_id
      });
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    const opsUsersMatch = /^\/api\/ops\/users(?:\?(.*))?$/.exec(path);
    if (method === "GET" && opsUsersMatch) {
      const query = opsUsersMatch[1];
      const response = listOpsUsers({
        auth: readOpsAuth(query, body),
        member_id: readQueryValue(query, "member_id"),
        visitor_id: readQueryValue(query, "visitor_id")
      });
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    const opsReportsMatch = /^\/api\/ops\/reports(?:\?(.*))?$/.exec(path);
    if (method === "GET" && opsReportsMatch) {
      const query = opsReportsMatch[1];
      const response = listOpsReports({
        auth: readOpsAuth(query, body),
        report_id: readQueryValue(query, "report_id"),
        chart_id: readQueryValue(query, "chart_id"),
        review_status: readQueryValue(query, "review_status") as ContentReviewStatus | undefined
      });
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    const opsSharesMatch = /^\/api\/ops\/shares(?:\?(.*))?$/.exec(path);
    if (method === "GET" && opsSharesMatch) {
      const query = opsSharesMatch[1];
      const response = listOpsShares({
        auth: readOpsAuth(query, body),
        share_id: readQueryValue(query, "share_id"),
        source_id: readQueryValue(query, "source_id"),
        source_type: readQueryValue(query, "source_type") as ShareLandingSourceType | undefined
      });
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    const opsAuditLogsMatch = /^\/api\/ops\/audit-logs(?:\?(.*))?$/.exec(path);
    if (method === "GET" && opsAuditLogsMatch) {
      const response = listOpsAdminAuditLogs({ auth: readOpsAuth(opsAuditLogsMatch[1], body) });
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/ops/sensitive-record") {
      const payload = body as Partial<OpsSensitiveRecordRevealRequest>;
      const response = revealOpsSensitiveRecord({
        auth: payload.auth ?? {},
        record_type: payload.record_type ?? "chart",
        record_id: payload.record_id ?? "",
        reason: payload.reason ?? "",
        second_confirmed: payload.second_confirmed,
        ticket_id: payload.ticket_id
      });
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    const opsDeletionRequestsMatch = /^\/api\/ops\/deletion-requests(?:\?(.*))?$/.exec(path);
    if (method === "GET" && opsDeletionRequestsMatch) {
      const query = opsDeletionRequestsMatch[1];
      const response = listOpsDataDeletionRequests({
        auth: readOpsAuth(query, body),
        status: readQueryValue(query, "status") as DataDeletionStatus | undefined,
        member_id: readQueryValue(query, "member_id"),
        visitor_id: readQueryValue(query, "visitor_id")
      });
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    const opsDeletionRequestMatch = /^\/api\/ops\/deletion-request\/([^/]+)$/.exec(path);
    if (method === "PATCH" && opsDeletionRequestMatch) {
      const payload = body as Partial<OpsDataDeletionUpdateRequest>;
      const response = updateOpsDataDeletionRequest({
        auth: payload.auth ?? {},
        deletion_request_id: opsDeletionRequestMatch[1],
        status: payload.status ?? "verifying",
        note: payload.note ?? "",
        second_confirmed: payload.second_confirmed
      });
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    const opsRefundMatch = /^\/api\/ops\/order\/([^/]+)\/refund$/.exec(path);
    if (method === "POST" && opsRefundMatch) {
      const payload = body as Partial<{ auth: OpsAuth; reason: string; ticket_id: string; amount_cents: number }>;
      const response = markOpsManualRefund({
        auth: payload.auth ?? {},
        order_id: opsRefundMatch[1],
        reason: payload.reason ?? "",
        ticket_id: payload.ticket_id,
        amount_cents: payload.amount_cents
      });
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    const opsReissueEntitlementMatch = /^\/api\/ops\/order\/([^/]+)\/entitlement\/reissue$/.exec(path);
    if (method === "POST" && opsReissueEntitlementMatch) {
      const payload = body as Partial<{ auth: OpsAuth; reason: string; ticket_id: string; export_preview_credits: number }>;
      const response = reissueOpsEntitlement({
        auth: payload.auth ?? {},
        order_id: opsReissueEntitlementMatch[1],
        reason: payload.reason ?? "",
        ticket_id: payload.ticket_id,
        export_preview_credits: payload.export_preview_credits
      });
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    const opsNoteMatch = /^\/api\/ops\/order\/([^/]+)\/note$/.exec(path);
    if (method === "POST" && opsNoteMatch) {
      const payload = body as Partial<{ auth: OpsAuth; note: string; ticket_id: string }>;
      const response = addOpsOrderNote({
        auth: payload.auth ?? {},
        order_id: opsNoteMatch[1],
        note: payload.note ?? "",
        ticket_id: payload.ticket_id
      });
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    const opsSupportTicketMatch = /^\/api\/ops\/order\/([^/]+)\/support-ticket$/.exec(path);
    if (method === "POST" && opsSupportTicketMatch) {
      const payload = body as Partial<SupportTicketRequest & { auth: OpsAuth }>;
      const response = createOpsSupportTicket({
        auth: payload.auth ?? {},
        order_id: opsSupportTicketMatch[1],
        category: payload.category ?? "general",
        priority: payload.priority ?? "normal",
        subject: payload.subject ?? "",
        message: payload.message ?? "",
        consent: payload.consent ?? { agreed: false, no_sensitive_birth_data: true }
      });
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/support/ticket") {
      const response = createSupportTicket(bindSupportTicketSubject(body as SupportTicketRequest, context.identity));
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/privacy/delete-request") {
      const response = createPrivacyDeletionRequest(bindPrivacyDeletionSubject(body as PrivacyDeletionRequestInput, context.identity));
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    const supportTicketMatch = /^\/api\/ops\/support\/ticket\/([^/?]+)(?:\?(.*))?$/.exec(path);
    if (method === "GET" && supportTicketMatch) {
      const response = getSupportTicket({
        auth: readOpsAuth(supportTicketMatch[2], body),
        ticket_id: supportTicketMatch[1]
      });
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    if (method === "PATCH" && supportTicketMatch) {
      const payload = body as Partial<SupportTicketUpdateRequest>;
      const response = updateSupportTicket({
        auth: payload.auth ?? {},
        ticket_id: supportTicketMatch[1],
        status: payload.status ?? "open",
        assignee: payload.assignee,
        note: payload.note
      });
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/ops/launch/growth-event") {
      const payload = body as LaunchGrowthEventRequest & { auth?: OpsAuth };
      assertInternalOpsAuth(payload.auth);
      const response = recordGrowthEvent(payload);
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/ops/immersive/session") {
      const payload = body as CreateImmersiveSessionRequest & { auth?: OpsAuth };
      assertInternalOpsAuth(payload.auth);
      const response = createImmersiveSession(payload);
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    const immersiveSessionMatch = /^\/api\/ops\/immersive\/session\/([^/?]+)(?:\?(.*))?$/.exec(path);
    if (method === "GET" && immersiveSessionMatch) {
      assertInternalOpsAuth(readOpsAuth(immersiveSessionMatch[2], body));
      const session = getImmersiveSession(immersiveSessionMatch[1]);
      if (!session) {
        throw new ApiError("IMMERSIVE_SESSION_NOT_FOUND", "immersive session not found or expired.", { field: "session_id", status: 404 });
      }
      return { status: 200, body: { session, privacy: session.privacy } as unknown as Record<string, unknown> };
    }

    const immersiveEventMatch = /^\/api\/ops\/immersive\/session\/([^/]+)\/event$/.exec(path);
    if (method === "POST" && immersiveEventMatch) {
      const payload = body as StageEventRequest & { auth?: OpsAuth };
      assertInternalOpsAuth(payload.auth);
      const response = recordStageEvent(immersiveEventMatch[1], payload);
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    const immersiveStreamMatch = /^\/api\/ops\/immersive\/session\/([^/?]+)\/stream(?:\?(.*))?$/.exec(path);
    if (method === "GET" && immersiveStreamMatch) {
      assertInternalOpsAuth(readOpsAuth(immersiveStreamMatch[2], body));
      const response = getImmersiveStream(immersiveStreamMatch[1]);
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    throw new ApiError("ROUTE_NOT_FOUND", "接口不存在。", { status: 404 });
  } catch (error) {
    return toErrorEnvelope(error);
  }
}

function bindPrivacyDeletionSubject(payload: PrivacyDeletionRequestInput, identity?: RequestIdentity): PrivacyDeletionRequestInput {
  const resolvedIdentity = identity;
  if (!resolvedIdentity || (!resolvedIdentity.memberId && resolvedIdentity.visitorId === "visitor_guest")) {
    throw new ApiError("DELETION_IDENTITY_REQUIRED", "data deletion requests require an existing visitor or member session.", {
      field: "session",
      status: 401
    });
  }
  if (payload.member_id && payload.member_id !== resolvedIdentity.memberId) {
    throw new ApiError("DELETION_SUBJECT_FORBIDDEN", "deletion request subject must match the current signed-in member.", {
      field: "member_id",
      status: 403
    });
  }
  if (payload.visitor_id && payload.visitor_id !== resolvedIdentity.visitorId) {
    throw new ApiError("DELETION_SUBJECT_FORBIDDEN", "deletion request visitor subject must match the current anonymous visitor.", {
      field: "visitor_id",
      status: 403
    });
  }
  return {
    member_id: resolvedIdentity.memberId,
    visitor_id: resolvedIdentity.visitorId,
    scope: payload.scope,
    message: payload.message
  };
}

function bindSupportTicketSubject(payload: SupportTicketRequest, identity?: RequestIdentity): SupportTicketRequest {
  const resolvedIdentity = identity;
  if (!resolvedIdentity || (!resolvedIdentity.memberId && resolvedIdentity.visitorId === "visitor_guest")) {
    throw new ApiError("SUPPORT_IDENTITY_REQUIRED", "support tickets require an existing visitor or member session.", {
      field: "session",
      status: 401
    });
  }
  const subjectId = resolvedIdentity.memberId ?? resolvedIdentity.visitorId;
  if (payload.member_id && payload.member_id !== subjectId) {
    throw new ApiError("SUPPORT_SUBJECT_FORBIDDEN", "support ticket subject must match the current visitor or member session.", {
      field: "member_id",
      status: 403
    });
  }
  return {
    ...payload,
    member_id: subjectId
  };
}

function readQueryValue(query: string | undefined, key: string): string | undefined {
  if (!query) return undefined;
  return new URLSearchParams(query).get(key) ?? undefined;
}

function readOptionalNumber(query: string | undefined, key: string): number | undefined {
  const value = readQueryValue(query, key);
  if (!value) return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function readOpsAuth(query: string | undefined, body: unknown): OpsAuth {
  const payload = body as Partial<{ auth: OpsAuth }> | undefined;
  return {
    token: payload?.auth?.token ?? readQueryValue(query, "admin_token"),
    role: process.env.NODE_ENV === "test" ? payload?.auth?.role ?? (readQueryValue(query, "admin_role") as OpsAuth["role"]) : undefined,
    actor_id: undefined,
    mfa_code: payload?.auth?.mfa_code ?? readQueryValue(query, "admin_mfa_code")
  };
}

function assertInternalOpsAuth(auth: OpsAuth | undefined): void {
  const configuredRole = process.env.PHASE10_ADMIN_ROLE?.trim();
  const role = process.env.NODE_ENV === "test"
    ? auth?.role || "support_agent"
    : configuredRole && ["ops_admin", "support_agent", "content_reviewer"].includes(configuredRole)
      ? configuredRole as NonNullable<OpsAuth["role"]>
      : "support_agent";
  const token = auth?.token || "";
  const allowedRoles: Array<NonNullable<OpsAuth["role"]>> = ["ops_admin", "support_agent", "content_reviewer"];
  if (!getConfiguredOpsToken() || token !== getConfiguredOpsToken() || !allowedRoles.includes(role)) {
    throw new ApiError("OPS_AUTH_REQUIRED", "ops access is not authorized.", { field: "x-admin-token", status: 401 });
  }
  if (process.env.PHASE10_OPS_MFA_ENABLED === "true") {
    const configuredMfaCode = process.env.PHASE10_OPS_MFA_CODE?.trim();
    if (!configuredMfaCode) {
      throw new ApiError("OPS_MFA_NOT_CONFIGURED", "ops second factor is not configured.", { field: "PHASE10_OPS_MFA_CODE", status: 503 });
    }
    if ((auth?.mfa_code || "").trim() !== configuredMfaCode) {
      throw new ApiError("OPS_MFA_REQUIRED", "ops second factor is required.", { field: "x-admin-mfa-code", status: 403 });
    }
  }
}
