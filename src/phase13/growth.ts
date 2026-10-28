import { ApiError } from "../errors.js";
import { productRepository } from "../repositories/productRepository.js";
import {
  getChallengeProgressRecord,
  getShareLandingSnapshotRecord,
  listChallengeProgress,
  listDailyCheckIns,
  listReferralEvents,
  saveChallengeProgress,
  saveReferralEvent
} from "../store.js";
import {
  communityChallengeTypes,
  referralEventTypes,
  shareLandingSourceTypes,
  type ChallengeCheckInRequest,
  type ChallengeCheckInResponse,
  type ChallengeJoinRequest,
  type ChallengeJoinResponse,
  type ChallengeListRequest,
  type ChallengeListResponse,
  type ChallengeProgress,
  type CommunityChallenge,
  type DailyPrivacy,
  type DailyStreakRequest,
  type DailyStreakResponse,
  type Phase13GrowthDashboardSummary,
  type ReferralEvent,
  type ReferralEventRequest,
  type ReferralEventResponse,
  type ShareCreateRequest,
  type ShareCreateResponse,
  type ShareLandingResponse,
  type ShareLandingSnapshot
} from "../types.js";

const privacy: DailyPrivacy = {
  hides_full_birth_date: true,
  hides_birth_time: true,
  hides_location_detail: true,
  stores_video_frame: false,
  stores_full_birth_profile: false
};

const privacyNote = "full birth date, birth time, location detail, and camera frames hidden.";

const communityChallenges: CommunityChallenge[] = [
  {
    challenge_id: "challenge_7_day_stargarden",
    title: "7-Day Stargarden Challenge",
    description: "Complete one gentle observation each day.",
    challenge_type: "seven_day_stargarden",
    target_count: 7,
    safety_flags: ["daily_observation_only", "avoid_absolute_prediction"],
    share_card_enabled: true,
    seasonal: false
  },
  {
    challenge_id: "challenge_seasonal_theme",
    title: "Seasonal Theme Challenge",
    description: "Use seasonal cards for reversible reflection prompts.",
    challenge_type: "seasonal_theme",
    target_count: 3,
    safety_flags: ["daily_observation_only", "major_decision_guard"],
    share_card_enabled: true,
    seasonal: true
  },
  {
    challenge_id: "challenge_star_atlas_collection",
    title: "Star Atlas Collection",
    description: "Unlock and save five atlas cards with source-aware notes.",
    challenge_type: "star_atlas_collection",
    target_count: 5,
    safety_flags: ["avoid_absolute_prediction", "privacy_redaction_required"],
    share_card_enabled: true,
    seasonal: false
  }
];

export function getDailyStreak(request: DailyStreakRequest = {}): DailyStreakResponse {
  const memberId = normalizeMemberId(request.member_id);
  const asOfDate = normalizeOptionalDate(request.as_of_date) ?? currentDateString();
  const dates = unique(
    listDailyCheckIns(memberId)
      .map((event) => parseDateFromDailyThemeId(event.daily_theme_id) ?? event.created_at.slice(0, 10))
      .filter((date) => date <= asOfDate)
  ).sort();
  const lastCheckInDate = dates.at(-1);
  const currentStreakDays = countCurrentStreak(dates, asOfDate);
  const longestStreakDays = countLongestStreak(dates);

  return {
    streak: {
      member_id: memberId,
      current_streak_days: currentStreakDays,
      longest_streak_days: longestStreakDays,
      last_check_in_date: lastCheckInDate,
      break_protection_available: currentStreakDays > 0 && currentStreakDays < 7,
      week_theme: buildWeekTheme(asOfDate, currentStreakDays),
      next_recommended_action:
        currentStreakDays > 0
          ? "Generate today card and complete one low-risk quest."
          : "Start today with one reversible Stargarden observation.",
      privacy_note: privacyNote
    },
    privacy
  };
}

export function createShareLandingSnapshot(request: ShareCreateRequest): ShareCreateResponse {
  validateShareCreateRequest(request);
  const snapshot: ShareLandingSnapshot = {
    share_id: createId("share"),
    version: "v0.1",
    source_type: request.source_type,
    source_id: sanitizeText(request.source_id),
    title: sanitizeShareText(request.title).slice(0, 120),
    summary: sanitizeShareText(request.summary).slice(0, 300),
    keywords: unique((request.keywords ?? []).map(sanitizeShareText).filter(Boolean)).slice(0, 8),
    safety_flags: unique(["daily_observation_only", "privacy_redaction_required", ...(request.safety_flags ?? []).map(sanitizeText)]).slice(0, 8),
    created_at: new Date().toISOString(),
    privacy_note: privacyNote
  };
  productRepository.saveShareLandingSnapshot(snapshot);
  return {
    share_url: `/share/${snapshot.share_id}`,
    snapshot,
    privacy
  };
}

