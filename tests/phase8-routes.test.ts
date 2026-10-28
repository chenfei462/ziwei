import { describe, expect, test } from "vitest";
import { POST as createChartPost } from "../src/app/api/chart/create/route.js";
import { POST as reportDraftPost } from "../src/app/api/report/draft/route.js";
import { GET as exportPreviewGet, POST as exportPreviewPost } from "../src/app/api/report/export-preview/route.js";
import { GET as reportGet } from "../src/app/api/report/[id]/route.js";
import { GET as reportShareGet } from "../src/app/api/report/[id]/share/route.js";

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
    const ownerCookie = chartResponse.headers.get("set-cookie") ?? "";

    const draftResponse = await reportDraftPost(
      new Request("http://local/api/report/draft", {
        method: "POST",
        headers: { cookie: ownerCookie },
        body: JSON.stringify({
          report_type: "single_chart",
          chart_id: chart.chart_id,
          chart: chart.chart,
          mode: "professional"
        })
      })
    );
    const draft = await draftResponse.json();

    const readResponse = await reportGet(new Request(`http://local/api/report/${draft.report_id}`, { headers: { cookie: ownerCookie } }), {
      params: Promise.resolve({ id: draft.report_id })
    });
    const read = await readResponse.json();

    const previewResponse = await exportPreviewPost(
      new Request("http://local/api/report/export-preview", {
        method: "POST",
        headers: { cookie: ownerCookie },
        body: JSON.stringify({
          report_id: draft.report_id,
          format: "html"
        })
      })
    );
    const preview = await previewResponse.json();

    expect(draftResponse.status).toBe(201);
    expect(draft.sections).toHaveLength(6);
    expect(readResponse.status).toBe(403);
    expect(read.error).toMatchObject({ code: "REPORT_ACCESS_FORBIDDEN" });
    expect(previewResponse.status).toBe(403);
    expect(preview.error).toMatchObject({ code: "REPORT_ACCESS_FORBIDDEN" });
    expect(JSON.stringify({ draft, read, preview })).not.toContain("2000-08-16");
    expect(JSON.stringify({ draft, read, preview })).not.toContain("03:30");
    expect(JSON.stringify({ draft, read, preview })).not.toContain("Shanghai");
  });

  test("exports by GET and creates a redacted public report share only for the report owner", async () => {
    const chartResponse = await createChartPost(
      new Request("http://local/api/chart/create", {
        method: "POST",
        headers: { "x-visitor-id": "visitor_report_export_owner" },
        body: JSON.stringify(chartBody)
      })
    );
    const chart = await chartResponse.json();
    const draftResponse = await reportDraftPost(
      new Request("http://local/api/report/draft", {
        method: "POST",
        headers: { "x-visitor-id": "visitor_report_export_owner" },
        body: JSON.stringify({
          report_type: "single_chart",
          chart_id: chart.chart_id,
          chart: chart.chart,
          mode: "professional"
        })
      })
    );
    const draft = await draftResponse.json();

    const ownerExportResponse = await exportPreviewGet(
      new Request(`http://local/api/report/export-preview?report_id=${draft.report_id}&format=html`, {
        headers: { "x-visitor-id": "visitor_report_export_owner" }
      })
    );
    const ownerExport = await ownerExportResponse.json();
    const strangerExportResponse = await exportPreviewGet(
      new Request(`http://local/api/report/export-preview?report_id=${draft.report_id}&format=html`, {
        headers: { "x-visitor-id": "visitor_report_export_stranger" }
      })
    );
    const strangerExport = await strangerExportResponse.json();
    const shareResponse = await reportShareGet(
      new Request(`http://local/api/report/${draft.report_id}/share`, {
        headers: { "x-visitor-id": "visitor_report_export_owner" }
      }),
      { params: Promise.resolve({ id: draft.report_id }) }
    );
    const share = await shareResponse.json();

    expect(ownerExportResponse.status).toBe(403);
    expect(ownerExport.error).toMatchObject({ code: "REPORT_ACCESS_FORBIDDEN" });
    expect(strangerExportResponse.status).toBe(403);
    expect(strangerExport.error).toMatchObject({ code: "REPORT_ACCESS_FORBIDDEN" });
    expect(shareResponse.status).toBe(201);
    expect(share.snapshot.source_type).toBe("report_summary");
    expect(share.snapshot.source_id).toBe(draft.report_id);
    expect(share.snapshot.summary).toBe(draft.share_summary.summary);
    expect(share.snapshot.keywords).toEqual(expect.arrayContaining([`v${draft.report_version}`]));
    expect(share.share_url).toBe(`/share/${share.snapshot.share_id}`);
    expect(JSON.stringify({ ownerExport, strangerExport, share })).not.toContain("2000-08-16");
    expect(JSON.stringify({ ownerExport, strangerExport, share })).not.toContain("03:30");
    expect(JSON.stringify({ ownerExport, strangerExport, share })).not.toContain("Shanghai");
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

  test("requires full report entitlement for private detail while owners can create redacted summary shares", async () => {
    const chartResponse = await createChartPost(
      new Request("http://local/api/chart/create", {
        method: "POST",
        headers: { "x-visitor-id": "visitor_report_owner" },
        body: JSON.stringify(chartBody)
      })
    );
    const chart = await chartResponse.json();
    const draftResponse = await reportDraftPost(
      new Request("http://local/api/report/draft", {
        method: "POST",
        headers: { "x-visitor-id": "visitor_report_owner" },
        body: JSON.stringify({
          report_type: "single_chart",
          chart_id: chart.chart_id,
          chart: chart.chart,
          mode: "professional"
        })
      })
    );
    const draft = await draftResponse.json();

    const strangerResponse = await reportGet(
      new Request(`http://local/api/report/${draft.report_id}`, { headers: { "x-visitor-id": "visitor_report_stranger" } }),
      { params: Promise.resolve({ id: draft.report_id }) }
    );
    const stranger = await strangerResponse.json();
    const ownerResponse = await reportGet(
      new Request(`http://local/api/report/${draft.report_id}`, { headers: { "x-visitor-id": "visitor_report_owner" } }),
      { params: Promise.resolve({ id: draft.report_id }) }
    );
    const ownerShareResponse = await reportShareGet(
      new Request(`http://local/api/report/${draft.report_id}/share`, { headers: { "x-visitor-id": "visitor_report_owner" } }),
      { params: Promise.resolve({ id: draft.report_id }) }
    );
    const ownerShare = await ownerShareResponse.json();

    expect(strangerResponse.status).toBe(403);
    expect(stranger.error).toMatchObject({ code: "REPORT_ACCESS_FORBIDDEN", field: "report_id" });
    expect(JSON.stringify(stranger)).not.toContain("2000-08-16");
    expect(JSON.stringify(stranger)).not.toContain("03:30");
    expect(JSON.stringify(stranger)).not.toContain("Shanghai");
    expect(ownerResponse.status).toBe(403);
    expect(ownerShareResponse.status).toBe(201);
    expect(ownerShare.snapshot.summary).toBe(draft.share_summary.summary);
  });

  test("binds report draft creation to the current chart owner", async () => {
    const chartResponse = await createChartPost(
      new Request("http://local/api/chart/create", {
        method: "POST",
        headers: { "x-visitor-id": "visitor_report_draft_owner" },
        body: JSON.stringify(chartBody)
      })
    );
    const chart = await chartResponse.json();

    const strangerDraftResponse = await reportDraftPost(
      new Request("http://local/api/report/draft", {
        method: "POST",
        headers: { "x-visitor-id": "visitor_report_draft_stranger" },
        body: JSON.stringify({
          report_type: "single_chart",
          chart_id: chart.chart_id,
          chart: chart.chart,
          mode: "professional"
        })
      })
    );
    const strangerDraft = await strangerDraftResponse.json();
    const ownerDraftResponse = await reportDraftPost(
      new Request("http://local/api/report/draft", {
        method: "POST",
        headers: { "x-visitor-id": "visitor_report_draft_owner" },
        body: JSON.stringify({
          report_type: "single_chart",
          chart_id: chart.chart_id,
          chart: chart.chart,
          mode: "professional"
        })
      })
    );
    const ownerDraft = await ownerDraftResponse.json();

    expect(strangerDraftResponse.status).toBe(403);
    expect(strangerDraft.error).toMatchObject({ code: "CHART_ACCESS_FORBIDDEN", field: "chart_id" });
    expect(JSON.stringify(strangerDraft)).not.toContain("2000-08-16");
    expect(JSON.stringify(strangerDraft)).not.toContain("03:30");
    expect(JSON.stringify(strangerDraft)).not.toContain("Shanghai");
    expect(ownerDraftResponse.status).toBe(201);
    expect(ownerDraft.chart_ref.chart_id).toBe(chart.chart_id);
  });
});
