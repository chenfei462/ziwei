import { describe, expect, test } from "vitest";
import { createChart } from "../src/chartEngine.js";
import { createSynastry, interpretTimeline } from "../src/phase7/synastryTimeline.js";
import { createExportPreview, createReportDraft, getReportDraft, reviewReportContent } from "../src/phase8/reporting.js";

const primaryBirthProfile = {
  display_name: "阶段8甲方",
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

const partnerBirthProfile = {
  display_name: "阶段8乙方",
  calendar_type: "gregorian" as const,
  birth_date: "1998-11-02",
  birth_time: "22:45",
  timezone: "Asia/Shanghai",
  location: {
    name: "Beijing",
    longitude: 116.4074,
    latitude: 39.9042
  },
  is_leap_month: false,
  true_solar_time_enabled: false,
  gender_rule: "traditional_female" as const
};

describe("phase 8 report composer and creator assets", () => {
  test("creates a single-chart report draft with six palace sections, trace, creator assets, and privacy defaults", () => {
    const chart = createChart({ birth_profile: primaryBirthProfile });

    const draft = createReportDraft({
      report_type: "single_chart",
      chart_id: chart.chart_id,
      chart: chart.chart,
      mode: "professional"
    });

    expect(draft.report_id).toMatch(/^report_/);
    expect(draft.report_type).toBe("single_chart");
    expect(draft.template_version).toBe("v0.1");
    expect(draft.sections).toHaveLength(6);
    expect(draft.sections[0]).toMatchObject({
      basis: expect.stringContaining("依据"),
      trace: expect.any(Array),
      safety_flags: expect.arrayContaining(["avoid_absolute_prediction"])
    });
    expect(draft.creator_assets.map((asset) => asset.asset_type)).toEqual(
      expect.arrayContaining(["live_outline", "short_video_script", "palace_card"])
    );
    expect(draft.review.status).toBe("approved");
    expect(draft.privacy_note).toContain("full birth date");
    expect(JSON.stringify(draft)).not.toContain("2000-08-16");
    expect(JSON.stringify(draft)).not.toContain("03:30");
    expect(JSON.stringify(draft)).not.toContain("Shanghai");
  });

  test("composes synastry and timeline snapshots into report templates without creating payment orders", () => {
    const primary = createChart({ birth_profile: primaryBirthProfile });
    const partner = createChart({ birth_profile: partnerBirthProfile });
    const synastry = createSynastry({
      mode: "entertainment",
      primary: {
        label: "甲方",
        chart_id: primary.chart_id,
        chart: primary.chart,
        consent: { agreed: true, no_sensitive_birth_data: true }
      },
      partner: {
        label: "乙方",
        chart_id: partner.chart_id,
        chart: partner.chart,
        consent: { agreed: true, no_sensitive_birth_data: true }
      }
    });
    const timeline = interpretTimeline({
      chart_id: primary.chart_id,
      chart: primary.chart,
      year: 2027,
      month: 5,
      mode: "entertainment",
      palace_id: "career"
    });

    const synastryDraft = createReportDraft({
      report_type: "synastry",
      mode: "entertainment",
      synastry
    });
    const timelineDraft = createReportDraft({
      report_type: "timeline",
      mode: "entertainment",
      chart_id: primary.chart_id,
      timeline
    });
    const preview = createExportPreview({
      report_id: timelineDraft.report_id,
      format: "pdf"
    });

    expect(synastryDraft.sections[0].title).toContain("合盘");
    expect(synastryDraft.creator_assets.map((asset) => asset.asset_type)).toContain("synastry_card");
    expect(timelineDraft.sections[0].title).toContain("年度");
    expect(timelineDraft.creator_assets.map((asset) => asset.asset_type)).toContain("timeline_card");
    expect(preview.format).toBe("pdf");
    expect(preview.order_created).toBe(false);
    expect(preview.payment_status).toBe("preview_only");
    expect(getReportDraft(timelineDraft.report_id)?.report_id).toBe(timelineDraft.report_id);
  });

  test("blocks export review when hard prediction or sensitive private data is present", () => {
    const review = reviewReportContent(
      "这份报告一定会带来破产，并包含 2000-08-16 03:30 Shanghai 作为公开资料。",
      "report_manual"
    );

    expect(review.status).toBe("blocked");
    expect(review.blocked_terms).toEqual(expect.arrayContaining(["一定", "破产"]));
    expect(review.privacy_flags).toEqual(expect.arrayContaining(["birth_date", "birth_time", "location_detail"]));
  });
});
