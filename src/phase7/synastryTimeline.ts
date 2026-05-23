import { ApiError } from "../errors.js";
import { getChart } from "../store.js";
import {
  confidenceLevels,
  interpretationModes,
  type Chart,
  type ConfidenceLevel,
  type InterpretationMode,
  type Palace,
  type Phase7Privacy,
  type Phase7ShareCard,
  type RelationshipTrace,
  type SynastryCreateRequest,
  type SynastryCreateResponse,
  type SynastryProfile,
  type SynastryResult,
  type TimelineInterpretRequest,
  type TimelineInterpretResponse,
  type TraceSource
} from "../types.js";

const mvpPalaceIds = ["life", "career", "wealth", "spouse", "fortune", "migration"] as const;

const privacy: Phase7Privacy = {
  hides_full_birth_date: true,
  hides_birth_time: true,
  hides_location_detail: true,
  stores_video_frame: false,
  requires_participant_consent: true
};

const sourceSynastry: TraceSource = {
  title: "斗数骨髓赋",
  excerpt: "吉凶不可一例而断",
  modern_translation: "合盘只做多因素关系观察，不用单一星曜判断关系结果。"
};

const sourceTimeline: TraceSource = {
  title: "斗数发微论",
  excerpt: "行限参看",
  modern_translation: "年度与月度主题需要和本命结构、宫位主题互相参照。"
};

const palaceThemeLabels: Record<string, string> = {
  life: "自我定位",
  career: "职责边界",
  wealth: "资源配置",
  spouse: "关系沟通",
  fortune: "情绪恢复",
  migration: "外部协作"
};

export function createSynastry(request: SynastryCreateRequest): SynastryCreateResponse {
  validateSynastryRequest(request);
  const primaryChart = resolveChart(request.primary.chart_id, request.primary.chart);
  const partnerChart = resolveChart(request.partner.chart_id, request.partner.chart);
  const labels = [sanitizePhase7Text(request.primary.label || "甲方"), sanitizePhase7Text(request.partner.label || "乙方")] as [string, string];
  const traces = buildSynastryTrace(primaryChart, partnerChart);
  const confidence = confidenceFromWeight(traces.reduce((sum, item) => sum + item.weight, 0));
  const ruleProfileIds = unique([ruleProfileIdForChart(request.primary.chart_id), ruleProfileIdForChart(request.partner.chart_id)].filter(isDefined));
  const ruleVersion = ruleVersionForChart(request.primary.chart_id) ?? ruleVersionForChart(request.partner.chart_id);
  const mode = normalizeMode(request.mode);
  const communicationStyle = buildCommunicationStyle(primaryChart, partnerChart, mode);
  const cooperationRhythm = buildCooperationRhythm(primaryChart, partnerChart, mode);
  const complementaryPoints = buildComplementaryPoints(primaryChart, partnerChart);
  const conflictReminders = [
    "冲突提醒：把差异先当作沟通节奏不同来观察，避免把合盘结果当作关系成败判断。",
    "敏感决定仍应回到现实沟通、专业咨询和双方真实意愿。"
  ];
  const sharedAdvice = [
    "共同建议：先约定一次可复盘的小目标，再观察彼此在执行、表达和反馈上的配合方式。",
    "当解读触及婚恋、投资、健康或法律议题时，只保留提醒，不给重大决策承诺。"
  ];
  const summary = sanitizePhase7Text(`${labels[0]} 与 ${labels[1]} 的合盘重点在沟通边界、协作节奏和互补资源。`);
  const safetyFlags = unique([...traces.flatMap((item) => item.safety_flags), "avoid_absolute_prediction", "relationship_decision_guard", "no_marriage_outcome"]);
  const result: SynastryResult = {
    synastry_id: createId("syn"),
    status: "ready",
    mode,
    rule_profile_ids: ruleProfileIds,
    rule_version: ruleVersion,
    created_at: new Date().toISOString(),
    participant_labels: labels,
    summary,
    communication_style: communicationStyle,
    cooperation_rhythm: cooperationRhythm,
    complementary_points: complementaryPoints,
    conflict_reminders: conflictReminders,
    shared_advice: sharedAdvice,
    confidence,
    safety_flags: safetyFlags,
    trace: traces
  };

  return {
    result,
    share_card: buildSynastryShareCard(result),
    privacy
  };
}

