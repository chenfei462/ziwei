import { createChart } from "./chartEngine.js";
import { ApiError, toErrorEnvelope } from "./errors.js";
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
  createSupportTicket,
  getLaunchOperationsDashboard,
  getSupportTicket,
  listOpsEntitlements,
  listOpsOrders,
  listOpsPaymentEvents,
  markOpsManualRefund,
  recordGrowthEvent,
  resolveLaunchPaymentConfig,
  updateSupportTicket
} from "./phase10/launchOps.js";
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
  OrderCreateRequest,
  PaymentWebhookRequest,
  ReferralEventRequest,
  ReportDraftRequest,
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

export function handleApiRequest(method: string, path: string, body?: unknown): ApiResponse {
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

    if (method === "GET" && path === "/api/rule-profiles") {
      const response = listRuleProfiles();
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    const ruleProfileMatch = /^\/api\/rule-profiles\/([^/]+)$/.exec(path);
    if (method === "GET" && ruleProfileMatch) {
      const response = getRuleProfile(ruleProfileMatch[1]);
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/chart/compare-rules") {
      const response = compareRuleProfiles(body as RuleCompareRequest);
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    const knowledgeSearchMatch = /^\/api\/knowledge\/search(?:\?(.*))?$/.exec(path);
    if (method === "GET" && knowledgeSearchMatch) {
      const query = knowledgeSearchMatch[1];
      const response = searchKnowledge({
        query: readQueryValue(query, "q"),
        node_type: readQueryValue(query, "type") as KnowledgeNodeType | undefined,
        source_title: readQueryValue(query, "source_title"),
        rule_usage: readQueryValue(query, "rule_usage"),
        limit: readOptionalNumber(query, "limit")
      });
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    const knowledgeNodeMatch = /^\/api\/knowledge\/node\/([^/]+)$/.exec(path);
    if (method === "GET" && knowledgeNodeMatch) {
      const response = getKnowledgeNode(knowledgeNodeMatch[1]);
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/feedback") {
      const response = submitClosedTestFeedback(body as ClosedTestFeedbackRequest);
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    if (method === "GET" && path === "/api/feedback") {
      const response = summarizeClosedTestFeedback();
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/beta/share-card") {
      const response = createShareCard(body as BetaShareCardRequest);
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/beta/favorite") {
      const response = saveFavoriteSnapshot(body as BetaFavoriteRequest);
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/beta/report-intent") {
      const response = submitReportIntent(body as BetaReportIntentRequest);
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    if (method === "GET" && path === "/api/beta/dashboard") {
      const response = summarizeBetaDashboard();
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/synastry/create") {
      const response = createSynastry(body as SynastryCreateRequest);
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/timeline/interpret") {
      const response = interpretTimeline(body as TimelineInterpretRequest);
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
      const response = processPaymentWebhook(body as PaymentWebhookRequest);
      return { status: 200, body: response as unknown as Record<string, unknown> };
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

    if (method === "GET" && path === "/api/commercial/dashboard") {
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

    if (method === "GET" && path === "/api/growth/channel-dashboard") {
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

    const launchDashboardMatch = /^\/api\/launch\/dashboard(?:\?(.*))?$/.exec(path);
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

    const opsEntitlementsMatch = /^\/api\/ops\/entitlements(?:\?(.*))?$/.exec(path);
    if (method === "GET" && opsEntitlementsMatch) {
      const response = listOpsEntitlements({
        auth: readOpsAuth(opsEntitlementsMatch[1], body),
        member_id: readQueryValue(opsEntitlementsMatch[1], "member_id")
      });
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    const opsRefundMatch = /^\/api\/ops\/order\/([^/]+)\/refund$/.exec(path);
    if (method === "POST" && opsRefundMatch) {
      const payload = body as Partial<{ auth: OpsAuth; reason: string; ticket_id: string }>;
      const response = markOpsManualRefund({
        auth: payload.auth ?? {},
        order_id: opsRefundMatch[1],
        reason: payload.reason ?? "",
        ticket_id: payload.ticket_id
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

    if (method === "POST" && path === "/api/support/ticket") {
      const response = createSupportTicket(body as SupportTicketRequest);
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    const supportTicketMatch = /^\/api\/support\/ticket\/([^/?]+)(?:\?(.*))?$/.exec(path);
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

    if (method === "POST" && path === "/api/launch/growth-event") {
      const response = recordGrowthEvent(body as LaunchGrowthEventRequest);
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    if (method === "POST" && path === "/api/immersive/session") {
      const response = createImmersiveSession(body as CreateImmersiveSessionRequest);
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    const immersiveSessionMatch = /^\/api\/immersive\/session\/([^/]+)$/.exec(path);
    if (method === "GET" && immersiveSessionMatch) {
      const session = getImmersiveSession(immersiveSessionMatch[1]);
      if (!session) {
        throw new ApiError("IMMERSIVE_SESSION_NOT_FOUND", "immersive session not found or expired.", { field: "session_id", status: 404 });
      }
      return { status: 200, body: { session, privacy: session.privacy } as unknown as Record<string, unknown> };
    }

    const immersiveEventMatch = /^\/api\/immersive\/session\/([^/]+)\/event$/.exec(path);
    if (method === "POST" && immersiveEventMatch) {
      const response = recordStageEvent(immersiveEventMatch[1], body as StageEventRequest);
      return { status: 201, body: response as unknown as Record<string, unknown> };
    }

    const immersiveStreamMatch = /^\/api\/immersive\/session\/([^/]+)\/stream$/.exec(path);
    if (method === "GET" && immersiveStreamMatch) {
      const response = getImmersiveStream(immersiveStreamMatch[1]);
      return { status: 200, body: response as unknown as Record<string, unknown> };
    }

    throw new ApiError("ROUTE_NOT_FOUND", "接口不存在。", { status: 404 });
  } catch (error) {
    return toErrorEnvelope(error);
  }
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
    role: payload?.auth?.role ?? (readQueryValue(query, "admin_role") as OpsAuth["role"]),
    actor_id: payload?.auth?.actor_id ?? readQueryValue(query, "actor_id")
  };
}
