import { afterEach, describe, expect, test, vi } from "vitest";
import { createChart } from "../src/chartEngine.js";
import { POST as interpretPost } from "../src/app/api/interpret/route.js";

const birthProfile = {
  display_name: "DeepSeek route user",
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

function interpretRequest(chartId: string) {
  return new Request("http://local/api/interpret", {
    method: "POST",
    body: JSON.stringify({
      chart_id: chartId,
      palace_id: "life",
      mode: "professional",
      include_trace: true
    })
  });
}

describe("phase 3 DeepSeek interpretation route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.DEEPSEEK_API_KEY;
  });

  test("calls deepseek-v4-flash and returns generated interpretation copy", async () => {
    process.env.DEEPSEEK_API_KEY = "test_deepseek_key";
    const chart = createChart({ birth_profile: birthProfile });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                interpretation: "模型生成的命宫结构解读，强调观察与自我理解。",
                scenario: "适合用于复盘近期节奏和表达方式。",
                advice: "建议先记录感受，再结合现实条件做温和调整。"
              })
            }
          }
        ]
      })
    } as Response);

    const response = await interpretPost(interpretRequest(chart.chart_id));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.deepseek.com/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer test_deepseek_key",
          "content-type": "application/json"
        }),
        body: expect.any(String)
      })
    );
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(requestBody).toMatchObject({
      model: "deepseek-v4-flash",
      stream: false
    });
    expect(payload.interpretation.interpretation).toContain("模型生成的命宫结构解读");
    expect(payload.generation).toMatchObject({
      provider: "deepseek",
      model: "deepseek-v4-flash",
      status: "generated"
    });
    expect(JSON.stringify(requestBody)).not.toContain("2000-08-16");
    expect(JSON.stringify(requestBody)).not.toContain("03:30");
    expect(JSON.stringify(requestBody)).not.toContain("Shanghai");
  });

  test("falls back to rule copy when the api key is missing", async () => {
    const chart = createChart({ birth_profile: birthProfile });
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const response = await interpretPost(interpretRequest(chart.chart_id));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(payload.status).toBe("ready");
    expect(payload.generation).toMatchObject({
      provider: "deepseek",
      model: "deepseek-v4-flash",
      status: "fallback",
      reason: "missing_api_key"
    });
  });

  test("falls back to rule copy when DeepSeek returns invalid JSON", async () => {
    process.env.DEEPSEEK_API_KEY = "test_deepseek_key";
    const chart = createChart({ birth_profile: birthProfile });
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "not json" } }]
      })
    } as Response);

    const response = await interpretPost(interpretRequest(chart.chart_id));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBe("ready");
    expect(payload.generation).toMatchObject({
      provider: "deepseek",
      model: "deepseek-v4-flash",
      status: "fallback",
      reason: "invalid_model_json"
    });
  });
});
