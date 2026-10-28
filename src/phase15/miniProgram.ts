import { createHash } from "node:crypto";
import { ApiError } from "../errors.js";
import { createShareLandingSnapshot } from "../phase13/growth.js";
import {
  getSubscribeConsentRecord,
  getWechatOpenIdBindingRecord,
  saveMiniProgramReminderEvent,
  saveMiniProgramSession,
  saveMiniProgramSharePayload,
  saveSubscribeConsent,
  saveWechatOpenIdBinding
} from "../store.js";
import {
  channelSources,
  miniProgramReminderActions,
  miniProgramShareFormats,
  miniProgramSubscribeTemplateTypes,
  type ChannelSource,
  type DailyPrivacy,
  type MiniProgramLinkMemberRequest,
  type MiniProgramLinkMemberResponse,
  type MiniProgramLoginRequest,
  type MiniProgramLoginResponse,
  type MiniProgramReleaseGate,
  type MiniProgramReleaseGateResponse,
  type MiniProgramReminderEvent,
  type MiniProgramReminderEventRequest,
  type MiniProgramReminderEventResponse,
  type MiniProgramSession,
  type MiniProgramShareCreateRequest,
  type MiniProgramShareCreateResponse,
  type MiniProgramSharePayload,
  type MiniProgramSubscribeRequest,
  type MiniProgramSubscribeResponse,
  type SubscribeTemplateConsent,
  type WechatOpenIdBinding
} from "../types.js";

const privacy: DailyPrivacy = {
  hides_full_birth_date: true,
  hides_birth_time: true,
  hides_location_detail: true,
  stores_video_frame: false,
  stores_full_birth_profile: false
};

const releaseGate: MiniProgramReleaseGate = {
  version: "mini_program_v0.1",
  review_status: "materials_ready",
  rollout_percent: 10,
  fallback_to_h5: true,
  allowed_channels: ["mini_program", "wechat_group"],
  review_notes: ["Service copy uses traditional culture self-observation wording."]
};

const miniProgramPrivacyNote = "openid is hashed; full birth date, birth time, location detail, and camera frames hidden.";
const bindingPrivacyNote = "raw wechat code and raw openid are not stored.";
const subscribePrivacyNote = "subscription events store template consent only, not sensitive birth data.";
const reminderPrivacyNote = "reminder logs do not contain full birth data, location detail, or camera frames.";

