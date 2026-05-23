import { ApiError } from "../errors.js";
import { getChart, getDailyThemeRecord, listDailyCheckIns, saveDailyCheckIn, saveDailyTheme } from "../store.js";
import {
  interpretationModes,
  type Achievement,
  type AchievementListResponse,
  type Chart,
  type CheckInEvent,
  type DailyCheckInRequest,
  type DailyCheckInResponse,
  type DailyPrivacy,
  type DailyQuest,
  type DailyQuestCategory,
  type DailyShareCard,
  type DailyTheme,
  type DailyThemeRequest,
  type DailyThemeResponse,
  type InterpretationMode,
  type Palace,
  type SeasonalTheme,
  type StarAtlasCard,
  type StarAtlasCardResponse,
  type StarAtlasCategory,
  type StarAtlasListRequest,
  type StarAtlasListResponse
} from "../types.js";

const dailyPalaceIds = ["life", "career", "wealth", "spouse", "fortune", "migration"] as const;
const privacy: DailyPrivacy = {
  hides_full_birth_date: true,
  hides_birth_time: true,
  hides_location_detail: true,
  stores_video_frame: false,
  stores_full_birth_profile: false
};

const privacyNote = "full birth date, birth time, location detail, and camera frames hidden by default.";
const hardTerms = ["必然", "死亡", "破产", "离婚", "灾祸", "投资建议", "医疗建议", "法律建议"];

const starAtlasSeeds: Array<Omit<StarAtlasCard, "unlock_status">> = [
  atlasSeed("star_zi_wei", "Zi Wei", "major_star", ["center", "structure"], "Major star for central structure and self-positioning."),
  atlasSeed("star_tian_ji", "Tian Ji", "major_star", ["planning", "movement"], "Major star for planning and adaptive observation."),
  atlasSeed("star_tai_yang", "Tai Yang", "major_star", ["visibility", "responsibility"], "Major star for visible effort and responsibility."),
  atlasSeed("star_wu_qu", "Wu Qu", "major_star", ["resources", "execution"], "Major star for resource management."),
  atlasSeed("star_tian_tong", "Tian Tong", "major_star", ["ease", "restoration"], "Major star for restoration and emotional pacing."),
  atlasSeed("star_lian_zhen", "Lian Zhen", "major_star", ["standards", "boundaries"], "Major star for standards and boundaries."),
  atlasSeed("star_tian_fu", "Tian Fu", "major_star", ["storage", "stewardship"], "Major star for allocation and stewardship."),
  atlasSeed("star_tai_yin", "Tai Yin", "major_star", ["reflection", "support"], "Major star for reflection and inner resources."),
  atlasSeed("star_tan_lang", "Tan Lang", "major_star", ["exploration", "social"], "Major star for exploration and social pull."),
  atlasSeed("star_ju_men", "Ju Men", "major_star", ["speech", "verification"], "Major star for speech and careful verification."),
  atlasSeed("star_tian_xiang", "Tian Xiang", "major_star", ["coordination", "service"], "Major star for coordination and service roles."),
  atlasSeed("star_tian_liang", "Tian Liang", "major_star", ["principles", "protection"], "Major star for protection and principles."),
  atlasSeed("star_qi_sha", "Qi Sha", "major_star", ["decision", "change"], "Major star for decisive change."),
  atlasSeed("star_po_jun", "Po Jun", "major_star", ["reset", "rebuild"], "Major star for reset and rebuilding."),
  atlasSeed("transform_lu", "Hua Lu", "transform", ["resource", "attraction"], "Four-transform card for resources and attraction."),
  atlasSeed("transform_quan", "Hua Quan", "transform", ["action", "pressure"], "Four-transform card for action and responsibility."),
  atlasSeed("transform_ke", "Hua Ke", "transform", ["learning", "reputation"], "Four-transform card for learning and documentation."),
  atlasSeed("transform_ji", "Hua Ji", "transform", ["constraint", "care"], "Four-transform card for constraints and careful review."),
  atlasSeed("pattern_sanfang_sizheng", "San Fang Si Zheng", "pattern", ["relation", "trace"], "Pattern card for relationship structure and trace support.")
];

