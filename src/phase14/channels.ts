import { ApiError } from "../errors.js";
import {
  getChannelShareCardRecord,
  getShareLandingSnapshotRecord,
  getUserRecord,
  getAnonymousVisitorRecord,
  listChartOwnerRecords,
  listChannelGrowthEvents,
  listChannelShareCards,
  saveAnonymousLink,
  saveAnonymousVisitorRecord,
  saveChannelEntry,
  saveChannelGrowthEvent,
  saveChannelShareCard,
  saveChartOwnerRecord,
  saveUserRecord
} from "../store.js";
import {
  channelGrowthEventTypes,
  channelShareFormats,
  channelSources,
  type AnonymousLink,
  type AnonymousLinkRequest,
  type AnonymousLinkResponse,
  type AnonymousVisitor,
  type ChannelDashboardResponse,
  type ChannelDashboardSummary,
  type ChannelEntry,
  type ChannelEntryRequest,
  type ChannelEntryResponse,
  type ChannelGrowthEvent,
  type ChannelGrowthEventRequest,
  type ChannelGrowthEventResponse,
  type ChannelShareCreateRequest,
  type ChannelShareCreateResponse,
  type DailyPrivacy,
  type MiniProgramShareCard,
  type UserAccount
} from "../types.js";
import { createShareLandingSnapshot } from "../phase13/growth.js";
import { createHash } from "node:crypto";

const privacy: DailyPrivacy = {
  hides_full_birth_date: true,
  hides_birth_time: true,
  hides_location_detail: true,
  stores_video_frame: false,
  stores_full_birth_profile: false
};

const privacyNote = "full birth date, birth time, location detail, and camera frames hidden.";
const anonymousPrivacyNote = "anonymous visitor, member id, and openid placeholder are linked without sensitive birth data.";

export function createChannelEntry(request: ChannelEntryRequest): ChannelEntryResponse {
  validateChannel(request?.channel);
  assertChannelEnabled(request.channel);
  const visitorId = normalizeVisitorId(request.visitor_id);
  const campaign = request.campaign ? sanitizeText(request.campaign).slice(0, 80) : undefined;
  const shareId = request.share_id ? sanitizeText(request.share_id).slice(0, 80) : undefined;
  const referrer = request.referrer ? sanitizeText(request.referrer).slice(0, 140) : undefined;
  const entry: ChannelEntry = {
    entry_id: createId("entry"),
    channel: request.channel,
    campaign,
    share_id: shareId,
    referrer,
    visitor_id: visitorId,
    created_at: new Date().toISOString(),
    attribution: {
      channel: request.channel,
      campaign,
      share_id: shareId,
      referrer,
      visitor_id: visitorId
    },
    privacy_note: privacyNote
  };
  saveChannelEntry(entry);
  return {
    entry,
    landing_url: buildLandingUrl("/chart/new", {
      channel: entry.channel,
      campaign: entry.campaign,
      share_id: entry.share_id
    }),
    privacy
  };
}

export function linkAnonymousMember(request: AnonymousLinkRequest): AnonymousLinkResponse {
  const visitorId = sanitizeRequired(request?.visitor_id, "VISITOR_ID_REQUIRED", "visitor_id is required.", "visitor_id").slice(0, 80);
  const memberId = sanitizeRequired(request.member_id, "MEMBER_ID_REQUIRED", "member_id is required.", "member_id").slice(0, 80);
  const now = new Date().toISOString();
  const existingUser = getUserRecord(memberId);
  const user: UserAccount = {
    member_id: memberId,
    display_name: sanitizeText(request.display_name ?? existingUser?.display_name ?? memberId).slice(0, 80),
    email_hash: request.email ? hashIdentifier(request.email) : existingUser?.email_hash,
    phone_hash: request.phone ? hashIdentifier(request.phone) : existingUser?.phone_hash,
    created_at: existingUser?.created_at ?? now,
    upgraded_from_visitor_id: visitorId,
    privacy_note: "email and phone are stored as sha256 hashes; full birth data is not stored in user records."
  };
  const visitor: AnonymousVisitor = {
    visitor_id: visitorId,
    first_seen_at: getAnonymousVisitorRecord(visitorId)?.first_seen_at ?? now,
    upgraded_member_id: memberId,
    upgraded_at: now,
    privacy_note: anonymousPrivacyNote
  };
  const link: AnonymousLink = {
    link_id: createId("link"),
    visitor_id: visitorId,
    member_id: memberId,
    openid_placeholder: request.openid_placeholder ? sanitizeText(request.openid_placeholder).slice(0, 80) : undefined,
    linked_at: now,
    privacy_note: anonymousPrivacyNote
  };
  const migrated = migrateVisitorCharts(visitorId, memberId);
  saveUserRecord(user);
  saveAnonymousVisitorRecord(visitor);
  saveAnonymousLink(link);
  return {
    link,
    user,
    visitor,
    migrated,
    privacy
  };
}

