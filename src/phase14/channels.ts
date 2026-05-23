import { ApiError } from "../errors.js";
import {
  getChannelShareCardRecord,
  getShareLandingSnapshotRecord,
  listChannelGrowthEvents,
  listChannelShareCards,
  saveAnonymousLink,
  saveChannelEntry,
  saveChannelGrowthEvent,
  saveChannelShareCard
} from "../store.js";
import {
  channelGrowthEventTypes,
  channelShareFormats,
  channelSources,
  type AnonymousLink,
  type AnonymousLinkRequest,
  type AnonymousLinkResponse,
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
  type MiniProgramShareCard
} from "../types.js";
import { createShareLandingSnapshot } from "../phase13/growth.js";

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
    landing_url: buildLandingUrl("/phase14", {
      channel: entry.channel,
      campaign: entry.campaign,
      share_id: entry.share_id,
      visitor_id: entry.visitor_id
    }),
    privacy
  };
}

export function linkAnonymousMember(request: AnonymousLinkRequest): AnonymousLinkResponse {
  const visitorId = sanitizeRequired(request?.visitor_id, "VISITOR_ID_REQUIRED", "visitor_id is required.", "visitor_id").slice(0, 80);
  const memberId = sanitizeRequired(request.member_id, "MEMBER_ID_REQUIRED", "member_id is required.", "member_id").slice(0, 80);
  const link: AnonymousLink = {
    link_id: createId("link"),
    visitor_id: visitorId,
    member_id: memberId,
    openid_placeholder: request.openid_placeholder ? sanitizeText(request.openid_placeholder).slice(0, 80) : undefined,
    linked_at: new Date().toISOString(),
    privacy_note: anonymousPrivacyNote
  };
  saveAnonymousLink(link);
  return {
    link,
    privacy
  };
}

export function createChannelShare(request: ChannelShareCreateRequest): ChannelShareCreateResponse {
  validateChannel(request?.channel);
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
    campaign,
    visitor_id: request.visitor_id ? sanitizeText(request.visitor_id).slice(0, 80) : undefined
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
    privacy
  };
}

function validateChannel(channel: unknown): asserts channel is ChannelEntryRequest["channel"] {
  if (!channel || !channelSources.includes(channel as never)) {
    throw new ApiError("INVALID_CHANNEL_SOURCE", "channel is invalid.", { field: "channel" });
  }
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

function createId(prefix: string): string {
  return `${prefix}_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}_${Math.random().toString(36).slice(2, 8)}`;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}