const achievementTemplates: Array<Omit<Achievement, "unlocked" | "progress" | "unlocked_at">> = [
  {
    achievement_id: "achievement_daily_first_checkin",
    label: "First Daily Check-in",
    description: "Complete one daily quest.",
    target: 1,
    safety_flags: ["daily_observation_only"]
  },
  {
    achievement_id: "achievement_three_daily_quests",
    label: "Three Gentle Quests",
    description: "Complete three low-risk daily quests.",
    target: 3,
    safety_flags: ["daily_observation_only"]
  },
  {
    achievement_id: "achievement_star_atlas_reader",
    label: "Star Atlas Reader",
    description: "Favorite one star atlas card.",
    target: 1,
    safety_flags: ["avoid_absolute_prediction"]
  },
  {
    achievement_id: "achievement_daily_share_intent",
    label: "Daily Share Intent",
    description: "Mark one daily card as share-worthy.",
    target: 1,
    safety_flags: ["privacy_redaction_required"]
  }
];

export function createDailyTheme(request: DailyThemeRequest): DailyThemeResponse {
  const date = normalizeDailyDate(request?.date ?? "");
  const mode = normalizeMode(request?.mode);
  const storedChart = getChart(request.chart_id);
  const chart = storedChart?.chart ?? request.chart;
  if (!chart) {
    throw new ApiError("CHART_NOT_FOUND", "chart not found.", { field: "chart_id", status: 404 });
  }
  const palace = selectDailyPalace(chart, request.palace_id, date);
  const ruleProfileId = storedChart?.rule_profile_id ?? "default_ziwei_v0_1";
  const ruleVersion = storedChart?.rule_version ?? "rules_v0.2";
  const seasonalTheme = resolveSeasonalTheme(date, storedChart?.normalized_birth.solar_date ?? null);
  const starKeywords = buildStarKeywords(palace);
  const safetyFlags = unique([
    "avoid_absolute_prediction",
    "daily_observation_only",
    "major_decision_guard",
    ...sensitiveFlagsForPalace(palace.palace_id),
    ...(seasonalTheme?.safety_flags ?? [])
  ]);
  const theme: DailyTheme = {
    daily_theme_id: `daily_${date.replace(/-/g, "")}_${palace.palace_id}`,
    chart_id: sanitizeText(request.chart_id),
    date,
    mode,
    palace_id: palace.palace_id,
    palace_label: sanitizeText(readablePalaceLabel(palace)),
    rule_profile_id: ruleProfileId,
    rule_version: ruleVersion,
    title: `Daily Stargarden: ${readablePalaceLabel(palace)}`,
    summary: buildDailySummary(palace, mode),
    star_keywords: starKeywords,
    seasonal_theme: seasonalTheme,
    quests: buildDailyQuests(date, palace),
    trace: [
      {
        trace_id: `trace_${date.replace(/-/g, "")}_${palace.palace_id}`,
        rule_id: `daily_${palace.palace_id}_observation`,
        rule_profile_id: ruleProfileId,
        rule_version: ruleVersion,
        knowledge_node_ids: buildKnowledgeNodeIds(palace, starKeywords),
        basis: `Daily theme uses ${readablePalaceLabel(palace)}, rule profile ${ruleProfileId}, and linked knowledge nodes as symbolic observation context.`,
        confidence: "weak_structure",
        safety_flags: safetyFlags
      }
    ],
    share_card: buildDailyShareCard(date, palace, starKeywords, safetyFlags),
    safety_flags: safetyFlags
  };

  saveDailyTheme(theme);
  return {
    daily_theme: theme,
    privacy
  };
}