export function interpretTimeline(request: TimelineInterpretRequest): TimelineInterpretResponse {
  validateTimelineRequest(request);
  const mode = normalizeMode(request.mode);
  const chart = resolveChart(request.chart_id, request.chart);
  const palace = resolveTimelinePalace(chart, request.palace_id, request.year, request.month);
  const period = selectMajorPeriod(chart, request.year);
  const scope = request.month ? "monthly" : "annual";
  const trace = buildTimelineTrace(palace, period?.palace_id, request.month);
  const confidence = confidenceFromWeight(trace.reduce((sum, item) => sum + item.weight, 0));
  const annualTheme = {
    year: request.year,
    focus_palace_id: palace.palace_id,
    title: `${request.year} 年度主题：${sanitizePhase7Text(palace.name)}`,
    basis: `依据：${sanitizePhase7Text(palace.name)}主题、大限宫位与阶段 7 年度规则共同触发。`,
    scenario: buildTimelineScenario(palace, "annual", mode),
    advice: "把年度主题拆成可复盘的小行动；不要把主题卡当成投资、医疗、法律、婚恋等重大决策依据。",
    confidence,
    safety_flags: ["avoid_absolute_prediction", "major_decision_guard", "annual_theme_only"]
  };
  const monthlyTheme = request.month
    ? {
        month: request.month,
        focus_palace_id: palace.palace_id,
        title: `${request.month} 月观察：${sanitizePhase7Text(palace.name)}`,
        focus: buildMonthlyFocus(palace, request.month, mode),
        scenario: buildTimelineScenario(palace, "monthly", mode),
        advice: "月度提示只适合做节奏复盘和观察记录，不预测具体事件。",
        confidence: confidenceLevels.includes(confidence) ? confidence : "weak_structure",
        safety_flags: ["avoid_absolute_prediction", "monthly_observation_only"]
      }
    : undefined;
  const response: TimelineInterpretResponse = {
    timeline_id: createId("timeline"),
    chart_id: sanitizePhase7Text(request.chart_id),
    rule_profile_id: ruleProfileIdForChart(request.chart_id),
    rule_version: ruleVersionForChart(request.chart_id),
    scope,
    mode,
    palace_id: palace.palace_id,
    annual_theme: annualTheme,
    monthly_theme: monthlyTheme,
    trace,
    share_card: buildTimelineShareCard(request.year, request.month, palace, annualTheme.scenario),
    privacy
  };

  return response;
}

function validateSynastryRequest(request: SynastryCreateRequest): void {
  if (!request?.primary || !request.partner) {
    throw new ApiError("SYNASTRY_PROFILE_REQUIRED", "primary and partner profiles are required.", { field: "profile" });
  }
  if (!request.primary.consent?.agreed || !request.partner.consent?.agreed || !request.primary.consent.no_sensitive_birth_data || !request.partner.consent.no_sensitive_birth_data) {
    throw new ApiError("SYNASTRY_CONSENT_REQUIRED", "Both participants must consent before synastry can be created.", {
      field: "consent",
      status: 400
    });
  }
  validateProfile(request.primary, "primary");
  validateProfile(request.partner, "partner");
  normalizeMode(request.mode);
}

function validateProfile(profile: SynastryProfile, fieldPrefix: string): void {
  if (!profile.chart_id) {
    throw new ApiError("SYNASTRY_CHART_REQUIRED", `${fieldPrefix}.chart_id is required.`, { field: `${fieldPrefix}.chart_id` });
  }
}

