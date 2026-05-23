import { ApiError } from "../errors.js";
import { interpret } from "../interpret.js";
import { getChart, getReportDraftRecord, saveExportPreview, saveReportDraft } from "../store.js";
import {
  interpretationModes,
  reportExportFormats,
  reportTypes,
  type Chart,
  type ConfidenceLevel,
  type ContentReviewQueueItem,
  type CreatorAsset,
  type ExportPreview,
  type ExportPreviewRequest,
  type InterpretationMode,
  type InterpretationTrace,
  type InterpretResponse,
  type ReportDraft,
  type ReportDraftRequest,
  type ReportExportFormat,
  type ReportSection,
  type ReportTemplate,
  type ReportTrace,
  type ReportType,
  type SynastryCreateResponse,
  type TimelineInterpretResponse
} from "../types.js";

const mvpPalaceIds = ["life", "career", "wealth", "spouse", "fortune", "migration"] as const;

const privacyNote = "full birth date, birth time, and location detail hidden by default.";

const templates: Record<ReportType, ReportTemplate> = {
  single_chart: {
    template_id: "single_chart_six_palaces",
    report_type: "single_chart",
    version: "v0.1",
    title: "Single chart six-palace report",
    section_strategy: "Compose six MVP palace interpretations with basis, trace, advice, share blocks, and safety flags.",
    supported_formats: ["html", "pdf"]
  },
  synastry: {
    template_id: "synastry_comparison",
    report_type: "synastry",
    version: "v0.1",
    title: "Synastry comparison report",
    section_strategy: "Compose relationship communication, cooperation rhythm, complementary points, and boundary reminders.",
    supported_formats: ["html", "pdf"]
  },
  timeline: {
    template_id: "timeline_annual_monthly",
    report_type: "timeline",
    version: "v0.1",
    title: "Annual and monthly theme report",
    section_strategy: "Compose annual theme, optional monthly observation, timeline trace, and share card materials.",
    supported_formats: ["html", "pdf"]
  }
};

const hardTerms = ["一定", "必然", "死亡", "绝症", "破产", "灾祸", "离婚", "分手复合"];
const sensitiveTopicTerms = ["医疗", "健康", "法律", "投资", "婚姻", "婚恋", "心理", "财务"];

export function createReportDraft(request: ReportDraftRequest): ReportDraft {
  const reportType = normalizeReportType(request?.report_type);
  const mode = normalizeMode(request?.mode);
  const template = templates[reportType];
  const reportId = createId("report");
  const createdAt = new Date().toISOString();
  const sections = buildSections(reportId, reportType, request, mode);
  const creatorAssets = buildCreatorAssets(reportId, reportType, sections, request);
  const safetyFlags = unique([
    "avoid_absolute_prediction",
    "privacy_redaction_required",
    ...sections.flatMap((section) => section.safety_flags),
    ...creatorAssets.flatMap((asset) => asset.safety_flags)
  ]);
  const review = reviewReportContent(JSON.stringify({ sections, creator_assets: creatorAssets }), reportId, safetyFlags);
  const chartRef = buildChartRef(reportType, request);
  const ruleMeta = resolveRuleMeta(request);
  const draft: ReportDraft = sanitizeReportDraft({
    report_id: reportId,
    report_type: reportType,
    mode,
    rule_profile_id: ruleMeta.rule_profile_id,
    rule_version: ruleMeta.rule_version,
    template_id: template.template_id,
    template_version: template.version,
    title: template.title,
    created_at: createdAt,
    chart_ref: chartRef,
    source_refs: {
      synastry_id: request.synastry?.result.synastry_id,
      timeline_id: request.timeline?.timeline_id
    },
    sections,
    creator_assets: creatorAssets,
    review,
    privacy_note: privacyNote,
    safety_flags: safetyFlags,
    price_tier_hint: reportType === "single_chart" ? "standard_49" : "premium_99"
  });

  saveReportDraft(draft);
  return draft;
}

function resolveRuleMeta(request: ReportDraftRequest): Pick<ReportDraft, "rule_profile_id" | "rule_version"> {
  if (request.chart_id) {
    const stored = getChart(request.chart_id);
    return {
      rule_profile_id: stored?.rule_profile_id,
      rule_version: stored?.rule_version
    };
  }
  if (request.timeline?.rule_profile_id) {
    return {
      rule_profile_id: request.timeline.rule_profile_id,
      rule_version: request.timeline.rule_version
    };
  }
  if (request.synastry?.result.rule_profile_ids?.length) {
    return {
      rule_profile_id: request.synastry.result.rule_profile_ids.join(","),
      rule_version: request.synastry.result.rule_version
    };
  }
  return {};
}