export function createChannelShare(request: ChannelShareCreateRequest): ChannelShareCreateResponse {
  validateChannel(request?.channel);
  assertChannelEnabled(request.channel);
  validateShareFormat(request?.share_format);
  const share = createShareLandingSnapshot({
    member_id: request.member_id,
    source_type: request.source_type,
    source_id: request.source_id,
    title: request.title,
    summary: request.summary,
    keywords: request.keywords,
    safety_flags: ["channel_distribution", ...(request.safety_flags ?? [])]
  });
  const campaign = request.campaign ? sanitizeText(request.campaign).slice(0, 80) : undefined;
  const path = buildLandingUrl(`/share/${share.snapshot.share_id}`, {
    channel: request.channel,
    campaign
  });
  const channelShare: MiniProgramShareCard = {
    share_id: share.snapshot.share_id,
    share_format: request.share_format,
    channel: request.channel,
    campaign,
    title: share.snapshot.title,
    summary: share.snapshot.summary,
    path,
    qr_payload: path,
    privacy_note: privacyNote,
    safety_flags: unique(["daily_observation_only", "avoid_absolute_prediction", "privacy_redaction_required", ...share.snapshot.safety_flags]).slice(0, 10)
  };
  saveChannelShareCard(channelShare);
  return {
    ...share,
    share_url: path,
    channel_share: channelShare
  };
}

export function recordChannelGrowthEvent(request: ChannelGrowthEventRequest): ChannelGrowthEventResponse {
  validateChannel(request?.channel);
  assertChannelEnabled(request.channel);
  validateChannelEventType(request?.event_type);
  if (request.share_format) validateShareFormat(request.share_format);
  const shareId = request.share_id ? sanitizeText(request.share_id).slice(0, 80) : undefined;
  if (shareId && !getShareLandingSnapshotRecord(shareId)) {
    throw new ApiError("SHARE_SNAPSHOT_NOT_FOUND", "share snapshot not found.", { field: "share_id", status: 404 });
  }
  const channelShare = shareId ? getChannelShareCardRecord(shareId) : undefined;
  const visitorId = request.visitor_id ? sanitizeText(request.visitor_id).slice(0, 80) : undefined;
  const campaign = request.campaign ? sanitizeText(request.campaign).slice(0, 80) : channelShare?.campaign;
  const shareFormat = request.share_format ?? channelShare?.share_format;
  const existingDuplicate = Boolean(visitorId) &&
    listChannelGrowthEvents().some(
      (event) =>
        event.event_type === request.event_type &&
        event.channel === request.channel &&
        event.share_id === shareId &&
        event.visitor_id === visitorId
    );
  const event: ChannelGrowthEvent = {
    channel_event_id: createId("chan_evt"),
    event_type: request.event_type,
    channel: request.channel,
    campaign,
    share_id: shareId,
    visitor_id: visitorId,
    member_id: request.member_id ? sanitizeText(request.member_id).slice(0, 80) : undefined,
    created_at: new Date().toISOString(),
    is_duplicate: existingDuplicate,
    share_format: shareFormat,
    metadata: sanitizeMetadata(request.metadata ?? {})
  };
  saveChannelGrowthEvent(event);
  return {
    event,
    dashboard_snapshot: summarizeChannelDashboard(),
    privacy
  };
}