function validateTimelineRequest(request: TimelineInterpretRequest): void {
  if (!request?.chart_id) {
    throw new ApiError("TIMELINE_CHART_REQUIRED", "chart_id is required for timeline interpretation.", { field: "chart_id" });
  }
  if (!Number.isInteger(request.year) || request.year < 1900 || request.year > 2100) {
    throw new ApiError("INVALID_TIMELINE_YEAR", "year must be an integer from 1900 to 2100.", { field: "year" });
  }
  if (request.month !== undefined && (!Number.isInteger(request.month) || request.month < 1 || request.month > 12)) {
    throw new ApiError("INVALID_TIMELINE_MONTH", "month must be an integer from 1 to 12.", { field: "month" });
  }
  normalizeMode(request.mode);
}

function normalizeMode(mode: InterpretationMode): InterpretationMode {
  if (!interpretationModes.includes(mode)) {
    throw new ApiError("INVALID_INTERPRETATION_MODE", "mode must be professional or entertainment.", { field: "mode" });
  }
  return mode;
}

function resolveChart(chartId: string, chartSnapshot?: Chart): Chart {
  const storedChart = getChart(chartId);
  const chart = storedChart?.chart ?? chartSnapshot;
  if (!chart) {
    throw new ApiError("CHART_NOT_FOUND", "chart not found.", { field: "chart_id", status: 404 });
  }
  return chart;
}

function ruleProfileIdForChart(chartId: string): string | undefined {
  return getChart(chartId)?.rule_profile_id;
}

function ruleVersionForChart(chartId: string): string | undefined {
  return getChart(chartId)?.rule_version;
}

function buildSynastryTrace(primary: Chart, partner: Chart): RelationshipTrace[] {
  const primaryLife = requirePalace(primary, "life");
  const partnerSpouse = requirePalace(partner, "spouse");
  const primaryCareer = requirePalace(primary, "career");
  const partnerWealth = requirePalace(partner, "wealth");
  const primaryFortune = requirePalace(primary, "fortune");
  const partnerMigration = requirePalace(partner, "migration");

  return [
    {
      rule_id: "phase7_synastry_life_spouse_bridge",
      layer: "synastry",
      title: "命宫与夫妻宫沟通桥",
      weight: 30 + overlap(primaryLife.main_stars, partnerSpouse.main_stars).length * 6,
      confidence: "medium_structure",
      source: sourceSynastry,
      safety_flags: ["avoid_absolute_prediction", "relationship_decision_guard"],
      matched_points: ["primary.life", "partner.spouse", ...overlap(primaryLife.transforms, partnerSpouse.transforms)]
    },
    {
      rule_id: "phase7_synastry_career_wealth_cooperation",
      layer: "synastry",
      title: "官禄与财帛协作节奏",
      weight: 24 + overlap(primaryCareer.support_stars, partnerWealth.support_stars).length * 4,
      confidence: "medium_structure",
      source: sourceSynastry,
      safety_flags: ["avoid_absolute_prediction", "financial_decision_guard"],
      matched_points: ["primary.career", "partner.wealth", ...primaryCareer.relation_refs.triad]
    },
    {
      rule_id: "phase7_synastry_fortune_migration_boundary",
      layer: "synastry",
      title: "福德与迁移边界观察",
      weight: 20 + overlap(primaryFortune.transforms, partnerMigration.transforms).length * 5,
      confidence: "weak_structure",
      source: sourceSynastry,
      safety_flags: ["avoid_fear_language", "relationship_decision_guard"],
      matched_points: ["primary.fortune", "partner.migration", partnerMigration.relation_refs.opposite]
    }
  ];
}

