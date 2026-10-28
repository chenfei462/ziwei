import { createChart } from "../chartEngine.js";
import { ApiError } from "../errors.js";
import { getDefaultRuleProfileId, getRuleProfileRecord, listRuleProfileRecords } from "./ruleProfileData.js";
import {
  knowledgeNodeTypes,
  type CommercialPrivacy,
  type KnowledgeEdge,
  type KnowledgeNode,
  type KnowledgeNodeDetail,
  type KnowledgeSearchRequest,
  type KnowledgeSearchResponse,
  type KnowledgeSearchResult,
  type RuleCompareRequest,
  type RuleCompareResponse,
  type RuleConfig,
  type RuleDiff,
  type RuleProfile,
  type RuleProfileListResponse
} from "../types.js";

const privacy: CommercialPrivacy = {
  stores_full_birth_date: false,
  stores_birth_time: false,
  stores_location_detail: false,
  stores_video_frame: false
};

const defaultSource = {
  title: "Zi Wei Dou Shu Quan Shu",
  excerpt: "short classical source excerpt",
  modern_translation: "Use classical passages as traceable context, not as absolute prediction."
};

const knowledgeNodes: KnowledgeNode[] = [
  node("star_zi_wei", "star", "Zi Wei", "Major star anchor for central structure and leadership themes.", ["major_star", "fourteen_main_stars"]),
  node("star_tian_ji", "star", "Tian Ji", "Major star for planning, movement, and adaptive reasoning.", ["major_star", "fourteen_main_stars"]),
  node("star_tai_yang", "star", "Tai Yang", "Major star for visibility, responsibility, and outward expression.", ["major_star", "fourteen_main_stars"]),
  node("star_wu_qu", "star", "Wu Qu", "Major star for resource management and execution.", ["major_star", "finance_guard"]),
  node("star_tian_tong", "star", "Tian Tong", "Major star for ease, emotion, and restoration.", ["major_star"]),
  node("star_lian_zhen", "star", "Lian Zhen", "Major star for boundaries, standards, and pressure management.", ["major_star"]),
  node("star_tian_fu", "star", "Tian Fu", "Major star for storage, allocation, and stewardship.", ["major_star"]),
  node("star_tai_yin", "star", "Tai Yin", "Major star for reflection, support, and inner resources.", ["major_star"]),
  node("star_tan_lang", "star", "Tan Lang", "Major star for desire, social pull, and exploration.", ["major_star"]),
  node("star_ju_men", "star", "Ju Men", "Major star for speech, friction, and verification.", ["major_star"]),
  node("star_tian_xiang", "star", "Tian Xiang", "Major star for coordination and service roles.", ["major_star"]),
  node("star_tian_liang", "star", "Tian Liang", "Major star for protection, seniority, and principles.", ["major_star"]),
  node("star_qi_sha", "star", "Qi Sha", "Major star for decisive action and high-pressure change.", ["major_star"]),
  node("star_po_jun", "star", "Po Jun", "Major star for breaking patterns and rebuilding.", ["major_star"]),
  node("palace_life", "palace", "Life Palace", "Core self-positioning and chart entry point.", ["palace", "mvp_six"]),
  node("palace_career", "palace", "Career Palace", "Work, responsibilities, and organizational position.", ["palace", "mvp_six"]),
  node("palace_wealth", "palace", "Wealth Palace", "Resource allocation and money-related observation.", ["palace", "mvp_six", "finance_guard"]),
  node("palace_spouse", "palace", "Spouse Palace", "Relationship interaction and communication boundary.", ["palace", "mvp_six", "relationship_guard"]),
  node("palace_fortune", "palace", "Fortune Palace", "Recovery, inner stability, and emotional bandwidth.", ["palace", "mvp_six"]),
  node("palace_migration", "palace", "Migration Palace", "External environment, mobility, and collaboration.", ["palace", "mvp_six"]),
  node("transform_lu", "transform", "Hua Lu", "Resource and attraction marker.", ["four_transform"]),
  node("transform_quan", "transform", "Hua Quan", "Action, authority, and pressure marker.", ["four_transform"]),
  node("transform_ke", "transform", "Hua Ke", "Reputation, documentation, and learning marker.", ["four_transform"]),
  node("transform_ji", "transform", "Hua Ji", "Constraint, friction, and care-needed marker.", ["four_transform"]),
  node("pattern_sanfang_sizheng", "pattern", "San Fang Si Zheng", "Core relation structure linking self, opposite, and triad contexts.", ["pattern", "trace_structure"]),
  node("rule_mvp_six_palaces", "rule", "MVP Six Palace Interpretation", "Phase 3 rule coverage for life, career, wealth, spouse, fortune, and migration.", ["rule_usage:interpretation"]),
  node("source_doushu_quanshu", "source", "Zi Wei Dou Shu Quan Shu", "Public-domain classical source metadata with short excerpts only.", ["source"]),
  node("source_gusui_fu", "source", "Dou Shu Gu Sui Fu", "Classical principle source for multi-factor synthesis.", ["source"]),
  node("theme_no_absolute_prediction", "theme", "No Absolute Prediction", "Safety rule requiring symbolic and advisory wording.", ["content_safety"])
];