export function getReportDraft(reportId: string): ReportDraft | undefined {
  if (!reportId) return undefined;
  return getReportDraftRecord(reportId);
}

export function createExportPreview(request: ExportPreviewRequest): ExportPreview {
  const format = normalizeExportFormat(request?.format);
  if (!request?.report_id) {
    throw new ApiError("REPORT_NOT_FOUND", "report_id is required.", { field: "report_id", status: 404 });
  }

  const draft = getReportDraftRecord(request.report_id);
  if (!draft) {
    throw new ApiError("REPORT_NOT_FOUND", "report draft not found.", { field: "report_id", status: 404 });
  }

  if (draft.review.status === "blocked") {
    throw new ApiError("REPORT_REVIEW_BLOCKED", "report must pass content review before export preview.", {
      field: "review_status",
      status: 409
    });
  }

  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
  const preview: ExportPreview = {
    export_preview_id: createId("export"),
    report_id: draft.report_id,
    format,
    preview_url: `/report/${draft.report_id}?format=${format}`,
    created_at: createdAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    review_status: draft.review.status,
    order_created: false,
    payment_status: "preview_only",
    privacy_note: privacyNote
  };

  saveExportPreview(preview);
  return preview;
}

export function reviewReportContent(text: string, reportId: string, inheritedSafetyFlags: string[] = []): ContentReviewQueueItem {
  const rawText = String(text ?? "");
  const blockedTerms = hardTerms.filter((term) => rawText.includes(term));
  const privacyFlags = detectPrivacyFlags(rawText);
  const safetyFlags = unique([...inheritedSafetyFlags, ...detectSafetyFlags(rawText), "avoid_absolute_prediction"]);
  const status = blockedTerms.length || privacyFlags.length ? "blocked" : "approved";

  return {
    review_id: createId("review"),
    report_id: sanitizeText(reportId || "report_unknown"),
    status,
    blocked_terms: blockedTerms,
    privacy_flags: privacyFlags,
    safety_flags: safetyFlags,
    checked_at: new Date().toISOString(),
    notes:
      status === "blocked"
        ? ["Export blocked until hard prediction terms and sensitive private data are removed."]
        : ["Content approved for preview export.", "Payment/order creation remains disabled in phase 8."]
  };
}

function buildSections(
  reportId: string,
  reportType: ReportType,
  request: ReportDraftRequest,
  mode: InterpretationMode
): ReportSection[] {
  if (reportType === "single_chart") {
    return buildSingleChartSections(reportId, request, mode);
  }
  if (reportType === "synastry") {
    return buildSynastrySections(reportId, request.synastry);
  }
  return buildTimelineSections(reportId, request.timeline);
}

function buildSingleChartSections(reportId: string, request: ReportDraftRequest, mode: InterpretationMode): ReportSection[] {
  if (!request.chart_id) {
    throw new ApiError("REPORT_CHART_REQUIRED", "chart_id is required for a single chart report.", { field: "chart_id" });
  }
  const chart = resolveChart(request.chart_id, request.chart);

  return mvpPalaceIds.map((palaceId) => {
    const response = interpret({
      chart_id: request.chart_id as string,
      chart,
      palace_id: palaceId,
      mode,
      include_trace: true
    });
    return sectionFromInterpretation(reportId, response);
  });
}

function buildSynastrySections(reportId: string, synastry: SynastryCreateResponse | undefined): ReportSection[] {
  if (!synastry) {
    throw new ApiError("REPORT_SYNASTRY_REQUIRED", "synastry snapshot is required for a synastry report.", { field: "synastry" });
  }
  const result = synastry.result;
  return [
    {
      section_id: `${reportId}_synastry_overview`,
      title: "合盘对照",
      basis: sanitizeText(`依据：${result.participant_labels.join(" x ")} 的合盘触发 ${result.trace.length} 条关系规则。`),
      interpretation: sanitizeText(`${result.summary} ${result.communication_style} ${result.cooperation_rhythm}`),
      scenario: sanitizeText(result.complementary_points.join(" ")),
      advice: sanitizeText([...result.conflict_reminders, ...result.shared_advice].join(" ")),
      trace: result.trace.map((trace) => ({
        rule_id: sanitizeText(trace.rule_id),
        title: sanitizeText(trace.title),
        source_title: sanitizeText(trace.source.title),
        modern_translation: sanitizeText(trace.source.modern_translation),
        weight: trace.weight,
        confidence: trace.confidence,
        safety_flags: unique(["avoid_absolute_prediction", ...trace.safety_flags])
      })),
      safety_flags: unique(["avoid_absolute_prediction", "relationship_decision_guard", ...result.safety_flags]),
      share_blocks: [sanitizeText(synastry.share_card.title), sanitizeText(synastry.share_card.summary), privacyNote],
      confidence: result.confidence
    }
  ];
}