export function recordDailyCheckIn(request: DailyCheckInRequest): DailyCheckInResponse {
  validateCheckInRequest(request);
  const theme = getDailyThemeRecord(request.daily_theme_id);
  if (!theme) {
    throw new ApiError("DAILY_THEME_NOT_FOUND", "daily theme not found.", { field: "daily_theme_id", status: 404 });
  }
  const validQuestIds = new Set(theme.quests.map((quest) => quest.quest_id));
  const completedQuestIds = unique(request.completed_quest_ids.filter((questId) => validQuestIds.has(questId))).slice(0, 3);
  const favoriteStarCardIds = unique((request.favorite_star_card_ids ?? []).filter((cardId) => starAtlasSeeds.some((card) => card.card_id === cardId))).slice(0, 6);
  const event: CheckInEvent = {
    check_in_id: createId("checkin"),
    daily_theme_id: theme.daily_theme_id,
    member_id: normalizeMemberId(request.member_id),
    completed_quest_ids: completedQuestIds,
    favorite_star_card_ids: favoriteStarCardIds,
    share_intent: Boolean(request.share_intent),
    feedback: request.feedback ? sanitizeText(request.feedback).slice(0, 280) : undefined,
    created_at: new Date().toISOString(),
    consent: request.consent
  };
  saveDailyCheckIn(event);
  return {
    check_in: event,
    achievements: buildAchievements(event.member_id).achievements,
    privacy
  };
}

export function listStarAtlas(request: StarAtlasListRequest = {}): StarAtlasListResponse {
  const memberId = normalizeMemberId(request.member_id);
  return {
    cards: starAtlasSeeds.map((card) => attachUnlockStatus(card, memberId)),
    privacy
  };
}

export function getStarAtlasCard(cardId: string, memberId?: string): StarAtlasCardResponse {
  const seed = starAtlasSeeds.find((card) => card.card_id === cardId);
  if (!seed) {
    throw new ApiError("STAR_ATLAS_CARD_NOT_FOUND", "star atlas card not found.", { field: "card_id", status: 404 });
  }
  return {
    card: attachUnlockStatus(seed, normalizeMemberId(memberId)),
    related_knowledge_node_id: seed.knowledge_node_id,
    privacy
  };
}

export function getMemberAchievements(memberId?: string): AchievementListResponse {
  return buildAchievements(normalizeMemberId(memberId));
}

function validateCheckInRequest(request: DailyCheckInRequest): void {
  if (!request?.daily_theme_id) {
    throw new ApiError("DAILY_THEME_REQUIRED", "daily_theme_id is required.", { field: "daily_theme_id" });
  }
  if (!request.consent?.agreed || !request.consent.no_sensitive_birth_data || !request.consent.no_video_frame) {
    throw new ApiError("DAILY_CHECK_IN_CONSENT_REQUIRED", "daily check-in requires privacy consent.", { field: "consent" });
  }
  if (!Array.isArray(request.completed_quest_ids)) {
    throw new ApiError("DAILY_QUESTS_REQUIRED", "completed_quest_ids must be an array.", { field: "completed_quest_ids" });
  }
}

function selectDailyPalace(chart: Chart, requestedPalaceId: string | undefined, date: string): Palace {
  if (requestedPalaceId) {
    const requested = chart.palaces.find((palace) => palace.palace_id === requestedPalaceId);
    if (!requested) {
      throw new ApiError("PALACE_NOT_FOUND", "palace not found.", { field: "palace_id", status: 404 });
    }
    return requested;
  }
  const index = dayNumber(date) % dailyPalaceIds.length;
  const selected = chart.palaces.find((palace) => palace.palace_id === dailyPalaceIds[index]);
  if (selected) return selected;
  const fallback = chart.palaces[0];
  if (!fallback) {
    throw new ApiError("CHART_EMPTY", "chart has no palaces.", { field: "chart", status: 400 });
  }
  return fallback;
}

function buildDailySummary(palace: Palace, mode: InterpretationMode): string {
  const label = readablePalaceLabel(palace);
  if (mode === "entertainment") {
    return `Today highlights ${label} as a light observation card. Use it for one small, reversible action and avoid treating it as prediction.`;
  }
  return `Basis: ${label}, current chart structure, and rule version trace. Interpretation remains a daily observation only, not a concrete event forecast.`;
}