export function getShareLandingSnapshot(shareId: string): ShareLandingResponse {
  const snapshot = productRepository.getShareLandingSnapshot(sanitizeText(shareId));
  if (!snapshot) {
    throw new ApiError("SHARE_SNAPSHOT_NOT_FOUND", "share snapshot not found.", { field: "share_id", status: 404 });
  }
  return {
    snapshot,
    privacy
  };
}

export async function getShareLandingSnapshotAsync(shareId: string): Promise<ShareLandingResponse> {
  const snapshot = await productRepository.getShareLandingSnapshotAsync(sanitizeText(shareId));
  if (!snapshot) {
    throw new ApiError("SHARE_SNAPSHOT_NOT_FOUND", "share snapshot not found.", { field: "share_id", status: 404 });
  }
  return {
    snapshot,
    privacy
  };
}

export function recordReferralEvent(request: ReferralEventRequest): ReferralEventResponse {
  validateReferralRequest(request);
  const snapshot = getShareLandingSnapshotRecord(sanitizeText(request.share_id));
  if (!snapshot) {
    throw new ApiError("SHARE_SNAPSHOT_NOT_FOUND", "share snapshot not found.", { field: "share_id", status: 404 });
  }
  const eventType = request.event_type;
  const visitorId = request.visitor_id ? sanitizeText(request.visitor_id) : undefined;
  const memberId = request.member_id ? normalizeMemberId(request.member_id) : undefined;
  const existingDuplicate = listReferralEvents().some(
    (event) => event.share_id === snapshot.share_id && event.event_type === eventType && event.visitor_id === visitorId && Boolean(visitorId)
  );
  const event: ReferralEvent = {
    referral_event_id: createId("ref"),
    share_id: snapshot.share_id,
    event_type: eventType,
    visitor_id: visitorId,
    member_id: memberId,
    created_at: new Date().toISOString(),
    is_duplicate: existingDuplicate,
    metadata: sanitizeMetadata(request.metadata ?? {})
  };
  saveReferralEvent(event);
  return {
    event,
    dashboard_snapshot: summarizeReferralEvents(),
    privacy
  };
}

export function listCommunityChallenges(request: ChallengeListRequest = {}): ChallengeListResponse {
  const memberId = normalizeMemberId(request.member_id);
  return {
    challenges: communityChallenges,
    progress: listChallengeProgress(memberId),
    privacy
  };
}

export function joinChallenge(request: ChallengeJoinRequest): ChallengeJoinResponse {
  const memberId = normalizeMemberId(request.member_id);
  const challenge = getCommunityChallengeOrThrow(request.challenge_id);
  const existing = getChallengeProgressRecord(memberId, challenge.challenge_id);
  const progress =
    existing ??
    ({
      challenge_id: challenge.challenge_id,
      member_id: memberId,
      status: "active",
      current_count: 0,
      target_count: challenge.target_count,
      joined_at: new Date().toISOString(),
      completed_at: undefined,
      last_check_in_ref: undefined,
      privacy_note: privacyNote
    } satisfies ChallengeProgress);
  saveChallengeProgress(progress);
  return {
    challenge,
    progress,
    privacy
  };
}

export function checkInChallenge(request: ChallengeCheckInRequest): ChallengeCheckInResponse {
  const memberId = normalizeMemberId(request.member_id);
  const challenge = getCommunityChallengeOrThrow(request.challenge_id);
  const existing = getChallengeProgressRecord(memberId, challenge.challenge_id) ?? joinChallenge({ member_id: memberId, challenge_id: challenge.challenge_id }).progress;
  const checkInRef = normalizeCheckInRef(request.check_in_ref, challenge.challenge_id);
  const existingCheckInRefs = unique([...(existing.checked_in_refs ?? []), existing.last_check_in_ref].filter((ref): ref is string => Boolean(ref)));
  const alreadyCheckedIn = existingCheckInRefs.includes(checkInRef);
  const currentCount = alreadyCheckedIn ? existing.current_count : Math.min(challenge.target_count, existing.current_count + 1);
  const completed = currentCount >= challenge.target_count;
  const progress: ChallengeProgress = {
    ...existing,
    current_count: currentCount,
    status: completed ? "completed" : "active",
    target_count: challenge.target_count,
    completed_at: completed ? existing.completed_at ?? new Date().toISOString() : undefined,
    last_check_in_ref: alreadyCheckedIn ? existing.last_check_in_ref ?? checkInRef : checkInRef,
    checked_in_refs: alreadyCheckedIn ? existingCheckInRefs : [...existingCheckInRefs, checkInRef],
    privacy_note: privacyNote
  };
  saveChallengeProgress(progress);
  const share = createShareLandingSnapshot({
    member_id: memberId,
    source_type: "achievement",
    source_id: challenge.challenge_id,
    title: `${challenge.title}: progress ${progress.current_count}/${progress.target_count}`,
    summary: "A privacy-safe community challenge progress card for light daily observation.",
    keywords: [challenge.challenge_type, progress.status],
    safety_flags: challenge.safety_flags
  });
  return {
    challenge,
    progress,
    share_snapshot: share.snapshot,
    privacy
  };
}