export function loginMiniProgram(request: MiniProgramLoginRequest): MiniProgramLoginResponse {
  validateWechatCode(request?.code);
  validateChannel(request.channel);
  const visitorId = normalizeVisitorId(request.visitor_id);
  const campaign = request.campaign ? sanitizeText(request.campaign).slice(0, 80) : undefined;
  const openidHash = hashOpenIdFromCode(request.code);
  const existing = getWechatOpenIdBindingRecord(openidHash);
  const memberId = request.member_id ? sanitizeText(request.member_id).slice(0, 80) : existing?.member_id ?? `member_${openidHash.slice(-12)}`;
  const binding = saveBinding({
    openid_hash: openidHash,
    visitor_id: visitorId,
    member_id: memberId,
    is_duplicate: Boolean(existing)
  });
  const createdAt = new Date();
  const session: MiniProgramSession = {
    session_id: createId("mp_session"),
    visitor_id: visitorId,
    member_id: binding.member_id,
    openid_hash: openidHash,
    openid_binding_status: existing ? "reused" : "new",
    channel: request.channel,
    campaign,
    created_at: createdAt.toISOString(),
    expires_at: new Date(createdAt.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    release_gate: releaseGate,
    privacy_note: miniProgramPrivacyNote
  };
  saveMiniProgramSession(session);
  return {
    session,
    binding,
    release_gate: releaseGate,
    privacy
  };
}

export function linkMiniProgramMember(request: MiniProgramLinkMemberRequest): MiniProgramLinkMemberResponse {
  const visitorId = sanitizeRequired(request?.visitor_id, "VISITOR_ID_REQUIRED", "visitor_id is required.", "visitor_id").slice(0, 80);
  const memberId = sanitizeRequired(request.member_id, "MEMBER_ID_REQUIRED", "member_id is required.", "member_id").slice(0, 80);
  const openidHash = sanitizeRequired(request.openid_hash, "OPENID_HASH_REQUIRED", "openid_hash is required.", "openid_hash").slice(0, 120);
  if (!openidHash.startsWith("wx_openid_hash_")) {
    throw new ApiError("INVALID_OPENID_HASH", "openid_hash is invalid.", { field: "openid_hash" });
  }
  const existing = getWechatOpenIdBindingRecord(openidHash);
  const binding = saveBinding({
    openid_hash: openidHash,
    visitor_id: visitorId,
    member_id: memberId,
    is_duplicate: Boolean(existing)
  });
  return {
    binding,
    privacy
  };
}

export function createMiniProgramShare(request: MiniProgramShareCreateRequest): MiniProgramShareCreateResponse {
  validateChannel(request?.channel);
  validateMiniProgramShareFormat(request?.mini_program_share_format);
  const share = createShareLandingSnapshot({
    member_id: request.member_id,
    source_type: request.source_type,
    source_id: request.source_id,
    title: request.title,
    summary: request.summary,
    keywords: request.keywords,
    safety_flags: ["mini_program_review_required", ...(request.safety_flags ?? [])]
  });
  const campaign = request.campaign ? sanitizeText(request.campaign).slice(0, 80) : undefined;
  const query = buildQuery({
    share_id: share.snapshot.share_id,
    channel: request.channel,
    campaign
  });
  const path = `pages/index/index?${query}`;
  const payload: MiniProgramSharePayload = {
    share_id: share.snapshot.share_id,
    share_format: request.mini_program_share_format,
    channel: request.channel,
    campaign,
    title: share.snapshot.title,
    summary: share.snapshot.summary,
    path,
    qr_payload: `mini://${path}`,
    review_copy: "Traditional culture Stargarden card for self-observation.",
    privacy_note: miniProgramPrivacyNote,
    safety_flags: unique(["daily_observation_only", "avoid_absolute_prediction", "privacy_redaction_required", "mini_program_review_required", ...share.snapshot.safety_flags]).slice(0, 10)
  };
  saveMiniProgramSharePayload(payload);
  return {
    ...share,
    share_url: path,
    mini_program_share: payload
  };
}

export function subscribeMiniProgramTemplate(request: MiniProgramSubscribeRequest): MiniProgramSubscribeResponse {
  const memberId = sanitizeRequired(request?.member_id, "MEMBER_ID_REQUIRED", "member_id is required.", "member_id").slice(0, 80);
  validateSubscribeTemplateType(request.template_type);
  validateChannel(request.channel);
  const consent: SubscribeTemplateConsent = {
    consent_id: createId("mp_subscribe"),
    member_id: memberId,
    template_type: request.template_type,
    template_id: sanitizeRequired(request.template_id, "TEMPLATE_ID_REQUIRED", "template_id is required.", "template_id").slice(0, 80),
    consent_granted: Boolean(request.consent_granted),
    channel: request.channel,
    created_at: new Date().toISOString(),
    privacy_note: subscribePrivacyNote
  };
  saveSubscribeConsent(consent);
  return {
    consent,
    privacy
  };
}

export function recordMiniProgramReminderEvent(request: MiniProgramReminderEventRequest): MiniProgramReminderEventResponse {
  const memberId = sanitizeRequired(request?.member_id, "MEMBER_ID_REQUIRED", "member_id is required.", "member_id").slice(0, 80);
  validateSubscribeTemplateType(request.template_type);
  validateReminderAction(request.action);
  const consent = getSubscribeConsentRecord(memberId, request.template_type);
  if (!consent?.consent_granted) {
    throw new ApiError("SUBSCRIBE_CONSENT_REQUIRED", "subscription consent is required.", { field: "template_type" });
  }
  const event: MiniProgramReminderEvent = {
    reminder_event_id: createId("mp_reminder"),
    member_id: memberId,
    template_type: request.template_type,
    target_date: request.target_date ? sanitizeText(request.target_date).slice(0, 40) : undefined,
    action: request.action,
    created_at: new Date().toISOString(),
    metadata: sanitizeMetadata(request.metadata ?? {}),
    privacy_note: reminderPrivacyNote
  };
  saveMiniProgramReminderEvent(event);
  return {
    event,
    privacy
  };
}

export function getMiniProgramReleaseGate(): MiniProgramReleaseGateResponse {
  return {
    release_gate: releaseGate,
    privacy
  };
}

function saveBinding(input: Pick<WechatOpenIdBinding, "openid_hash" | "visitor_id" | "member_id" | "is_duplicate">): WechatOpenIdBinding {
  const binding: WechatOpenIdBinding = {
    binding_id: createId("mp_binding"),
    openid_hash: input.openid_hash,
    visitor_id: input.visitor_id,
    member_id: input.member_id,
    linked_at: new Date().toISOString(),
    is_duplicate: input.is_duplicate,
    privacy_note: bindingPrivacyNote
  };
  saveWechatOpenIdBinding(binding);
  return binding;
}

function validateWechatCode(code: unknown): asserts code is string {
  const value = typeof code === "string" ? code.trim() : "";
  if (!/^wx_code_[A-Za-z0-9_-]{6,80}$/.test(value)) {
    throw new ApiError("INVALID_WECHAT_CODE", "wechat code is invalid.", { field: "code" });
  }
}

function validateChannel(channel: unknown): asserts channel is ChannelSource {
  if (!channel || !channelSources.includes(channel as never)) {
    throw new ApiError("INVALID_CHANNEL_SOURCE", "channel is invalid.", { field: "channel" });
  }
}

function validateMiniProgramShareFormat(format: unknown): asserts format is MiniProgramShareCreateRequest["mini_program_share_format"] {
  if (!format || !miniProgramShareFormats.includes(format as never)) {
    throw new ApiError("INVALID_MINI_PROGRAM_SHARE_FORMAT", "mini_program_share_format is invalid.", { field: "mini_program_share_format" });
  }
}

function validateSubscribeTemplateType(type: unknown): asserts type is MiniProgramSubscribeRequest["template_type"] {
  if (!type || !miniProgramSubscribeTemplateTypes.includes(type as never)) {
    throw new ApiError("INVALID_SUBSCRIBE_TEMPLATE_TYPE", "template_type is invalid.", { field: "template_type" });
  }
}

function validateReminderAction(action: unknown): asserts action is MiniProgramReminderEventRequest["action"] {
  if (!action || !miniProgramReminderActions.includes(action as never)) {
    throw new ApiError("INVALID_REMINDER_ACTION", "reminder action is invalid.", { field: "action" });
  }
}

function normalizeVisitorId(visitorId: string | undefined): string {
  const value = visitorId ? sanitizeText(visitorId).slice(0, 80) : "";
  return value || createId("visitor");
}

function hashOpenIdFromCode(code: string): string {
  return `wx_openid_hash_${createHash("sha256").update(code).digest("hex").slice(0, 24)}`;
}

function sanitizeRequired(value: string | undefined, code: string, message: string, field: string): string {
  const sanitized = sanitizeText(value ?? "");
  if (!sanitized) {
    throw new ApiError(code, message, { field });
  }
  return sanitized;
}

function buildQuery(query: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  return params.toString();
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