function buildDailyQuests(date: string, palace: Palace): DailyQuest[] {
  const templates: Array<{ category: DailyQuestCategory; title: string; prompt: string }> = [
    {
      category: "reflection",
      title: "Write one observation",
      prompt: `Record one low-risk observation related to ${readablePalaceLabel(palace)}.`
    },
    {
      category: "organization",
      title: "Sort one priority",
      prompt: "Choose one small task that can be reviewed tonight."
    },
    {
      category: "communication",
      title: "Check one boundary",
      prompt: "Before responding, name one need and one limit in neutral language."
    }
  ];
  const count = Math.min(3, Math.max(1, (dayNumber(date) % 3) + 1));
  return templates.slice(0, count).map((template, index) => ({
    quest_id: `quest_${date.replace(/-/g, "")}_${palace.palace_id}_${template.category}`,
    title: template.title,
    prompt: sanitizeText(template.prompt),
    category: template.category,
    safety_flags: ["daily_observation_only", "major_decision_guard"],
    completed: false
  }));
}

function buildDailyShareCard(date: string, palace: Palace, keywords: string[], safetyFlags: string[]): DailyShareCard {
  return {
    share_card_id: `daily_share_${date.replace(/-/g, "")}_${palace.palace_id}`,
    version: "v0.3",
    card_type: "daily_theme",
    title: `Daily Stargarden card: ${readablePalaceLabel(palace)}`,
    summary: `A light daily observation around ${readablePalaceLabel(palace)}.`,
    keywords: keywords.slice(0, 5),
    privacy_note: privacyNote,
    safety_flags: safetyFlags
  };
}

function buildKnowledgeNodeIds(palace: Palace, keywords: string[]): string[] {
  const palaceNode = `palace_${palace.palace_id}`;
  const starNodes = keywords
    .map((keyword) => starAtlasSeeds.find((card) => card.label.toLowerCase() === keyword.toLowerCase())?.knowledge_node_id)
    .filter(isDefined);
  return unique([palaceNode, ...starNodes, "theme_no_absolute_prediction"]).slice(0, 5);
}

function buildStarKeywords(palace: Palace): string[] {
  const raw = [...palace.main_stars, ...palace.support_stars, ...palace.transforms].map(sanitizeText).filter(Boolean);
  const atlasLabels = starAtlasSeeds.map((seed) => seed.label);
  const known = raw.filter((item) => atlasLabels.some((label) => label.toLowerCase() === item.toLowerCase()));
  return unique(known.length ? known : ["Zi Wei", "Hua Lu"]).slice(0, 6);
}

function attachUnlockStatus(card: Omit<StarAtlasCard, "unlock_status">, memberId: string): StarAtlasCard {
  const events = listDailyCheckIns(memberId);
  const favoriteIds = new Set(events.flatMap((event) => event.favorite_star_card_ids));
  const isDefaultUnlocked = card.category === "major_star";
  return {
    ...card,
    unlock_status: isDefaultUnlocked || favoriteIds.has(card.card_id) ? "unlocked" : "locked"
  };
}

function buildAchievements(memberId: string): AchievementListResponse {
  const events = listDailyCheckIns(memberId);
  const completedQuestCount = events.reduce((sum, event) => sum + event.completed_quest_ids.length, 0);
  const favoriteCount = new Set(events.flatMap((event) => event.favorite_star_card_ids)).size;
  const shareIntentCount = events.filter((event) => event.share_intent).length;
  const progressById: Record<string, number> = {
    achievement_daily_first_checkin: events.length,
    achievement_three_daily_quests: completedQuestCount,
    achievement_star_atlas_reader: favoriteCount,
    achievement_daily_share_intent: shareIntentCount
  };
  const firstUnlock = events[0]?.created_at;
  return {
    member_id: memberId,
    achievements: achievementTemplates.map((template) => {
      const progress = Math.min(progressById[template.achievement_id] ?? 0, template.target);
      return {
        ...template,
        unlocked: progress >= template.target,
        progress,
        unlocked_at: progress >= template.target ? firstUnlock : undefined
      };
    }),
    privacy
  };
}

