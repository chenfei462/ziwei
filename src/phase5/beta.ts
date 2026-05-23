import { ApiError } from "../errors.js";
import { interpret } from "../interpret.js";
import {
  getChart,
  listBetaEvents,
  listBetaFavorites,
  listBetaReportIntents,
  listBetaShareCards,
  saveBetaEvent,
  saveBetaFavorite,
  saveBetaReportIntent,
  saveBetaShareCard
} from "../store.js";
import { summarizeClosedTestFeedback } from "../phase4/feedback.js";
import {
  interpretationModes,
  reportTierIds,
  type BetaDashboardSummary,
  type BetaEventRecord,
  type BetaEventType,
  type BetaFavoriteRecord,
  type BetaFavoriteRequest,
  type BetaFavoriteResponse,
  type BetaPrivacy,
  type BetaReportIntentRecord,
  type BetaReportIntentRequest,
  type BetaReportIntentResponse,
  type BetaShareCard,
  type BetaShareCardRequest,
  type BetaShareCardResponse,
  type Chart,
  type Palace,
  type ReportTierId
} from "../types.js";

const privacy: BetaPrivacy = {
  hides_full_birth_date: true,
  hides_birth_time: true,
  hides_location_detail: true,
  stores_video_frame: false,
  real_payment_enabled: false
};

export function createShareCard(request: BetaShareCardRequest): BetaShareCardResponse {
  validateShareCardRequest(request);
  const chart = resolveChart(request.chart_id, request.chart);
  const palace = requirePalace(chart, request.palace_id);
  const sessionId = normalizeSessionId(request.session_id);
  const interpretation = interpret({
    chart_id: request.chart_id,
    palace_id: request.palace_id,
    mode: request.mode,
    include_trace: false,
    chart
  });
  const shareCardId = createId("share");
  const keywords = buildStarKeywords(palace);
  const summary = sanitizeBetaText(interpretation.interpretation.interpretation || interpretation.interpretation.basis).slice(0, 180);
  const createdAt = new Date().toISOString();
  const shareCard: BetaShareCard = {
    share_card_id: shareCardId,
    created_at: createdAt,
    session_id: sessionId,
    chart_id: request.chart_id,
    palace_id: palace.palace_id,
    palace_label: sanitizeBetaText(palace.name),
    mode: request.mode,
    title: `${sanitizeBetaText(palace.name)} Beta share`,
    star_keywords: keywords,
    summary,
    privacy_note: "privacy protected: full birth date, birth time, location detail, and camera frames are hidden by default.",
    share_text: `${sanitizeBetaText(palace.name)} | ${keywords.join(" / ")} | ${summary}`,
    safety_flags: interpretation.interpretation.safety_flags
  };

  saveBetaShareCard(shareCard);
  recordBetaEvent("share_card_created", {
    session_id: sessionId,
    chart_id: request.chart_id,
    target_palace_id: palace.palace_id,
    action: "create_share_card",
    metadata: {
      mode: request.mode,
      safety_flag_count: interpretation.interpretation.safety_flags.length
    }
  });

  return {
    share_card_id: shareCardId,
    share_card: shareCard,
    dashboard_snapshot: summarizeBetaDashboard(),
    privacy
  };
}

export function saveFavoriteSnapshot(request: BetaFavoriteRequest): BetaFavoriteResponse {
  validateFavoriteRequest(request);
  const chart = resolveChart(request.chart_id, request.chart);
  const palace = requirePalace(chart, request.palace_id);
  const sessionId = normalizeSessionId(request.session_id);
  const favoriteId = createId("fav");
  const favorite: BetaFavoriteRecord = {
    favorite_id: favoriteId,
    created_at: new Date().toISOString(),
    session_id: sessionId,
    chart_id: request.chart_id,
    palace_id: palace.palace_id,
    palace_label: sanitizeBetaText(palace.name),
    note: request.note ? sanitizeBetaText(request.note) : undefined
  };

  saveBetaFavorite(favorite);
  recordBetaEvent("favorite_saved", {
    session_id: sessionId,
    chart_id: request.chart_id,
    target_palace_id: palace.palace_id,
    action: "save_favorite"
  });

  return {
    favorite_id: favoriteId,
    favorite,
    dashboard_snapshot: summarizeBetaDashboard(),
    privacy
  };
}

export function submitReportIntent(request: BetaReportIntentRequest): BetaReportIntentResponse {
  validateReportIntentRequest(request);
  const sessionId = normalizeSessionId(request.session_id);
  const reportIntentId = createId("intent");
  const reportIntent: BetaReportIntentRecord = {
    report_intent_id: reportIntentId,
    created_at: new Date().toISOString(),
    session_id: sessionId,
    chart_id: request.chart_id,
    tier_id: request.tier_id,
    intent_level: request.intent_level,
    contact_opt_in: request.contact_opt_in,
    note: request.note ? sanitizeBetaText(request.note) : undefined,
    payment_status: "intent_only"
  };

  saveBetaReportIntent(reportIntent);
  recordBetaEvent("report_intent_submitted", {
    session_id: sessionId,
    chart_id: request.chart_id,
    action: "submit_report_intent",
    metadata: {
      tier_id: request.tier_id,
      intent_level: request.intent_level,
      contact_opt_in: request.contact_opt_in
    }
  });

  return {
    report_intent_id: reportIntentId,
    report_intent: reportIntent,
    dashboard_snapshot: summarizeBetaDashboard(),
    privacy
  };
}

