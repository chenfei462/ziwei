import { describe, expect, test } from "vitest";
import { createChart, handleApiRequest, interpret } from "../src/index.js";

const baseBirthProfile = {
  display_name: "阶段3测试用户",
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
  gender_rule: "traditional_male" as const
};

const mvpPalaceIds = ["life", "career", "wealth", "spouse", "fortune", "migration"] as const;

describe("phase 3 interpretation engine", () => {
  test("returns formal professional interpretations for the six MVP palaces", () => {
    const chart = createChart({ birth_profile: baseBirthProfile });

    for (const palaceId of mvpPalaceIds) {
      const response = interpret({
        chart_id: chart.chart_id,
        palace_id: palaceId,
        mode: "professional",
        include_trace: true
      });

      expect(response.status).toBe("ready");
      expect(response.interpretation.basis).toContain("依据");
      expect(response.interpretation.interpretation).not.toMatch(/一定|必然|灾祸|死亡|破产|离婚|绝症/);
      expect(response.interpretation.safety_flags).toContain("avoid_absolute_prediction");
      expect(response.trace.length).toBeGreaterThan(0);
      expect(response.trace[0]).toMatchObject({
        rule_id: expect.stringMatching(/^phase3_/),
        palace_id: palaceId,
        confidence: expect.any(String),
        source: {
          title: expect.any(String),
          excerpt: expect.any(String),
          modern_translation: expect.any(String)
        }
      });
    }
  });

  test("keeps non-MVP palaces explicit and unopened", () => {
    const chart = createChart({ birth_profile: baseBirthProfile });

    const response = interpret({
      chart_id: chart.chart_id,
      palace_id: "health",
      mode: "entertainment",
      include_trace: true
    });

    expect(response.status).toBe("not_open");
    expect(response.interpretation.basis).toContain("暂未开放");
    expect(response.interpretation.safety_flags).toContain("not_open_for_mvp");
    expect(response.trace).toEqual([]);
  });

  test("uses the same matched rules with different professional and entertainment copy", () => {
    const chart = createChart({ birth_profile: baseBirthProfile });

    const professional = interpret({
      chart_id: chart.chart_id,
      palace_id: "life",
      mode: "professional",
      include_trace: true
    });
    const entertainment = interpret({
      chart_id: chart.chart_id,
      palace_id: "life",
      mode: "entertainment",
      include_trace: true
    });

    expect(professional.status).toBe("ready");
    expect(entertainment.status).toBe("ready");
    expect(professional.trace.map((item) => item.rule_id)).toEqual(entertainment.trace.map((item) => item.rule_id));
    expect(professional.interpretation.interpretation).not.toBe(entertainment.interpretation.interpretation);
  });

  test("preserves the existing API error envelope for invalid chart and palace ids", () => {
    const chart = createChart({ birth_profile: baseBirthProfile });

    const missingChart = handleApiRequest("POST", "/api/interpret", {
      chart_id: "chart_missing",
      palace_id: "life",
      mode: "professional"
    });
    const missingPalace = handleApiRequest("POST", "/api/interpret", {
      chart_id: chart.chart_id,
      palace_id: "unknown",
      mode: "professional"
    });

    expect(missingChart.status).toBe(404);
    expect(missingChart.body.error).toMatchObject({ code: "CHART_NOT_FOUND", field: "chart_id" });
    expect(missingPalace.status).toBe(404);
    expect(missingPalace.body.error).toMatchObject({ code: "PALACE_NOT_FOUND", field: "palace_id" });
  });
});
