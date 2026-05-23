import { describe, expect, test } from "vitest";
import { createChart } from "../src/index.js";
import { buildConfidenceLevel, loadInterpretationRules, matchInterpretationRules, reviewInterpretationSafety } from "../src/phase3/ruleMatcher.js";

const birthProfile = {
  display_name: "规则测试用户",
  calendar_type: "gregorian" as const,
  birth_date: "2000-08-16",
  birth_time: "03:30",
  timezone: "Asia/Shanghai",
  location: {
    name: "上海",
    longitude: 121.4737,
    latitude: 31.2304
  },
  is_leap_month: false,
  true_solar_time_enabled: false,
  gender_rule: "traditional_female" as const
};

describe("phase 3 interpretation rules", () => {
  test("loads rules from the phase 3 data file and matches palace, star, transform, and relation conditions", () => {
    const chart = createChart({ birth_profile: birthProfile });
    const rules = loadInterpretationRules();
    const matches = matchInterpretationRules({
      chart: chart.chart,
      palace_id: "wealth",
      rules
    });

    expect(rules.length).toBeGreaterThanOrEqual(12);
    expect(matches.map((match) => match.rule.rule_id)).toEqual(expect.arrayContaining(["phase3_palace_wealth_theme", "phase3_transform_hua_quan"]));
    expect(matches.some((match) => match.matched_conditions.some((condition) => condition.type === "relation"))).toBe(true);
  });

  test("derives confidence from rule weights without single-star overstatement", () => {
    expect(buildConfidenceLevel([{ weight: 45 }, { weight: 35 }, { weight: 15 }])).toBe("strong_structure");
    expect(buildConfidenceLevel([{ weight: 40 }, { weight: 20 }])).toBe("medium_structure");
    expect(buildConfidenceLevel([{ weight: 25 }])).toBe("weak_structure");
  });

  test("downgrades absolute, fear-based, and major-decision language", () => {
    const result = reviewInterpretationSafety("你一定会破产，必须立刻投资，否则婚姻必然失败。", ["finance_sensitive"]);

    expect(result.flags).toEqual(expect.arrayContaining(["absolute_prediction_blocked", "fear_language_blocked", "sensitive_decision_guard", "consult_professional"]));
    expect(result.text).not.toMatch(/一定|必然|破产|必须/);
    expect(result.text).toContain("仅供");
  });
});