export function summarizeBetaDashboard(): BetaDashboardSummary {
  const events = listBetaEvents();
  const shareCards = listBetaShareCards();
  const favorites = listBetaFavorites();
  const reportIntents = listBetaReportIntents();
  const activeSessions = new Set(events.map((event) => event.session_id)).size;
  const priceInterest = createPriceInterest();

  for (const intent of reportIntents) {
    priceInterest[intent.tier_id] += 1;
  }

  return {
    total_beta_events: events.length,
    active_sessions: activeSessions,
    share_cards_created: shareCards.length,
    favorites_saved: favorites.length,
    report_intents: reportIntents.length,
    share_rate: activeSessions ? round2(shareCards.length / activeSessions) : 0,
    favorite_rate: activeSessions ? round2(favorites.length / activeSessions) : 0,
    report_intent_rate: activeSessions ? round2(reportIntents.length / activeSessions) : 0,
    report_price_interest: priceInterest,
    closed_test: summarizeClosedTestFeedback(),
    content_safety: {
      safety_flag_hits: shareCards.reduce((total, card) => total + card.safety_flags.length, 0),
      hard_prediction_violations: 0
    },
    beta_exit_targets: {
      completion_rate_target: 0.6,
      share_rate_target: 0.2,
      report_intent_rate_target: 0.05
    },
    privacy: {
      event_logs_store_sensitive_birth_data: false,
      share_cards_hide_full_birth_date: true,
      favorites_hide_birth_time: true,
      report_intents_are_payment_free: true,
      stores_video_frame: false
    }
  };
}

function validateShareCardRequest(request: BetaShareCardRequest): void {
  if (!request?.chart_id) {
    throw new ApiError("BETA_CHART_REQUIRED", "chart_id is required for beta share card creation.", { field: "chart_id" });
  }
  if (!request.palace_id) {
    throw new ApiError("BETA_PALACE_REQUIRED", "palace_id is required for beta share card creation.", { field: "palace_id" });
  }
  if (!interpretationModes.includes(request.mode)) {
    throw new ApiError("INVALID_INTERPRETATION_MODE", "mode must be professional or entertainment.", { field: "mode" });
  }
}

function validateFavoriteRequest(request: BetaFavoriteRequest): void {
  if (!request?.chart_id) {
    throw new ApiError("BETA_CHART_REQUIRED", "chart_id is required for beta favorite.", { field: "chart_id" });
  }
  if (!request.palace_id) {
    throw new ApiError("BETA_PALACE_REQUIRED", "palace_id is required for beta favorite.", { field: "palace_id" });
  }
}

function validateReportIntentRequest(request: BetaReportIntentRequest): void {
  if (!request?.chart_id) {
    throw new ApiError("BETA_CHART_REQUIRED", "chart_id is required for report intent.", { field: "chart_id" });
  }
  if (!reportTierIds.includes(request.tier_id)) {
    throw new ApiError("INVALID_REPORT_TIER", "tier_id is not supported in phase 5.", { field: "tier_id" });
  }
  if (!Number.isInteger(request.intent_level) || request.intent_level < 1 || request.intent_level > 5) {
    throw new ApiError("INVALID_REPORT_INTENT_LEVEL", "intent_level must be an integer from 1 to 5.", { field: "intent_level" });
  }
  if (typeof request.contact_opt_in !== "boolean") {
    throw new ApiError("INVALID_REPORT_CONTACT_OPT_IN", "contact_opt_in must be boolean.", { field: "contact_opt_in" });
  }
}

function resolveChart(chartId: string, chartSnapshot?: Chart): Chart {
  const storedChart = getChart(chartId);
  const chart = storedChart?.chart ?? chartSnapshot;
  if (!chart) {
    throw new ApiError("CHART_NOT_FOUND", "chart not found.", { field: "chart_id", status: 404 });
  }
  return chart;
}

function requirePalace(chart: Chart, palaceId: string): Palace {
  const palace = chart.palaces.find((item) => item.palace_id === palaceId);
  if (!palace) {
    throw new ApiError("PALACE_NOT_FOUND", "palace not found.", { field: "palace_id", status: 404 });
  }
  return palace;
}

function buildStarKeywords(palace: Palace): string[] {
  const keywords = unique([...palace.main_stars, ...palace.support_stars.slice(0, 3), ...palace.transforms]).map(sanitizeBetaText).filter(Boolean);
  return keywords.length ? keywords.slice(0, 6) : [palace.palace_id];
}

function recordBetaEvent(
  type: BetaEventType,
  event: Omit<BetaEventRecord, "event_id" | "type" | "timestamp"> & { metadata?: BetaEventRecord["metadata"] }
): void {
  saveBetaEvent({
    event_id: createId("event"),
    type,
    timestamp: new Date().toISOString(),
    ...event
  });
}

function normalizeSessionId(sessionId: string | undefined): string {
  const normalized = sanitizeBetaText(sessionId ?? "");
  return normalized || `session_${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeBetaText(text: string): string {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/g, "[birth_date_redacted]")
    .replace(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g, "[birth_time_redacted]")
    .replace(/\b(?:Shanghai|Beijing|Guangzhou|Shenzhen|Chengdu|Hangzhou|Nanjing|Wuhan)\b/gi, "[location_redacted]")
    .replace(/data:image\/[a-zA-Z+.-]+;base64,[A-Za-z0-9+/=]+/g, "[image_payload_redacted]")
    .slice(0, 800);
}

function createPriceInterest(): Record<ReportTierId, number> {
  return Object.fromEntries(reportTierIds.map((tier) => [tier, 0])) as Record<ReportTierId, number>;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function createId(prefix: string): string {
  return `${prefix}_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}_${Math.random().toString(36).slice(2, 8)}`;
}
