import { describe, expect, test } from "vitest";
import { createChart } from "../src/chartEngine.js";
import {
  compareRuleProfiles,
  getKnowledgeNode,
  getRuleProfile,
  listRuleProfiles,
  searchKnowledge
} from "../src/phase11/ruleKnowledge.js";

const birthProfile = {
  display_name: "Phase 11 profile",
  calendar_type: "gregorian" as const,
  birth_date: "2000-08-16",
  birth_time: "03:30",
  timezone: "Asia/Shanghai",
  location: {
    name: "Shanghai",
    longitude: 121.4737,
    latitude: 31.2304
  },
  is_leap_month: false,
  true_solar_time_enabled: false,
  gender_rule: "traditional_male" as const
};

describe("phase 11 rule profiles and knowledge graph", () => {
  test("lists default and experimental rule profiles and binds rule version to new charts", () => {
    const profiles = listRuleProfiles();
    const defaultProfile = getRuleProfile("default_ziwei_v0_1");
    const chart = createChart({ birth_profile: birthProfile, rule_profile_id: defaultProfile.profile_id });

    expect(profiles.profiles.map((profile) => profile.profile_id)).toContain("default_ziwei_v0_1");
    expect(profiles.profiles.map((profile) => profile.profile_id)).toContain("experimental_sanhe_v0_1");
    expect(defaultProfile.version.version_id).toBe("rules_v0.2");
    expect(defaultProfile.consultant_review_status).toBe("confirmed");
    expect(chart.rule_profile_id).toBe("default_ziwei_v0_1");
    expect(chart.rule_version).toBe("rules_v0.2");
    expect(JSON.stringify(profiles)).not.toContain("2000-08-16");
    expect(JSON.stringify(profiles)).not.toContain("03:30");
    expect(JSON.stringify(profiles)).not.toContain("Shanghai");
  });

  test("compares default and candidate rules without promoting experimental profiles to default", () => {
    const comparison = compareRuleProfiles({
      birth_profile: birthProfile,
      base_rule_profile_id: "default_ziwei_v0_1",
      candidate_rule_profile_id: "experimental_sanhe_v0_1"
    });

    expect(comparison.base_profile.profile_id).toBe("default_ziwei_v0_1");
    expect(comparison.candidate_profile.profile_id).toBe("experimental_sanhe_v0_1");
    expect(comparison.candidate_profile.consultant_review_status).toBe("experimental");
    expect(comparison.diffs.map((diff) => diff.field)).toContain("leap_month_policy");
    expect(comparison.diffs.map((diff) => diff.field)).toContain("zi_hour_day_boundary");
    expect(comparison.base_chart.rule_profile_id).toBe("default_ziwei_v0_1");
    expect(comparison.candidate_chart.rule_profile_id).toBe("experimental_sanhe_v0_1");
    expect(comparison.privacy.stores_full_birth_date).toBe(false);
    expect(JSON.stringify(comparison)).not.toContain("2000-08-16");
    expect(JSON.stringify(comparison)).not.toContain("03:30");
    expect(JSON.stringify(comparison)).not.toContain("Shanghai");
  });

  test("searches knowledge nodes and returns source-traced graph neighbors", () => {
    const search = searchKnowledge({
      query: "Zi Wei 2000-08-16 03:30 Shanghai",
      node_type: "star",
      limit: 5
    });
    const node = getKnowledgeNode("star_zi_wei");

    expect(search.results[0]?.node.node_id).toBe("star_zi_wei");
    expect(search.results[0]?.matched_fields).toContain("label");
    expect(search.query).toBe("Zi Wei [birth_date_redacted] [birth_time_redacted] [location_redacted]");
    expect(node.node.label).toBe("Zi Wei");
    expect(node.edges.some((edge) => edge.relation === "appears_in_rule")).toBe(true);
    expect(node.related_nodes.some((related) => related.node_type === "source")).toBe(true);
    expect(JSON.stringify({ search, node })).not.toMatch(/必然|死亡|破产|离婚/);
  });

  test("rejects unknown rule profiles and knowledge nodes with typed errors", () => {
    expect(() => getRuleProfile("unknown_profile")).toThrow(/rule profile not found/i);
    expect(() => getKnowledgeNode("unknown_node")).toThrow(/knowledge node not found/i);
  });
});