export function getChannelDashboard(): ChannelDashboardResponse {
  return {
    dashboard: summarizeChannelDashboard(),
    privacy
  };
}

function summarizeChannelDashboard(): ChannelDashboardSummary {
  const events = listChannelGrowthEvents();
  const cards = listChannelShareCards();
  const disabledChannels = getDisabledChannels();
  const byChannel = Object.fromEntries(channelSources.map((source) => [source, 0])) as ChannelDashboardSummary["by_channel"];
  const byEvent = Object.fromEntries(channelGrowthEventTypes.map((type) => [type, 0])) as ChannelDashboardSummary["by_event"];
  const byShareFormat = Object.fromEntries(channelShareFormats.map((format) => [format, 0])) as ChannelDashboardSummary["by_share_format"];
  const visitors = new Set<string>();
  for (const event of events) {
    byChannel[event.channel] += 1;
    byEvent[event.event_type] += 1;
    if (event.visitor_id) visitors.add(event.visitor_id);
  }
  for (const card of cards) {
    byShareFormat[card.share_format] += 1;
  }
  return {
    total_channel_events: events.length,
    unique_visitors: visitors.size,
    by_channel: byChannel,
    by_event: byEvent,
    by_share_format: byShareFormat,
    report_intent_events: byEvent.report_intent,
    challenge_join_events: byEvent.challenge_joined,
    disabled_channels: disabledChannels,
    channel_health: summarizeChannelHealth(events, disabledChannels),
    privacy
  };
}

function validateChannel(channel: unknown): asserts channel is ChannelEntryRequest["channel"] {
  if (!channel || !channelSources.includes(channel as never)) {
    throw new ApiError("INVALID_CHANNEL_SOURCE", "channel is invalid.", { field: "channel" });
  }
}

function assertChannelEnabled(channel: ChannelEntryRequest["channel"]): void {
  if (!getDisabledChannels().includes(channel)) return;
  throw new ApiError("CHANNEL_DISABLED", "channel is disabled by growth operations policy.", { field: "channel", status: 403 });
}

function getDisabledChannels(): ChannelEntryRequest["channel"][] {
  const configured = (process.env.ZIWEI_DISABLED_CHANNELS ?? "")
    .split(",")
    .map((channel) => channel.trim())
    .filter(Boolean);
  return unique(configured.filter((channel): channel is ChannelEntryRequest["channel"] => channelSources.includes(channel as never)));
}

function summarizeChannelHealth(events: ChannelGrowthEvent[], disabledChannels: ChannelEntryRequest["channel"][]): ChannelDashboardSummary["channel_health"] {
  return channelSources.map((channel) => {
    const channelEvents = events.filter((event) => event.channel === channel);
    const uniqueVisitors = new Set(channelEvents.map((event) => event.visitor_id).filter(Boolean)).size;
    const duplicateCount = channelEvents.filter((event) => event.is_duplicate).length;
    const reportIntentCount = channelEvents.filter((event) => event.event_type === "report_intent").length;
    const duplicateRate = channelEvents.length > 0 ? duplicateCount / channelEvents.length : 0;
    const conversionProxyRate = channelEvents.length > 0 ? reportIntentCount / channelEvents.length : 0;
    const disabled = disabledChannels.includes(channel);
    const status = resolveChannelHealthStatus({
      disabled,
      eventCount: channelEvents.length,
      duplicateRate,
      conversionProxyRate
    });
    return {
      channel,
      status,
      event_count: channelEvents.length,
      unique_visitors: uniqueVisitors,
      duplicate_event_count: duplicateCount,
      duplicate_rate: Number(duplicateRate.toFixed(4)),
      report_intent_events: reportIntentCount,
      conversion_proxy_rate: Number(conversionProxyRate.toFixed(4)),
      disabled,
      reason: buildChannelHealthReason(status, channelEvents.length, duplicateCount, reportIntentCount),
      recommendation: buildChannelHealthRecommendation(status),
      privacy_note: "Channel health uses aggregate event counts only; visitor ids, member ids, birth data, contact data, and raw share content are not returned."
    };
  });
}

