import { describe, expect, test } from "vitest";
import {
  createChart,
  getChart,
  interpret,
  normalizeBirthProfile,
  timeIndexFromBirthTime
} from "../src/index.js";

const baseBirthProfile = {
  display_name: "阶段1测试用户",
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

describe("phase 1 chart engine", () => {
  test("maps birth time to Zi Wei time indexes at the stage-0 boundaries", () => {
    expect(timeIndexFromBirthTime("22:59")).toBe(11);
    expect(timeIndexFromBirthTime("23:00")).toBe(12);
    expect(timeIndexFromBirthTime("23:59")).toBe(12);
    expect(timeIndexFromBirthTime("00:00")).toBe(0);
    expect(timeIndexFromBirthTime("00:59")).toBe(0);
    expect(timeIndexFromBirthTime("01:00")).toBe(1);
  });

  test("normalizes a solar birth profile without leaking private fields by default", () => {
    const normalized = normalizeBirthProfile(baseBirthProfile);

    expect(normalized.calendar_type).toBe("gregorian");
    expect(normalized.solar_date).toBe("2000-8-16");
    expect(normalized.local_time).toBe("03:30");
    expect(normalized.time_index).toBe(2);
    expect(normalized.true_solar_time_applied).toBe(false);
  });

  test("creates a structured chart with twelve palaces, stars, transforms, major periods, and trace records", () => {
    const response = createChart({
      birth_profile: baseBirthProfile,
      rule_config: {
        school_id: "default_ziwei_v0_1",
        zi_hour_day_boundary: "civil_midnight",
        leap_month_policy: "same_month_number"
      }
    });

    expect(response.chart_id).toMatch(/^chart_/);
    expect(response.chart.palaces).toHaveLength(12);
    expect(response.chart.stars.length).toBeGreaterThanOrEqual(14);
    expect(response.chart.transforms).toHaveLength(4);
    expect(response.chart.major_periods).toHaveLength(12);
    expect(response.chart.palaces[0]).toMatchObject({
      palace_id: expect.any(String),
      name: expect.any(String),
      branch: expect.any(String),
      relation_refs: {
        opposite: expect.any(String),
        triad: expect.any(Array),
        neighbors: expect.any(Array)
      }
    });
    expect(response.privacy).toEqual({
      share_birth_date: false,
      share_birth_time: false,
      share_location: false
    });
    expect(response.trace.map((item) => item.step)).toEqual(
      expect.arrayContaining([
        "normalize_birth",
        "calculate_astrolabe",
        "map_palaces",
        "map_stars",
        "map_transforms",
        "map_major_periods"
      ])
    );

    const stored = getChart(response.chart_id);
    expect(stored?.chart_id).toBe(response.chart_id);
  });

  test("creates a lunar chart through the same public contract", () => {
    const response = createChart({
      birth_profile: {
        ...baseBirthProfile,
        calendar_type: "lunar",
        birth_date: "2000-07-17",
        is_leap_month: false
      },
      rule_config: {
        school_id: "default_ziwei_v0_1",
        zi_hour_day_boundary: "civil_midnight",
        leap_month_policy: "same_month_number"
      }
    });

    expect(response.normalized_birth.calendar_type).toBe("lunar");
    expect(response.chart.palaces).toHaveLength(12);
    expect(response.chart.stars.length).toBeGreaterThanOrEqual(14);
  });

  test("rejects invalid input with the frozen API error shape", () => {
    let thrown: unknown;
    try {
      createChart({
        birth_profile: {
          ...baseBirthProfile,
          timezone: "",
          birth_time: "25:99"
        },
        rule_config: {
          school_id: "default_ziwei_v0_1",
          zi_hour_day_boundary: "civil_midnight",
          leap_month_policy: "same_month_number"
        }
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      code: "REQUIRED_TIMEZONE",
      field: "timezone"
    });
  });

  test("returns a structured phase-3 interpretation for MVP palaces", () => {
    const chart = createChart({ birth_profile: baseBirthProfile });
    const response = interpret({
      chart_id: chart.chart_id,
      palace_id: "life",
      mode: "professional",
      include_trace: true
    });

    expect(response.status).toBe("ready");
    expect(response.interpretation.safety_flags).toContain("avoid_absolute_prediction");
    expect(response.trace.length).toBeGreaterThan(0);
  });
});