const knowledgeEdges: KnowledgeEdge[] = [
  edge("edge_ziwei_rule", "star_zi_wei", "rule_mvp_six_palaces", "appears_in_rule", ["phase11_star_ziwei_basis"], 90, "Zi Wei can appear as a basis node in palace interpretation."),
  edge("edge_ziwei_source", "star_zi_wei", "source_doushu_quanshu", "derived_from", ["source_trace"], 80, "Major star source trace."),
  edge("edge_rule_source", "rule_mvp_six_palaces", "source_gusui_fu", "derived_from", ["phase3_l1_l7"], 82, "Six-palace interpretation follows multi-factor synthesis."),
  edge("edge_rule_safety", "rule_mvp_six_palaces", "theme_no_absolute_prediction", "supports_trace", ["content_safety"], 100, "All interpretations avoid hard prediction."),
  edge("edge_life_rule", "palace_life", "rule_mvp_six_palaces", "appears_in_rule", ["phase3_life"], 88, "Life palace is part of MVP six-palace coverage."),
  edge("edge_career_rule", "palace_career", "rule_mvp_six_palaces", "appears_in_rule", ["phase3_career"], 86, "Career palace is part of MVP six-palace coverage."),
  edge("edge_wealth_rule", "palace_wealth", "rule_mvp_six_palaces", "appears_in_rule", ["phase3_wealth"], 86, "Wealth palace includes financial decision guardrails."),
  edge("edge_spouse_rule", "palace_spouse", "rule_mvp_six_palaces", "appears_in_rule", ["phase3_spouse"], 86, "Spouse palace includes relationship decision guardrails."),
  edge("edge_transform_lu_rule", "transform_lu", "rule_mvp_six_palaces", "modifies", ["phase3_transform"], 76, "Hua Lu modifies interpretation as a resource marker."),
  edge("edge_pattern_rule", "pattern_sanfang_sizheng", "rule_mvp_six_palaces", "maps_to", ["phase3_relation"], 92, "Relation structure maps to basis and trace display.")
];

const hardTerms = ["必然", "死亡", "破产", "离婚", "灾祸"];

export function listRuleProfiles(): RuleProfileListResponse {
  return {
    profiles: listRuleProfileRecords(),
    default_profile_id: getDefaultRuleProfileId()
  };
}

export function getRuleProfile(profileId: string): RuleProfile {
  return getRuleProfileRecord(profileId);
}

