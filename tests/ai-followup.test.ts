import { beforeEach, describe, expect, test, vi } from "vitest";
import { createChart } from "../src/chartEngine.js";
import { POST as createChartPost } from "../src/app/api/chart/create/route.js";
import { POST as followupPost } from "../src/app/api/ai/follow-up/route.js";
import { generateDeepSeekInterpretation, promptVersion } from "../src/phase3/deepseekClient.js";
import { buildInterpretation } from "../src/phase3/interpretationEngine.js";
import { productRepository } from "../src/repositories/productRepository.js";
import { clearAiForTests, clearChartsForTests, listAiGenerationRecords } from "../src/store.js";

const birthProfile = {
  display_name: "追问测试用户",
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

describe("AI generation records and follow-up quota", () => {
  beforeEach(() => {
    clearAiForTests();
    clearChartsForTests();
    delete process.env.DEEPSEEK_API_KEY;
    vi.restoreAllMocks();
  });

  async function createOwnedChart(visitorId: string) {
    const response = await createChartPost(
      new Request("http://local/api/chart/create", {
        method: "POST",
        headers: { "x-visitor-id": visitorId },
        body: JSON.stringify({ birth_profile: birthProfile })
      })
    );
    expect(response.status).toBe(201);
    return (await response.json()) as ReturnType<typeof createChart>;
  }

  test("records prompt version, status, fallback reason, and input digest for DeepSeek attempts", async () => {
    const chart = createChart({ birth_profile: birthProfile });
    vi.spyOn(globalThis, "fetch");
    const palace = chart.chart.palaces.find((item) => item.palace_id === "life");
    if (!palace) throw new Error("life palace missing");
    const base = buildInterpretation({
      chart_id: chart.chart_id,
      chart: chart.chart,
      palace,
      mode: "professional",
      include_trace: true
    });

    const generated = await generateDeepSeekInterpretation(base);
    const records = listAiGenerationRecords();

    expect(generated.generation).toMatchObject({
      provider: "deepseek",
      model: "deepseek-v4-flash",
      status: "fallback",
      reason: "missing_api_key",
      prompt_version: promptVersion
    });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      provider: "deepseek",
      model: "deepseek-v4-flash",
      prompt_version: promptVersion,
      chart_id: chart.chart_id,
      status: "fallback",
      fallback_reason: "missing_api_key"
    });
    expect(records[0].input_digest).toMatch(/^sha256:/);
    expect(JSON.stringify(records[0])).not.toContain("2000-08-16");
    expect(JSON.stringify(records[0])).not.toContain("03:30");
    expect(JSON.stringify(records[0])).not.toContain("Shanghai");
  });

  test("answers follow-up questions only from chart trace and enforces free-user quota", async () => {
    const chart = await createOwnedChart("visitor_followup_free");

    for (let index = 0; index < 3; index += 1) {
      const response = await followupPost(
        new Request("http://local/api/ai/follow-up", {
          method: "POST",
          headers: { "x-visitor-id": "visitor_followup_free" },
          body: JSON.stringify({
            chart_id: chart.chart_id,
            topic: "career",
            question: "我适合观察什么样的工作节奏？"
          })
        })
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.answer).toContain("依据");
      expect(payload.answer).toContain("仅供结构参考");
      expect(payload.trace.length).toBeGreaterThan(0);
      expect(payload.quota.remaining).toBe(2 - index);
    }

    const limitedResponse = await followupPost(
      new Request("http://local/api/ai/follow-up", {
        method: "POST",
        headers: { "x-visitor-id": "visitor_followup_free" },
        body: JSON.stringify({
          chart_id: chart.chart_id,
          topic: "career",
          question: "再多讲一点"
        })
      })
    );
    const limited = await limitedResponse.json();

    expect(limitedResponse.status).toBe(429);
    expect(limited.error.code).toBe("FOLLOW_UP_QUOTA_EXCEEDED");
  });

  test("loads charts through the async repository boundary for production adapters", async () => {
    const chart = createChart({ birth_profile: birthProfile });
    clearChartsForTests();
    const getChartSpy = vi.spyOn(productRepository, "getChartAsync").mockResolvedValue(chart);
    vi.spyOn(productRepository, "getChartOwnerAsync").mockResolvedValue({
      chart_id: chart.chart_id,
      visitor_id: "visitor_followup_repository",
      created_at: new Date().toISOString()
    });

    const response = await followupPost(
      new Request("http://local/api/ai/follow-up", {
        method: "POST",
        headers: { "x-visitor-id": "visitor_followup_repository" },
        body: JSON.stringify({
          chart_id: chart.chart_id,
          topic: "self_growth",
          question: "我最近适合观察什么自我成长节奏？"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(getChartSpy).toHaveBeenCalledWith(chart.chart_id);
    expect(payload.answer).toContain("依据");
    expect(payload.generation.privacy_note).not.toContain("2000-08-16");
  });

  test("rejects follow-up questions for charts owned by another visitor", async () => {
    const createResponse = await createChartPost(
      new Request("http://local/api/chart/create", {
        method: "POST",
        headers: { "x-visitor-id": "visitor_followup_owner" },
        body: JSON.stringify({ birth_profile: birthProfile })
      })
    );
    const chart = await createResponse.json();

    const response = await followupPost(
      new Request("http://local/api/ai/follow-up", {
        method: "POST",
        headers: { "x-visitor-id": "visitor_followup_stranger" },
        body: JSON.stringify({
          chart_id: chart.chart_id,
          topic: "relationship",
          question: "我可以怎么看关系互动？"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error.code).toBe("CHART_ACCESS_FORBIDDEN");
    expect(JSON.stringify(payload)).not.toContain("2000-08-16");
    expect(JSON.stringify(listAiGenerationRecords())).not.toContain("我可以怎么看关系互动");
  });

  test("blocks high-risk follow-up questions instead of generating advice", async () => {
    const chart = await createOwnedChart("visitor_followup_risk");
    const response = await followupPost(
      new Request("http://local/api/ai/follow-up", {
        method: "POST",
        headers: { "x-visitor-id": "visitor_followup_risk" },
        body: JSON.stringify({
          chart_id: chart.chart_id,
          topic: "finance",
          question: "我明天必须投资哪只股票才能发财？"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error.code).toBe("CONTENT_REVIEW_BLOCKED");
    expect(JSON.stringify(listAiGenerationRecords())).not.toContain("哪只股票");
  });
});
