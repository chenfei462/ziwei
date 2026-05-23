import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  Chart,
  ConfidenceLevel,
  InterpretationRule,
  Palace,
  RuleCondition,
  RuleMatch,
  SafetyReviewResult,
  TransformType
} from "../types.js";

const rulesPath = resolve(process.cwd(), "data/phase3/interpretation-rules-v0.1.json");

let cachedRules: InterpretationRule[] | undefined;

export const mvpInterpretationPalaceIds = ["life", "career", "wealth", "spouse", "fortune", "migration"] as const;

export function isMvpInterpretationPalace(palaceId: string): boolean {
  return (mvpInterpretationPalaceIds as readonly string[]).includes(palaceId);
}

export function loadInterpretationRules(): InterpretationRule[] {
  if (!cachedRules) {
    cachedRules = JSON.parse(readFileSync(rulesPath, "utf8")) as InterpretationRule[];
  }
  return cachedRules;
}

export function matchInterpretationRules(input: { chart: Chart; palace_id: string; rules?: InterpretationRule[] }): RuleMatch[] {
  const palace = input.chart.palaces.find((item) => item.palace_id === input.palace_id);
  if (!palace) return [];

  const rules = input.rules ?? loadInterpretationRules();
  return rules
    .filter((rule) => rule.palace_ids.includes(input.palace_id))
    .map((rule) => {
      const matchedConditions = rule.conditions.filter((condition) => matchesCondition(condition, palace, input.chart));
      return {
        rule,
        matched_conditions: matchedConditions,
        weight: rule.weight
      };
    })
    .filter((match) => match.matched_conditions.length === match.rule.conditions.length)
    .sort((a, b) => b.weight - a.weight || a.rule.rule_id.localeCompare(b.rule.rule_id));
}

export function buildConfidenceLevel(matches: Array<{ weight: number }>): ConfidenceLevel {
  const totalWeight = matches.reduce((total, match) => total + match.weight, 0);
  if (totalWeight >= 90) return "strong_structure";
  if (totalWeight >= 55) return "medium_structure";
  return "weak_structure";
}

export function reviewInterpretationSafety(text: string, initialFlags: string[] = []): SafetyReviewResult {
  const flags = new Set(initialFlags);
  const blockedTerms: string[] = [];
  let reviewed = text;

  const absoluteTerms = ["一定", "必然", "注定", "肯定"];
  if (absoluteTerms.some((term) => reviewed.includes(term))) {
    flags.add("absolute_prediction_blocked");
    for (const term of absoluteTerms) {
      if (reviewed.includes(term)) blockedTerms.push(term);
      reviewed = reviewed.replaceAll(term, "倾向于");
    }
  }

  const fearTerms = ["灾祸", "死亡", "破产", "离婚", "绝症"];
  if (fearTerms.some((term) => reviewed.includes(term))) {
    flags.add("fear_language_blocked");
    for (const term of fearTerms) {
      if (reviewed.includes(term)) blockedTerms.push(term);
      reviewed = reviewed.replaceAll(term, "高风险事项");
    }
  }

  const decisionTerms = ["必须", "立刻", "马上"];
  if (decisionTerms.some((term) => reviewed.includes(term))) {
    flags.add("sensitive_decision_guard");
    for (const term of decisionTerms) {
      if (reviewed.includes(term)) blockedTerms.push(term);
      reviewed = reviewed.replaceAll(term, "建议先评估后再");
    }
  }

  if (initialFlags.some((flag) => ["finance_sensitive", "legal_sensitive", "relationship_decision_guard", "wellbeing_sensitive", "major_decision_guard"].includes(flag))) {
    flags.add("sensitive_decision_guard");
    flags.add("consult_professional");
  }

  if (!reviewed.includes("仅供")) {
    reviewed = `${reviewed} 仅供结构参考，不作为医疗、法律、投资或婚姻重大决策依据。`;
  }

  return {
    text: reviewed,
    flags: [...flags],
    blocked_terms: [...new Set(blockedTerms)]
  };
}

function matchesCondition(condition: RuleCondition, palace: Palace, chart: Chart): boolean {
  switch (condition.type) {
    case "palace":
      return palace.palace_id === condition.value;
    case "main_star":
      return palace.main_stars.includes(condition.value);
    case "support_star":
      return palace.support_stars.includes(condition.value);
    case "transform":
      return hasTransform(palace, condition.value);
    case "relation":
      return matchesRelationCondition(condition, palace, chart);
    default: {
      const _exhaustive: never = condition;
      return _exhaustive;
    }
  }
}

function hasTransform(palace: Palace, transform: TransformType): boolean {
  return palace.transforms.includes(transform);
}

function matchesRelationCondition(condition: Extract<RuleCondition, { type: "relation" }>, palace: Palace, chart: Chart): boolean {
  const relatedIds = getRelatedPalaceIds(condition.relation, palace);
  const targetMatches = condition.target_palace_ids ? condition.target_palace_ids.some((targetId) => relatedIds.includes(targetId) || palace.palace_id === targetId) : true;
  if (!targetMatches) return false;

  const targetTransform = condition.target_has_transform;
  if (!targetTransform) return true;
  return relatedIds
    .map((palaceId) => chart.palaces.find((item) => item.palace_id === palaceId))
    .filter((item): item is Palace => Boolean(item))
    .some((relatedPalace) => relatedPalace.transforms.includes(targetTransform));
}

function getRelatedPalaceIds(relation: "opposite" | "triad" | "neighbor", palace: Palace): string[] {
  if (relation === "opposite") return [palace.relation_refs.opposite];
  if (relation === "triad") return palace.relation_refs.triad;
  return palace.relation_refs.neighbors;
}