function buildTimelineTrace(palace: Palace, majorPeriodPalaceId: string | undefined, month: number | undefined): RelationshipTrace[] {
  return [
    {
      rule_id: "phase7_timeline_major_period_overlay",
      layer: "annual_monthly",
      title: "大限叠加年度主题",
      weight: majorPeriodPalaceId === palace.palace_id ? 34 : 26,
      confidence: majorPeriodPalaceId === palace.palace_id ? "strong_structure" : "medium_structure",
      source: sourceTimeline,
      safety_flags: ["avoid_absolute_prediction", "major_decision_guard"],
      matched_points: [palace.palace_id, majorPeriodPalaceId ?? "major_period_unknown"]
    },
    {
      rule_id: month ? "phase7_timeline_monthly_observation" : "phase7_timeline_annual_observation",
      layer: "annual_monthly",
      title: month ? "月度观察规则" : "年度观察规则",
      weight: month ? 18 : 16,
      confidence: "weak_structure",
      source: sourceTimeline,
      safety_flags: ["avoid_absolute_prediction", month ? "monthly_observation_only" : "annual_theme_only"],
      matched_points: [palace.palace_id, month ? `month_${month}` : "annual"]
    }
  ];
}

function buildCommunicationStyle(primary: Chart, partner: Chart, mode: InterpretationMode): string {
  const primaryLife = requirePalace(primary, "life");
  const partnerSpouse = requirePalace(partner, "spouse");
  const sharedStars = overlap(primaryLife.main_stars, partnerSpouse.main_stars);
  if (mode === "entertainment") {
    return `沟通风格：像两张星图先对齐频道，再决定用什么语气推进；${sharedStars.length ? "共同星曜让话题更容易找到入口" : "差异较多时适合先确认事实" }。`;
  }
  return `沟通风格：以命宫与夫妻宫互参，建议先确认事实、需求和边界；${sharedStars.length ? `共同触及 ${sharedStars.slice(0, 2).join("、")}，可作为稳定话题入口` : "未见明显单点同向，需依赖持续沟通校准"}。`;
}

function buildCooperationRhythm(primary: Chart, partner: Chart, mode: InterpretationMode): string {
  const primaryCareer = requirePalace(primary, "career");
  const partnerWealth = requirePalace(partner, "wealth");
  const transformBridge = overlap(primaryCareer.transforms, partnerWealth.transforms);
  if (mode === "entertainment") {
    return `合作节奏：适合用阶段任务推进，${transformBridge.length ? "资源与行动标签有呼应" : "先小步试运行再放大投入"}。`;
  }
  return `合作节奏：官禄宫与财帛宫互看时，重点在职责、资源和回报边界；${transformBridge.length ? `四化呼应 ${transformBridge.join("、")}，可提高协作议题置信度` : "四化呼应不强，建议降低一次性承诺"}。`;
}

function buildComplementaryPoints(primary: Chart, partner: Chart): string[] {
  const points = [
    describePalaceBridge(requirePalace(primary, "career"), requirePalace(partner, "wealth"), "职责规划", "资源盘点"),
    describePalaceBridge(requirePalace(primary, "fortune"), requirePalace(partner, "migration"), "情绪恢复", "外部探索"),
    describePalaceBridge(requirePalace(primary, "life"), requirePalace(partner, "spouse"), "自我表达", "关系互动")
  ];
  return points.map(sanitizePhase7Text);
}

function describePalaceBridge(left: Palace, right: Palace, leftTheme: string, rightTheme: string): string {
  const leftStar = left.main_stars[0] ?? left.support_stars[0] ?? left.name;
  const rightStar = right.main_stars[0] ?? right.support_stars[0] ?? right.name;
  return `互补点：${leftTheme}可参考${leftStar}的组织方式，${rightTheme}可借用${rightStar}的表达资源。`;
}

function resolveTimelinePalace(chart: Chart, requestedPalaceId: string | undefined, year: number, month: number | undefined): Palace {
  const palaceId = requestedPalaceId ?? mvpPalaceIds[Math.abs((year + (month ?? 0)) % mvpPalaceIds.length)];
  if (!mvpPalaceIds.includes(palaceId as (typeof mvpPalaceIds)[number])) {
    throw new ApiError("TIMELINE_PALACE_NOT_OPEN", "phase 7 timeline only covers the six MVP palaces.", { field: "palace_id" });
  }
  return requirePalace(chart, palaceId);
}