export function compareRuleProfiles(request: RuleCompareRequest): RuleCompareResponse {
  const baseProfile = getRuleProfileRecord(request.base_rule_profile_id);
  const candidateProfile = getRuleProfileRecord(request.candidate_rule_profile_id);
  const sanitizedBirthProfile = sanitizeBirthProfile(request.birth_profile);
  const base = createChart({
    birth_profile: sanitizedBirthProfile,
    rule_profile_id: baseProfile.profile_id
  });
  const candidate = createChart({
    birth_profile: sanitizedBirthProfile,
    rule_profile_id: candidateProfile.profile_id
  });

  return {
    base_profile: baseProfile,
    candidate_profile: candidateProfile,
    base_chart: {
      chart_id: base.chart_id,
      rule_profile_id: base.rule_profile_id,
      rule_version: base.rule_version,
      palace_count: base.chart.palaces.length,
      transform_count: base.chart.transforms.length
    },
    candidate_chart: {
      chart_id: candidate.chart_id,
      rule_profile_id: candidate.rule_profile_id,
      rule_version: candidate.rule_version,
      palace_count: candidate.chart.palaces.length,
      transform_count: candidate.chart.transforms.length
    },
    diffs: diffRuleConfig(baseProfile.rule_config, candidateProfile.rule_config, candidateProfile),
    privacy
  };
}

export function searchKnowledge(request: KnowledgeSearchRequest = {}): KnowledgeSearchResponse {
  const query = sanitizeText(request.query ?? "");
  const limit = normalizeLimit(request.limit);
  const nodeType = request.node_type;
  if (nodeType && !knowledgeNodeTypes.includes(nodeType)) {
    throw new ApiError("INVALID_KNOWLEDGE_NODE_TYPE", "knowledge node type is invalid.", { field: "node_type" });
  }

  const results = knowledgeNodes
    .filter((item) => (nodeType ? item.node_type === nodeType : true))
    .map((item) => scoreNode(item, query, request))
    .filter((item) => item.score > 0 || !query)
    .sort((left, right) => right.score - left.score || left.node.label.localeCompare(right.node.label))
    .slice(0, limit);

  return {
    query,
    results,
    privacy
  };
}

export function getKnowledgeNode(nodeId: string): KnowledgeNodeDetail {
  const node = knowledgeNodes.find((item) => item.node_id === nodeId);
  if (!node) {
    throw new ApiError("KNOWLEDGE_NODE_NOT_FOUND", "knowledge node not found.", { field: "node_id", status: 404 });
  }
  const edges = knowledgeEdges.filter((item) => item.from_node_id === node.node_id || item.to_node_id === node.node_id);
  const relatedIds = edges.map((item) => (item.from_node_id === node.node_id ? item.to_node_id : item.from_node_id));
  return {
    node,
    edges,
    related_nodes: knowledgeNodes.filter((item) => relatedIds.includes(item.node_id)),
    privacy
  };
}

function diffRuleConfig(base: RuleConfig, candidate: RuleConfig, candidateProfile: RuleProfile): RuleDiff[] {
  const fields: Array<keyof RuleConfig> = [
    "school_id",
    "zi_hour_day_boundary",
    "leap_month_policy",
    "true_solar_time_policy",
    "four_transform_policy",
    "interpretation_style"
  ];
  return fields
    .filter((field) => String(base[field] ?? "") !== String(candidate[field] ?? ""))
    .map((field) => ({
      field,
      base_value: String(base[field] ?? ""),
      candidate_value: String(candidate[field] ?? ""),
      reason: reasonForDiff(field),
      impact: impactForDiff(field),
      requires_consultant_review: candidateProfile.consultant_review_status !== "confirmed"
    }));
}

function reasonForDiff(field: keyof RuleConfig): string {
  const reasons: Record<string, string> = {
    school_id: "Candidate profile marks a different configurable lineage for audit and comparison.",
    zi_hour_day_boundary: "Candidate treats late zi hour as next-day observation instead of civil midnight.",
    leap_month_policy: "Candidate treats leap month as a split-month observation instead of the same month number.",
    true_solar_time_policy: "Candidate allows true solar time observation but keeps it off unless explicitly chosen.",
    four_transform_policy: "Candidate reserves an alternate four-transform mapping for consultant review.",
    interpretation_style: "Candidate favors source-first copy while retaining safety language."
  };
  return reasons[field] ?? "Rule profile value differs.";
}