function validateShareCreateRequest(request: ShareCreateRequest): void {
  if (!request?.source_type || !shareLandingSourceTypes.includes(request.source_type)) {
    throw new ApiError("INVALID_SHARE_SOURCE_TYPE", "source_type is invalid.", { field: "source_type" });
  }
  if (!request.source_id) {
    throw new ApiError("SHARE_SOURCE_REQUIRED", "source_id is required.", { field: "source_id" });
  }
  if (!request.title || !request.summary) {
    throw new ApiError("SHARE_CONTENT_REQUIRED", "title and summary are required.", { field: "content" });
  }
}

function validateReferralRequest(request: ReferralEventRequest): void {
  if (!request?.share_id) {
    throw new ApiError("SHARE_ID_REQUIRED", "share_id is required.", { field: "share_id" });
  }
  if (!request.event_type || !referralEventTypes.includes(request.event_type)) {
    throw new ApiError("INVALID_REFERRAL_EVENT_TYPE", "event_type is invalid.", { field: "event_type" });
  }
}

function getCommunityChallengeOrThrow(challengeId: string): CommunityChallenge {
  const challenge = communityChallenges.find((item) => item.challenge_id === challengeId);
  if (!challenge || !communityChallengeTypes.includes(challenge.challenge_type)) {
    throw new ApiError("COMMUNITY_CHALLENGE_NOT_FOUND", "community challenge not found.", { field: "challenge_id", status: 404 });
  }
  return challenge;
}

function summarizeReferralEvents(): Phase13GrowthDashboardSummary {
  const events = listReferralEvents();
  return {
    total_referral_events: events.length,
    share_opened: events.filter((event) => event.event_type === "share_opened").length,
    invite_visit: events.filter((event) => event.event_type === "invite_visit").length,
    daily_theme_created: events.filter((event) => event.event_type === "daily_theme_created").length,
    daily_check_in: events.filter((event) => event.event_type === "daily_check_in").length,
    atlas_unlocked: events.filter((event) => event.event_type === "atlas_unlocked").length,
    challenge_joined: events.filter((event) => event.event_type === "challenge_joined").length,
    privacy
  };
}

function countCurrentStreak(dates: string[], asOfDate: string): number {
  const dateSet = new Set(dates);
  let current = dateSet.has(asOfDate) ? asOfDate : previousDate(asOfDate);
  let count = 0;
  while (dateSet.has(current)) {
    count += 1;
    current = previousDate(current);
  }
  return count;
}

function countLongestStreak(dates: string[]): number {
  let longest = 0;
  let current = 0;
  let previous: string | undefined;
  for (const date of dates) {
    current = previous && previousDate(date) === previous ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = date;
  }
  return longest;
}

function buildWeekTheme(asOfDate: string, streakDays: number): string {
  const [, month, day] = asOfDate.split("-").map(Number);
  const weekIndex = Math.ceil(day / 7);
  const themes = ["steady observation", "source-aware sharing", "atlas collection", "gentle review", "seasonal reflection"];
  return `Week ${weekIndex} theme: ${themes[(month + weekIndex + streakDays) % themes.length]}.`;
}

function parseDateFromDailyThemeId(themeId: string): string | undefined {
  const match = /^daily_(\d{4})(\d{2})(\d{2})_/.exec(themeId);
  if (!match) return undefined;
  const date = `${match[1]}-${match[2]}-${match[3]}`;
  return normalizeOptionalDate(date);
}

function normalizeOptionalDate(date: string | undefined): string | undefined {
  if (!date) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ApiError("INVALID_DAILY_DATE", "date must use yyyy-mm-dd.", { field: "date" });
  }
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new ApiError("INVALID_DAILY_DATE", "date must use yyyy-mm-dd.", { field: "date" });
  }
  return date;
}

function previousDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

function currentDateString(): string {
  return currentBusinessDateString();
}

function normalizeCheckInRef(checkInRef: string | undefined, challengeId: string): string {
  const sanitized = checkInRef ? sanitizeCheckInRef(checkInRef) : "";
  return sanitized || `${challengeId}:${currentBusinessDateString()}`;
}

function sanitizeCheckInRef(checkInRef: string): string {
  return String(checkInRef ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9:_-]/g, "")
    .slice(0, 120);
}

function currentBusinessDateString(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function normalizeMemberId(memberId: string | undefined): string {
  const value = sanitizeText(memberId ?? "member_guest");
  return value || "member_guest";
}

function sanitizeMetadata(metadata: Record<string, string | number | boolean>): Record<string, string | number | boolean> {
  const sanitized: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(metadata)) {
    sanitized[sanitizeText(key).slice(0, 40)] = typeof value === "string" ? sanitizeText(value).slice(0, 120) : value;
  }
  return sanitized;
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

function sanitizeShareText(text: string): string {
  return sanitizeText(text).replace(/(?:北京|上海|广州|深圳|成都|杭州|南京|武汉)/g, "[location_redacted]");
}

function createId(prefix: string): string {
  return `${prefix}_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}_${Math.random().toString(36).slice(2, 8)}`;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}
