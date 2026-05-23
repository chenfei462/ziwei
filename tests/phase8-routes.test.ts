import { describe, expect, test } from "vitest";
import { POST as createChartPost } from "../src/app/api/chart/create/route.js";
import { POST as reportDraftPost } from "../src/app/api/report/draft/route.js";
import { POST as exportPreviewPost } from "../src/app/api/report/export-preview/route.js";
import { GET as reportGet } from "../src/app/api/report/[id]/route.js";

const chartBody = {
  birth_profile: {
    display_name: "Phase 8 route user",
    calendar_type: "gregorian",
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
    gender_rule: "traditional_male"
  }
};

describe("phase 8 report route handlers", () => {
  test("create, read, and export preview a sanitized report draft", async () => {
    const chartResponse = await createChartPost(
      new Request("http://local/api/chart/create", {
        method: "POST",
        body: JSON.stringify(chartBody)
      })
    );
    const chart = await chartResponse.json();

    const draftResponse = await reportDraftPost(
      new Request("http://local/api/report/draft", {
        method: "POST",
        body: JSON.stringify({
          report_type: "single_chart",
          chart_id: chart.chart_id,
          chart: chart.chart,
          mode: "professional"
        })
      })
    );
    const draft = await draftResponse.json();

    const readResponse = await reportGet(new Request(`http://local/api/report/${draft.report_id}`), {
      params: Promise.resolve({ id: draft.report_id })
    });
    const read = await readResponse.json();

    const previewResponse = await exportPreviewPost(
      new Request("http://local/api/report/export-preview", {
        method: "POST",
        body: JSON.stringify({
          report_id: draft.report_id,
          format: "html"
        })
      })
    );
    const preview = await previewResponse.json();

    expect(draftResponse.status).toBe(201);
    expect(draft.sections).toHaveLength(6);
    expect(readResponse.status).toBe(200);
    expect(read.report_id).toBe(draft.report_id);
    expect(previewResponse.status).toBe(201);
    expect(preview.preview_url).toContain(`/report/${draft.report_id}`);
    expect(preview.order_created).toBe(false);
    expect(JSON.stringify({ draft, read, preview })).not.toContain("2000-08-16");
    expect(JSON.stringify({ draft, read, preview })).not.toContain("03:30");
    expect(JSON.stringify({ draft, read, preview })).not.toContain("Shanghai");
  });

  test("returns shared error envelopes for invalid report type and blocked export review", async () => {
    const invalidDraftResponse = await reportDraftPost(
      new Request("http://local/api/report/draft", {
        method: "POST",
        body: JSON.stringify({
          report_type: "unknown",
          chart_id: "missing",
          mode: "professional"
        })
      })
    );
    const invalidDraft = await invalidDraftResponse.json();

    const blockedPreviewResponse = await exportPreviewPost(
      new Request("http://local/api/report/export-preview", {
        method: "POST",
        body: JSON.stringify({
          report_id: "missing",
          format: "pdf"
        })
      })
    );
    const blockedPreview = await blockedPreviewResponse.json();

    expect(invalidDraftResponse.status).toBe(400);
    expect(invalidDraft.error).toMatchObject({ code: "INVALID_REPORT_TYPE", field: "report_type" });
    expect(blockedPreviewResponse.status).toBe(404);
    expect(blockedPreview.error).toMatchObject({ code: "REPORT_NOT_FOUND", field: "report_id" });
  });
});