function selectMajorPeriod(chart: Chart, year: number) {
  if (!chart.major_periods.length) return undefined;
  return chart.major_periods[Math.abs(year) % chart.major_periods.length];
}

function buildTimelineScenario(palace: Palace, scope: "annual" | "monthly", mode: InterpretationMode): string {
  const theme = palaceThemeLabels[palace.palace_id] ?? palace.name;
  if (mode === "entertainment") {
    return scope === "annual"
      ? `年度主题像一张观察卡，适合围绕${theme}安排可复盘的小任务。`
      : `月度观察聚焦${theme}，适合记录节奏变化和协作反馈。`;
  }
  return scope === "annual"
    ? `现实场景可落在${theme}、阶段目标、资源安排和可验证行动上。`
    : `现实场景可落在${theme}的短周期调整，不延伸为具体事件预测。`;
}

function buildMonthlyFocus(palace: Palace, month: number, mode: InterpretationMode): string {
  const theme = palaceThemeLabels[palace.palace_id] ?? palace.name;
  if (mode === "entertainment") {
    return `${month} 月观察聚焦${theme}，适合用一张轻量卡片记录状态。`;
  }
  return `${month} 月观察：以${theme}为主轴，结合本命宫位和大限主题做节奏复盘。`;
}

function buildSynastryShareCard(result: SynastryResult): Phase7ShareCard {
  return {
    share_card_id: createId("syn_share"),
    title: `${result.participant_labels[0]} × ${result.participant_labels[1]} 合盘分享`,
    summary: result.summary,
    share_text: `合盘分享 | ${result.communication_style} | ${result.shared_advice[0]}`,
    privacy_note: "full birth date, birth time, and location detail hidden by default.",
    safety_flags: result.safety_flags
  };
}

function buildTimelineShareCard(year: number, month: number | undefined, palace: Palace, scenario: string): Phase7ShareCard {
  const title = month ? `${year} 年 ${month} 月年度主题卡` : `${year} 年度主题卡`;
  return {
    share_card_id: createId("timeline_share"),
    title,
    summary: `${sanitizePhase7Text(palace.name)}：${scenario}`,
    share_text: `年度主题 | ${year}${month ? `-${String(month).padStart(2, "0")}` : ""} | ${sanitizePhase7Text(palace.name)} | ${scenario}`,
    privacy_note: "full birth date, birth time, and location detail hidden by default.",
    safety_flags: ["avoid_absolute_prediction", "major_decision_guard"]
  };
}

function requirePalace(chart: Chart, palaceId: string): Palace {
  const palace = chart.palaces.find((item) => item.palace_id === palaceId);
  if (!palace) {
    throw new ApiError("PALACE_NOT_FOUND", "palace not found.", { field: "palace_id", status: 404 });
  }
  return palace;
}

function confidenceFromWeight(weight: number): ConfidenceLevel {
  if (weight >= 70) return "strong_structure";
  if (weight >= 42) return "medium_structure";
  return "weak_structure";
}

function overlap<T>(left: T[], right: T[]): T[] {
  return left.filter((item) => right.includes(item));
}

function isDefined<T>(item: T | undefined): item is T {
  return item !== undefined;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function sanitizePhase7Text(text: string): string {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/g, "[birth_date_redacted]")
    .replace(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g, "[birth_time_redacted]")
    .replace(/\b(?:Shanghai|Beijing|Guangzhou|Shenzhen|Chengdu|Hangzhou|Nanjing|Wuhan)\b/gi, "[location_redacted]")
    .replace(/data:image\/[a-zA-Z+.-]+;base64,[A-Za-z0-9+/=]+/g, "[image_payload_redacted]")
    .slice(0, 900);
}

function createId(prefix: string): string {
  return `${prefix}_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}_${Math.random().toString(36).slice(2, 8)}`;
}
