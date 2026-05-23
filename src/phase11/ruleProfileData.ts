import { ApiError } from "../errors.js";
import type { RuleProfile } from "../types.js";

export const defaultRuleProfileId = "default_ziwei_v0_1";

const ruleProfiles: RuleProfile[] = [
  {
    profile_id: defaultRuleProfileId,
    label: "Default Zi Wei v0.1",
    description: "Frozen baseline used by phase 0-10 charting, interpretation, reports, commerce, and launch operations.",
    version: {
      version_id: "rules_v0.2",
      label: "Rule table v0.2",
      released_at: "2026-04-30",
      source: "phase 0-10 baseline"
    },
    rule_config: {
      school_id: "default_ziwei_v0_1",
      zi_hour_day_boundary: "civil_midnight",
      leap_month_policy: "same_month_number",
      true_solar_time_policy: "disabled",
      four_transform_policy: "default_stem",
      interpretation_style: "balanced_modern"
    },
    consultant_review_status: "confirmed",
    is_default: true,
    risk_note: "Default profile remains the production baseline and consultant-confirmed comparison anchor.",
    supported_features: ["chart", "interpretation", "report", "synastry", "timeline", "commerce"],
    safety_flags: ["avoid_absolute_prediction", "privacy_redaction_required"]
  },
  {
    profile_id: "experimental_sanhe_v0_1",
    label: "Experimental Sanhe v0.1",
    description: "Candidate profile for rule comparison only; it highlights alternate zi-hour and leap-month assumptions.",
    version: {
      version_id: "rules_v0.2-exp",
      label: "Experimental comparison profile",
      released_at: "2026-04-30",
      source: "phase 11 candidate"
    },
    rule_config: {
      school_id: "experimental_sanhe_v0_1",
      zi_hour_day_boundary: "late_zi_next_day",
      leap_month_policy: "split_leap_month",
      true_solar_time_policy: "optional",
      four_transform_policy: "experimental_stem_variant",
      interpretation_style: "classical_source_first"
    },
    consultant_review_status: "experimental",
    is_default: false,
    risk_note: "Candidate profile cannot become the default until consultant golden samples are approved.",
    supported_features: ["chart_compare", "knowledge_trace"],
    safety_flags: ["consultant_review_required", "avoid_absolute_prediction"]
  }
];

export function listRuleProfileRecords(): RuleProfile[] {
  return ruleProfiles.map(cloneRuleProfile);
}

export function getRuleProfileRecord(profileId: string | undefined): RuleProfile {
  const normalizedId = profileId || defaultRuleProfileId;
  const profile = ruleProfiles.find((item) => item.profile_id === normalizedId);
  if (!profile) {
    throw new ApiError("RULE_PROFILE_NOT_FOUND", "rule profile not found.", { field: "rule_profile_id", status: 404 });
  }
  return cloneRuleProfile(profile);
}

function cloneRuleProfile(profile: RuleProfile): RuleProfile {
  return JSON.parse(JSON.stringify(profile)) as RuleProfile;
}