function resolveSeasonalTheme(date: string, birthSolarDate: string | null): SeasonalTheme | undefined {
  const monthDay = date.slice(5);
  const birthMonth = birthSolarDate?.slice(5, 7);
  const dateMonth = date.slice(5, 7);
  if (birthMonth && birthMonth === dateMonth) {
    return seasonal("birthday_month", "Birthday Month", date, "Use this month for gentle review and one reversible daily experiment.");
  }
  if (monthDay === "02-10") return seasonal("spring_festival", "Spring Festival", date, "Use the seasonal card for renewal and family-boundary observation.");
  if (monthDay === "08-10") return seasonal("qixi", "Qixi", date, "Use the seasonal card for communication style observation, not relationship outcome prediction.");
  if (monthDay === "09-17") return seasonal("mid_autumn", "Mid-Autumn", date, "Use the seasonal card for reflection, gratitude, and pacing.");
  return undefined;
}

function seasonal(seasonalThemeId: string, label: string, themeDate: string, copy: string): SeasonalTheme {
  return {
    seasonal_theme_id: seasonalThemeId,
    label,
    theme_date: themeDate,
    copy: sanitizeText(copy),
    safety_flags: ["daily_observation_only", "avoid_absolute_prediction"]
  };
}

function normalizeDailyDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date ?? ""))) {
    throw new ApiError("INVALID_DAILY_DATE", "date must use yyyy-mm-dd.", { field: "date" });
  }
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new ApiError("INVALID_DAILY_DATE", "date must use yyyy-mm-dd.", { field: "date" });
  }
  if (year < 1900 || year > 2100) {
    throw new ApiError("INVALID_DAILY_DATE", "date must be between 1900 and 2100.", { field: "date" });
  }
  return date;
}

function normalizeMode(mode: InterpretationMode): InterpretationMode {
  if (!interpretationModes.includes(mode)) {
    throw new ApiError("INVALID_INTERPRETATION_MODE", "mode must be professional or entertainment.", { field: "mode" });
  }
  return mode;
}

function normalizeMemberId(memberId: string | undefined): string {
  const value = sanitizeText(memberId ?? "member_guest");
  return value || "member_guest";
}

function readablePalaceLabel(palace: Palace): string {
  const labels: Record<string, string> = {
    life: "Life Palace",
    career: "Career Palace",
    wealth: "Wealth Palace",
    spouse: "Relationship Palace",
    fortune: "Fortune Palace",
    migration: "Migration Palace"
  };
  return labels[palace.palace_id] ?? sanitizeText(palace.name || palace.palace_id);
}

function sensitiveFlagsForPalace(palaceId: string): string[] {
  if (palaceId === "wealth") return ["financial_decision_guard"];
  if (palaceId === "spouse") return ["relationship_decision_guard"];
  return [];
}

function atlasSeed(
  card_id: string,
  label: string,
  category: StarAtlasCategory,
  keywords: string[],
  summary: string
): Omit<StarAtlasCard, "unlock_status"> {
  return {
    card_id,
    label,
    category,
    keywords,
    summary: sanitizeSafeText(summary),
    knowledge_node_id: card_id,
    source_title: "Zi Wei Dou Shu Quan Shu",
    safety_flags: ["avoid_absolute_prediction", category === "transform" ? "major_decision_guard" : "daily_observation_only"]
  };
}

function sanitizeSafeText(text: string): string {
  const sanitized = sanitizeText(text);
  const blocked = hardTerms.find((term) => sanitized.includes(term));
  if (blocked) {
    throw new ApiError("DAILY_CONTENT_SAFETY_VIOLATION", "daily content contains blocked prediction or decision language.", {
      field: "content"
    });
  }
  return sanitized;
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

function dayNumber(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function createId(prefix: string): string {
  return `${prefix}_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}_${Math.random().toString(36).slice(2, 8)}`;
}