function buildTimelineSections(reportId: string, timeline: TimelineInterpretResponse | undefined): ReportSection[] {
  if (!timeline) {
    throw new ApiError("REPORT_TIMELINE_REQUIRED", "timeline snapshot is required for a timeline report.", { field: "timeline" });
  }
  const sections: ReportSection[] = [
    {
      section_id: `${reportId}_timeline_annual`,
      title: "年度主题",
      palace_id: timeline.annual_theme.focus_palace_id,
      basis: sanitizeText(timeline.annual_theme.basis),
      interpretation: sanitizeText(timeline.annual_theme.title),
      scenario: sanitizeText(timeline.annual_theme.scenario),
      advice: sanitizeText(timeline.annual_theme.advice),
      trace: timeline.trace.map(traceFromRelationship),
      safety_flags: unique(["avoid_absolute_prediction", "major_decision_guard", ...timeline.annual_theme.safety_flags]),
      share_blocks: [sanitizeText(timeline.share_card.title), sanitizeText(timeline.share_card.summary), privacyNote],
      confidence: timeline.annual_theme.confidence
    }
  ];

  if (timeline.monthly_theme) {
    sections.push({
      section_id: `${reportId}_timeline_monthly`,
      title: "月度观察",
      palace_id: timeline.monthly_theme.focus_palace_id,
      basis: sanitizeText(`依据：${timeline.monthly_theme.title} 与年度主题规则共同触发。`),
      interpretation: sanitizeText(timeline.monthly_theme.focus),
      scenario: sanitizeText(timeline.monthly_theme.scenario),
      advice: sanitizeText(timeline.monthly_theme.advice),
      trace: timeline.trace.map(traceFromRelationship),
      safety_flags: unique(["avoid_absolute_prediction", "monthly_observation_only", ...timeline.monthly_theme.safety_flags]),
      share_blocks: [sanitizeText(timeline.share_card.share_text), privacyNote],
      confidence: timeline.monthly_theme.confidence
    });
  }

  return sections;
}

function sectionFromInterpretation(reportId: string, response: InterpretResponse): ReportSection {
  return {
    section_id: `${reportId}_${response.palace_id}`,
    title: sanitizeText(`${response.palace_id} palace`),
    palace_id: response.palace_id,
    basis: sanitizeText(response.interpretation.basis),
    interpretation: sanitizeText(response.interpretation.interpretation),
    scenario: sanitizeText(response.interpretation.scenario),
    advice: sanitizeText(response.interpretation.advice),
    trace: response.trace.map(traceFromInterpretation),
    safety_flags: unique(["avoid_absolute_prediction", ...response.interpretation.safety_flags]),
    share_blocks: [
      sanitizeText(`${response.palace_id} palace creator card`),
      sanitizeText(response.interpretation.scenario),
      privacyNote
    ],
    confidence: response.interpretation.confidence
  };
}

function traceFromInterpretation(trace: InterpretationTrace): ReportTrace {
  return {
    rule_id: sanitizeText(trace.rule_id),
    title: sanitizeText(trace.layer),
    source_title: sanitizeText(trace.source.title),
    modern_translation: sanitizeText(trace.source.modern_translation),
    weight: trace.weight,
    confidence: trace.confidence,
    safety_flags: unique(["avoid_absolute_prediction", ...trace.safety_flags])
  };
}

function traceFromRelationship(trace: TimelineInterpretResponse["trace"][number]): ReportTrace {
  return {
    rule_id: sanitizeText(trace.rule_id),
    title: sanitizeText(trace.title),
    source_title: sanitizeText(trace.source.title),
    modern_translation: sanitizeText(trace.source.modern_translation),
    weight: trace.weight,
    confidence: trace.confidence,
    safety_flags: unique(["avoid_absolute_prediction", ...trace.safety_flags])
  };
}