function impactForDiff(field: keyof RuleConfig): string {
  const impacts: Record<string, string> = {
    school_id: "profile audit",
    zi_hour_day_boundary: "time normalization",
    leap_month_policy: "calendar normalization",
    true_solar_time_policy: "birth-time calibration",
    four_transform_policy: "transform mapping",
    interpretation_style: "copy and trace display"
  };
  return impacts[field] ?? "rule configuration";
}

function scoreNode(node: KnowledgeNode, query: string, request: KnowledgeSearchRequest): KnowledgeSearchResult {
  const searchTerms = tokenizeKnowledgeQuery(query);
  const hasSearchTerms = searchTerms.length > 0;
  const ruleUsage = request.rule_usage ? sanitizeText(request.rule_usage) : undefined;
  const matchedFields: string[] = [];
  let score = 0;
  if (!query || !hasSearchTerms) {
    score = 1;
    matchedFields.push("all");
  }
  if (hasSearchTerms && includesSearchTerm(node.label, searchTerms)) {
    matchedFields.push("label");
    score += 100;
  }
  if (hasSearchTerms && includesSearchTerm(node.summary, searchTerms)) {
    matchedFields.push("summary");
    score += 50;
  }
  if (hasSearchTerms && node.tags.some((tag) => includesSearchTerm(tag, searchTerms))) {
    matchedFields.push("tags");
    score += 35;
  }
  if (request.source_title && node.source.title.toLowerCase().includes(sanitizeText(request.source_title).toLowerCase())) {
    matchedFields.push("source");
    score += 25;
  }
  if (ruleUsage && node.tags.some((tag) => tag.includes(`rule_usage:${ruleUsage}`))) {
    matchedFields.push("rule_usage");
    score += 25;
  }
  return {
    node,
    matched_fields: [...new Set(matchedFields)],
    score
  };
}

function tokenizeKnowledgeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !token.includes("_redacted]"));
}

function includesSearchTerm(value: string, terms: string[]): boolean {
  const lowered = value.toLowerCase();
  return terms.some((term) => lowered.includes(term));
}

function sanitizeBirthProfile(profile: RuleCompareRequest["birth_profile"]): RuleCompareRequest["birth_profile"] {
  return {
    ...profile,
    display_name: sanitizeText(profile.display_name ?? "Phase 11 comparison"),
    location: profile.location
      ? {
          longitude: profile.location.longitude,
          latitude: profile.location.latitude,
          name: sanitizeText(profile.location.name ?? "")
        }
      : undefined
  };
}

function normalizeLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit ?? 0) || !limit) return 12;
  return Math.min(50, Math.max(1, Math.trunc(limit)));
}

function node(node_id: string, node_type: KnowledgeNode["node_type"], label: string, summary: string, tags: string[]): KnowledgeNode {
  return {
    node_id,
    node_type,
    label,
    summary: sanitizeKnowledgeText(summary),
    tags,
    source: defaultSource,
    safety_flags: ["avoid_absolute_prediction", ...(tags.includes("finance_guard") ? ["financial_decision_guard"] : []), ...(tags.includes("relationship_guard") ? ["relationship_decision_guard"] : [])]
  };
}

function edge(
  edge_id: string,
  from_node_id: string,
  to_node_id: string,
  relation: KnowledgeEdge["relation"],
  rule_ids: string[],
  weight: number,
  note: string
): KnowledgeEdge {
  return {
    edge_id,
    from_node_id,
    to_node_id,
    relation,
    rule_ids,
    weight,
    note: sanitizeKnowledgeText(note)
  };
}

function sanitizeKnowledgeText(text: string): string {
  const sanitized = sanitizeText(text);
  for (const term of ["必然", "死亡", "破产", "离婚", "灾祸"]) {
    if (sanitized.includes(term)) {
      throw new ApiError("KNOWLEDGE_SAFETY_VIOLATION", "knowledge text contains blocked hard-prediction language.", { field: "knowledge" });
    }
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
