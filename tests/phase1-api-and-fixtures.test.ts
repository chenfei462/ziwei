import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { handleApiRequest } from "../src/index.js";

type ChartResponseBody = {
  chart_id: string;
  chart: {
    palaces: Array<{ palace_id: string }>;
  };
};

const validCreateBody = {
  birth_profile: {
    display_name: "API测试用户",
    calendar_type: "gregorian",
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
    gender_rule: "traditional_female"
  },
  rule_config: {
    school_id: "default_ziwei_v0_1",
    zi_hour_day_boundary: "civil_midnight",
    leap_month_policy: "same_month_number"
  }
};

describe("phase 1 API and fixture deliverables", () => {
  test("POST /api/chart/create creates a chart and GET /api/chart/{id} reads it", () => {
    const created = handleApiRequest("POST", "/api/chart/create", validCreateBody);
    const createdBody = created.body as unknown as ChartResponseBody;

    expect(created.status).toBe(201);
    expect(createdBody.chart_id).toMatch(/^chart_/);
    expect(createdBody.chart.palaces).toHaveLength(12);

    const fetched = handleApiRequest("GET", `/api/chart/${createdBody.chart_id}`);
    const fetchedBody = fetched.body as unknown as ChartResponseBody;
    expect(fetched.status).toBe(200);
    expect(fetchedBody.chart_id).toBe(createdBody.chart_id);
  });

  test("POST /api/interpret returns phase-3 structured text instead of free-form text", () => {
    const created = handleApiRequest("POST", "/api/chart/create", validCreateBody);
    const createdBody = created.body as unknown as ChartResponseBody;

    const interpreted = handleApiRequest("POST", "/api/interpret", {
      chart_id: createdBody.chart_id,
      palace_id: "wealth",
      mode: "entertainment",
      include_trace: true
    });

    expect(interpreted.status).toBe(200);
    expect(interpreted.body.status).toBe("ready");
    expect(interpreted.body.interpretation).toMatchObject({
      confidence: expect.any(String),
      safety_flags: expect.arrayContaining(["avoid_absolute_prediction"])
    });
  });

  test("API validation errors use the frozen error envelope", () => {
    const response = handleApiRequest("POST", "/api/chart/create", {
      birth_profile: {
        ...validCreateBody.birth_profile,
        birth_time: "99:99"
      }
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
      code: "INVALID_BIRTH_TIME",
      field: "birth_time"
    });
  });

  test("phase 1 fixture file contains 100 cases across required scenario types", () => {
    const csv = readFileSync(resolve("data/phase1/test-charts-v0.1.csv"), "utf8");
    const lines = csv.trim().split(/\r?\n/);
    const body = lines.slice(1);

    expect(body).toHaveLength(100);
    for (const scenario of [
      "ordinary_gregorian",
      "lunar_input",
      "zi_hour_boundary",
      "timezone_case",
      "true_solar_time_probe",
      "gender_rule_case"
    ]) {
      expect(csv).toContain(`,${scenario},`);
    }
    expect(csv).toContain("seed_needs_consultant");
  });
});
