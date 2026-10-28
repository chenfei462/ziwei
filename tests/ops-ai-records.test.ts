import { beforeEach, describe, expect, test, vi } from "vitest";
import { createChart } from "../src/chartEngine.js";
import { buildInterpretation } from "../src/phase3/interpretationEngine.js";
import { generateDeepSeekInterpretation } from "../src/phase3/deepseekClient.js";
import { createReportDraft } from "../src/phase8/reporting.js";
import { clearAiForTests, clearReportsForTests } from "../src/store.js";
import { handleApiRequest } from "../src/api.js";

const profile = {
  display_name: "后台 AI 记录",
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

describe("ops AI generation records", () => {
  beforeEach(() => {
    clearAiForTests();
    clearReportsForTests();
    vi.restoreAllMocks();
    delete process.env.DEEPSEEK_API_KEY;
  });

  test("requires content reviewer or admin auth and returns redacted generation records", async () => {
    const chart = createChart({ birth_profile: profile });
    const palace = chart.chart.palaces.find((item) => item.palace_id === "life");
    if (!palace) throw new Error("life palace missing");
    vi.spyOn(globalThis, "fetch");
    await generateDeepSeekInterpretation(
      buildInterpretation({
        chart_id: chart.chart_id,
        chart: chart.chart,
        palace,
        mode: "professional",
        include_trace: true
      })
    );

    const denied = handleApiRequest("GET", "/api/ops/ai-generations?admin_token=bad&admin_role=content_reviewer");
    const allowed = handleApiRequest(
      "GET",
      "/api/ops/ai-generations?admin_token=phase10_admin_token&admin_role=content_reviewer&actor_id=reviewer_1"
    );

    expect(denied.status).toBe(401);
    expect(allowed.status).toBe(200);
    expect(allowed.body.records).toHaveLength(1);
    expect(JSON.stringify(allowed.body)).not.toContain("2000-08-16");
    expect(JSON.stringify(allowed.body)).not.toContain("03:30");
    expect(JSON.stringify(allowed.body)).not.toContain("Shanghai");
  });

  test("lists persisted content reviews for content reviewers with status and report filters", () => {
    const chart = createChart({ birth_profile: profile });
    const draft = createReportDraft({
      report_type: "single_chart",
      chart_id: chart.chart_id,
      chart: chart.chart,
      mode: "professional"
    });

    const denied = handleApiRequest("GET", "/api/ops/content-reviews?admin_token=phase10_admin_token&admin_role=support_agent");
    const allowed = handleApiRequest(
      "GET",
      `/api/ops/content-reviews?admin_token=phase10_admin_token&admin_role=content_reviewer&status=approved&report_id=${draft.report_id}`
    );
    const allowedBody = allowed.body as {
      reviews: Array<Record<string, unknown>>;
      summary: Record<string, number>;
      privacy: Record<string, boolean>;
    };

    expect(denied.status).toBe(403);
    expect(allowed.status).toBe(200);
    expect(allowedBody.reviews).toHaveLength(1);
    expect(allowedBody.reviews[0]).toMatchObject({
      review_id: draft.review.review_id,
      report_id: draft.report_id,
      source_type: "report",
      source_id: draft.report_id,
      status: "approved"
    });
    expect(allowedBody.summary).toMatchObject({
      total: 1,
      approved: 1,
      needs_review: 0,
      blocked: 0
    });
    expect(allowedBody.privacy).toMatchObject({
      sensitive_fields_masked: true,
      raw_content_hidden: true,
      admin_required: true
    });
    expect(JSON.stringify(allowed.body)).not.toContain("2000-08-16");
    expect(JSON.stringify(allowed.body)).not.toContain("03:30");
    expect(JSON.stringify(allowed.body)).not.toContain("Shanghai");
  });
});