function buildCreatorAssets(
  reportId: string,
  reportType: ReportType,
  sections: ReportSection[],
  request: ReportDraftRequest
): CreatorAsset[] {
  const commonAssets: CreatorAsset[] = [
    {
      asset_id: `${reportId}_live_outline`,
      asset_type: "live_outline",
      title: "Live outline",
      body: sanitizeText(`Open with ${templates[reportType].title}, then explain basis, trace, safety note, and one practical observation.`),
      safety_flags: ["avoid_absolute_prediction", "major_decision_guard"],
      privacy_note: privacyNote
    },
    {
      asset_id: `${reportId}_short_video`,
      asset_type: "short_video_script",
      title: "Short video script",
      body: sanitizeText(`Hook: one report theme. Body: ${sections[0]?.title ?? "report section"}. Close with privacy and non-decision disclaimer.`),
      safety_flags: ["avoid_absolute_prediction"],
      privacy_note: privacyNote
    }
  ];

  if (reportType === "single_chart") {
    return [
      ...commonAssets,
      ...sections.map((section) => ({
        asset_id: `${section.section_id}_card`,
        asset_type: "palace_card" as const,
        title: `${section.title} card`,
        body: sanitizeText(`${section.basis} ${section.interpretation}`),
        safety_flags: section.safety_flags,
        privacy_note: privacyNote
      }))
    ];
  }

  if (reportType === "synastry") {
    return [
      ...commonAssets,
      {
        asset_id: `${reportId}_synastry_card`,
        asset_type: "synastry_card",
        title: "Synastry communication card",
        body: sanitizeText(`${request.synastry?.share_card.title ?? "Synastry card"} ${sections[0]?.interpretation ?? ""}`),
        safety_flags: unique(["avoid_absolute_prediction", "relationship_decision_guard", ...(sections[0]?.safety_flags ?? [])]),
        privacy_note: privacyNote
      }
    ];
  }

  return [
    ...commonAssets,
    {
      asset_id: `${reportId}_timeline_card`,
      asset_type: "timeline_card",
      title: "Annual theme card",
      body: sanitizeText(`${request.timeline?.share_card.title ?? "Timeline card"} ${sections[0]?.scenario ?? ""}`),
      safety_flags: unique(["avoid_absolute_prediction", "annual_theme_only", ...(sections[0]?.safety_flags ?? [])]),
      privacy_note: privacyNote
    }
  ];
}

function buildChartRef(reportType: ReportType, request: ReportDraftRequest): ReportDraft["chart_ref"] {
  if (request.chart_id) {
    return {
      chart_id: sanitizeText(request.chart_id),
      snapshot_type: reportType === "single_chart" ? "chart" : reportType
    };
  }
  if (request.timeline?.chart_id) {
    return {
      chart_id: sanitizeText(request.timeline.chart_id),
      snapshot_type: "timeline"
    };
  }
  return undefined;
}

function resolveChart(chartId: string, chartSnapshot?: Chart): Chart {
  const stored = getChart(chartId);
  const chart = stored?.chart ?? chartSnapshot;
  if (!chart) {
    throw new ApiError("CHART_NOT_FOUND", "chart not found.", { field: "chart_id", status: 404 });
  }
  return chart;
}

function normalizeReportType(reportType: ReportType): ReportType {
  if (!reportTypes.includes(reportType)) {
    throw new ApiError("INVALID_REPORT_TYPE", "report_type must be single_chart, synastry, or timeline.", {
      field: "report_type"
    });
  }
  return reportType;
}

function normalizeMode(mode: InterpretationMode): InterpretationMode {
  if (!interpretationModes.includes(mode)) {
    throw new ApiError("INVALID_INTERPRETATION_MODE", "mode must be professional or entertainment.", { field: "mode" });
  }
  return mode;
}

function normalizeExportFormat(format: ReportExportFormat): ReportExportFormat {
  if (!reportExportFormats.includes(format)) {
    throw new ApiError("INVALID_EXPORT_FORMAT", "format must be html or pdf.", { field: "format" });
  }
  return format;
}

function detectSafetyFlags(text: string): string[] {
  const flags = sensitiveTopicTerms
    .filter((term) => text.includes(term))
    .map((term) => {
      if (["医疗", "健康", "心理"].includes(term)) return "consult_professional";
      if (term === "法律") return "legal_decision_guard";
      if (["投资", "财务"].includes(term)) return "financial_decision_guard";
      return "relationship_decision_guard";
    });
  return unique(flags);
}

function detectPrivacyFlags(text: string): string[] {
  const flags: string[] = [];
  if (/\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/.test(text)) flags.push("birth_date");
  if (/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/.test(text)) flags.push("birth_time");
  if (/\b(?:Shanghai|Beijing|Guangzhou|Shenzhen|Chengdu|Hangzhou|Nanjing|Wuhan)\b/i.test(text)) flags.push("location_detail");
  if (/data:image\/[a-zA-Z+.-]+;base64,[A-Za-z0-9+/=]+/.test(text)) flags.push("image_payload");
  return flags;
}

function sanitizeReportDraft(draft: ReportDraft): ReportDraft {
  return JSON.parse(sanitizeText(JSON.stringify(draft))) as ReportDraft;
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

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function createId(prefix: string): string {
  return `${prefix}_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}_${Math.random().toString(36).slice(2, 8)}`;
}