function resolveChannelHealthStatus(input: {
  disabled: boolean;
  eventCount: number;
  duplicateRate: number;
  conversionProxyRate: number;
}): ChannelDashboardSummary["channel_health"][number]["status"] {
  if (input.disabled) return "paused";
  if (input.eventCount >= 10 && input.duplicateRate >= 0.5) return "pause_candidate";
  if (input.eventCount > 0 && (input.duplicateRate > 0 || input.conversionProxyRate === 0)) return "watch";
  return "healthy";
}

function buildChannelHealthReason(
  status: ChannelDashboardSummary["channel_health"][number]["status"],
  eventCount: number,
  duplicateCount: number,
  reportIntentCount: number
): string {
  if (status === "paused") return "Channel is paused by operations policy.";
  if (status === "pause_candidate") return `${duplicateCount} duplicate events among ${eventCount} tracked events.`;
  if (status === "watch") return `${eventCount} tracked events, ${duplicateCount} duplicates, ${reportIntentCount} report intent events.`;
  return "No pause signal detected in aggregate channel events.";
}

function buildChannelHealthRecommendation(status: ChannelDashboardSummary["channel_health"][number]["status"]): string {
  if (status === "paused") return "Keep the channel paused until campaign owner, cost source, and traffic quality are reviewed.";
  if (status === "pause_candidate") return "Pause spend or invitations for this channel until duplicate traffic is explained.";
  if (status === "watch") return "Keep tracking the channel and compare copy, placement, and report intent before scaling.";
  return "Continue normal tracking.";
}

function validateShareFormat(format: unknown): asserts format is ChannelShareCreateRequest["share_format"] {
  if (!format || !channelShareFormats.includes(format as never)) {
    throw new ApiError("INVALID_CHANNEL_SHARE_FORMAT", "share_format is invalid.", { field: "share_format" });
  }
}

function validateChannelEventType(type: unknown): asserts type is ChannelGrowthEventRequest["event_type"] {
  if (!type || !channelGrowthEventTypes.includes(type as never)) {
    throw new ApiError("INVALID_CHANNEL_EVENT_TYPE", "event_type is invalid.", { field: "event_type" });
  }
}

function normalizeVisitorId(visitorId: string | undefined): string {
  const value = visitorId ? sanitizeText(visitorId).slice(0, 80) : "";
  return value || createId("visitor");
}

function sanitizeRequired(value: string | undefined, code: string, message: string, field: string): string {
  const sanitized = sanitizeText(value ?? "");
  if (!sanitized) {
    throw new ApiError(code, message, { field });
  }
  return sanitized;
}

function buildLandingUrl(path: string, query: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}

function sanitizeMetadata(metadata: Record<string, string | number | boolean>): Record<string, string | number | boolean> {
  const sanitized: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(metadata)) {
    sanitized[sanitizeText(key).slice(0, 40)] = typeof value === "string" ? sanitizeText(value).slice(0, 140) : value;
  }
  return sanitized;
}

function sanitizeText(text: string): string {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/g, "[birth_date_redacted]")
    .replace(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g, "[birth_time_redacted]")
    .replace(/\b(?:Shanghai|Beijing|Guangzhou|Shenzhen|Chengdu|Hangzhou|Nanjing|Wuhan)\b/gi, "[location_redacted]")
    .replace(/data:image\/[a-zA-Z+.-]+;base64,[A-Za-z0-9+/=]+/g, "[image_payload_redacted]");
}

function migrateVisitorCharts(visitorId: string, memberId: string): { chart_ids: string[] } {
  const migratedChartIds: string[] = [];
  for (const owner of listChartOwnerRecords()) {
    if (owner.visitor_id !== visitorId) continue;
    saveChartOwnerRecord({
      chart_id: owner.chart_id,
      member_id: memberId,
      created_at: owner.created_at
    });
    migratedChartIds.push(owner.chart_id);
  }
  return { chart_ids: migratedChartIds };
}

function hashIdentifier(value: string): string {
  const normalized = sanitizeText(value).toLowerCase();
  return `sha256:${createHash("sha256").update(normalized).digest("hex")}`;
}

function createId(prefix: string): string {
  return `${prefix}_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}_${Math.random().toString(36).slice(2, 8)}`;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}
