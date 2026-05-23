import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  Chart,
  ConfidenceLevel,
  InterpretationMode,
  InterpretationTrace,
  InterpretResponse,
  Palace,
  RuleMatch
} from "../types.js";
import { buildConfidenceLevel, isMvpInterpretationPalace, matchInterpretationRules, reviewInterpretationSafety } from "./ruleMatcher.js";

type CopyTemplates = {
  professional: {
    prefix: string;
    advice_suffix: string;
  };
  entertainment: {
    prefix: string;
    advice_suffix: string;
  };
  safety: {
    default_notice: string;
  };
};

const templatesPath = resolve(process.cwd(), "data/phase3/copy-templates-v0.1.json");
let cachedTemplates: CopyTemplates | undefined;

export function buildInterpretation(input: {
  chart_id: string;
  chart: Chart;
  palace: Palace;
  mode: InterpretationMode;
  include_trace?: boolean;
  major_period_id?: string;
}): InterpretResponse {
  if (!isMvpInterpretationPalace(input.palace.palace_id)) {
    return buildNotOpenResponse(input.chart_id, input.palace, input.mode);
  }

  const matches = matchInterpretationRules({
    chart: input.chart,
    palace_id: input.palace.palace_id
  });
  const confidence = buildConfidenceLevel(matches);
  const selectedMatches = matches.slice(0, 5);
  const templates = loadCopyTemplates();
  const modeTemplate = templates[input.mode];
  const safetyFlags = unique(["avoid_absolute_prediction", ...selectedMatches.flatMap((match) => match.rule.safety_flags)]);

  const basis = buildBasis(input.palace, selectedMatches);
  const interpretationText = `${modeTemplate.prefix} ${selectedMatches
    .map((match) => (input.mode === "professional" ? match.rule.professional_text : match.rule.entertainment_text))
    .join(" ")}`;
  const scenarioText = unique(selectedMatches.map((match) => match.rule.scenario)).join(" ");
  const adviceText = `${unique(selectedMatches.map((match) => match.rule.advice)).join(" ")} ${modeTemplate.advice_suffix}`;
  const reviewedInterpretation = reviewInterpretationSafety(interpretationText, safetyFlags);
  const reviewedAdvice = reviewInterpretationSafety(adviceText, reviewedInterpretation.flags);

  return {
    chart_id: input.chart_id,
    palace_id: input.palace.palace_id,
    mode: input.mode,
    status: "ready",
    interpretation: {
      basis,
      interpretation: reviewedInterpretation.text,
      scenario: scenarioText || "此宫位当前仅返回结构主题，等待顾问补充更多规则。",
      advice: reviewedAdvice.text,
      confidence,
      safety_flags: unique([...reviewedInterpretation.flags, ...reviewedAdvice.flags])
    },
    trace: input.include_trace ? buildTrace(input.palace.palace_id, selectedMatches, confidence) : []
  };
}

function buildNotOpenResponse(chartId: string, palace: Palace, mode: InterpretationMode): InterpretResponse {
  return {
    chart_id: chartId,
    palace_id: palace.palace_id,
    mode,
    status: "not_open",
    interpretation: {
      basis: `${palace.name}暂未开放深度解读；阶段 3 MVP 只覆盖命宫、官禄、财帛、夫妻、福德、迁移六宫。`,
      interpretation: "当前仅保留排盘结构展示，不输出正式命理判断。",
      scenario: "可继续查看本宫星曜、四化、三方四正和大限结构。",
      advice: "等待顾问补齐规则后再开放深度解读。仅供结构参考，不作为医疗、法律、投资或婚姻重大决策依据。",
      confidence: "weak_structure",
      safety_flags: ["not_open_for_mvp", "avoid_absolute_prediction"]
    },
    trace: []
  };
}

function loadCopyTemplates(): CopyTemplates {
  if (!cachedTemplates) {
    cachedTemplates = JSON.parse(readFileSync(templatesPath, "utf8")) as CopyTemplates;
  }
  return cachedTemplates;
}

function buildBasis(palace: Palace, matches: RuleMatch[]): string {
  const layers = unique(matches.map((match) => layerLabel(match.rule.layer)));
  const stars = palace.main_stars.length ? palace.main_stars.join("、") : "无主星";
  const transforms = palace.transforms.length ? palace.transforms.join("、") : "无四化";
  return `依据：${palace.name}主题、主星 ${stars}、四化 ${transforms}，触发 ${matches.length} 条规则（${layers.join("、") || "基础主题"}）。`;
}

function buildTrace(palaceId: string, matches: RuleMatch[], confidence: ConfidenceLevel): InterpretationTrace[] {
  return matches.map((match) => ({
    rule_id: match.rule.rule_id,
    palace_id: palaceId,
    layer: match.rule.layer,
    weight: match.rule.weight,
    confidence,
    matched_conditions: match.matched_conditions,
    source: match.rule.source,
    safety_flags: match.rule.safety_flags
  }));
}

function layerLabel(layer: RuleMatch["rule"]["layer"]): string {
  const labels: Record<RuleMatch["rule"]["layer"], string> = {
    palace_theme: "宫位主题",
    star_symbol: "星曜象义",
    strength_modifier: "强弱修正",
    relation: "三方四正",
    pattern: "格局识别",
    major_period: "大限叠加",
    copy_generation: "文案生成"
  };
  return labels[layer];
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}
