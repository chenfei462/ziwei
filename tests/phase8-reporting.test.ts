import { afterEach, describe, expect, test, vi } from "vitest";
import { createChart } from "../src/chartEngine.js";
import { createSynastry, interpretTimeline } from "../src/phase7/synastryTimeline.js";
import {
  createExportPreview,
  createReportDraft,
  createReportGenerationJob,
  getReportDraft,
  resolveExportStorageReadiness,
  retryReportGenerationJob,
  reviewReportContent
} from "../src/phase8/reporting.js";
import { promptVersion } from "../src/phase3/deepseekClient.js";
import { productRepository } from "../src/repositories/productRepository.js";
import { clearLaunchOpsForTests, clearReportsForTests } from "../src/store.js";

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
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("fails closed for export preview when production object storage is required but not configured", () => {
    const previousRequired = process.env.ZIWEI_EXPORT_STORAGE_REQUIRED;
    const previousEndpoint = process.env.ZIWEI_EXPORT_STORAGE_ENDPOINT;
    const previousBucket = process.env.ZIWEI_EXPORT_STORAGE_BUCKET;
    const previousAccessKey = process.env.ZIWEI_EXPORT_STORAGE_ACCESS_KEY_ID;
    const previousSecret = process.env.ZIWEI_EXPORT_STORAGE_SECRET_ACCESS_KEY;
    const previousPublicBase = process.env.ZIWEI_EXPORT_STORAGE_PUBLIC_BASE_URL;
    process.env.ZIWEI_EXPORT_STORAGE_REQUIRED = "true";
    delete process.env.ZIWEI_EXPORT_STORAGE_ENDPOINT;
    delete process.env.ZIWEI_EXPORT_STORAGE_BUCKET;
    delete process.env.ZIWEI_EXPORT_STORAGE_ACCESS_KEY_ID;
    delete process.env.ZIWEI_EXPORT_STORAGE_SECRET_ACCESS_KEY;
    delete process.env.ZIWEI_EXPORT_STORAGE_PUBLIC_BASE_URL;
    try {
      const chart = createChart({ birth_profile: primaryBirthProfile });
      const draft = createReportDraft({
        report_type: "single_chart",
        chart_id: chart.chart_id,
        chart: chart.chart,
        mode: "professional"
      });

      expect(resolveExportStorageReadiness()).toMatchObject({
        provider: "local_preview",
        ready: false,
        production_required: true,
        requiredEnv: [
          "ZIWEI_EXPORT_STORAGE_ENDPOINT",
          "ZIWEI_EXPORT_STORAGE_BUCKET",
          "ZIWEI_EXPORT_STORAGE_ACCESS_KEY_ID",
          "ZIWEI_EXPORT_STORAGE_SECRET_ACCESS_KEY",
          "ZIWEI_EXPORT_STORAGE_PUBLIC_BASE_URL"
        ]
      });
      expect(() => createExportPreview({ report_id: draft.report_id, format: "pdf" })).toThrow(/object storage/i);
    } finally {
      restoreEnv("ZIWEI_EXPORT_STORAGE_REQUIRED", previousRequired);
      restoreEnv("ZIWEI_EXPORT_STORAGE_ENDPOINT", previousEndpoint);
      restoreEnv("ZIWEI_EXPORT_STORAGE_BUCKET", previousBucket);
      restoreEnv("ZIWEI_EXPORT_STORAGE_ACCESS_KEY_ID", previousAccessKey);
      restoreEnv("ZIWEI_EXPORT_STORAGE_SECRET_ACCESS_KEY", previousSecret);
      restoreEnv("ZIWEI_EXPORT_STORAGE_PUBLIC_BASE_URL", previousPublicBase);
    }
  });

  test("persists export previews through the product repository boundary", () => {
    const saveExportPreviewSpy = vi.spyOn(productRepository, "saveExportPreview");
    const chart = createChart({ birth_profile: primaryBirthProfile });
    const draft = createReportDraft({
      report_type: "single_chart",
      chart_id: chart.chart_id,
      chart: chart.chart,
      mode: "professional"
    });

    createExportPreview({ report_id: draft.report_id, format: "html" });

    expect(saveExportPreviewSpy).toHaveBeenCalledTimes(1);
  });

  test("creates object-storage export metadata with redacted hashed keys when configured", () => {
    const previousRequired = process.env.ZIWEI_EXPORT_STORAGE_REQUIRED;
    const previousEndpoint = process.env.ZIWEI_EXPORT_STORAGE_ENDPOINT;
    const previousBucket = process.env.ZIWEI_EXPORT_STORAGE_BUCKET;
    const previousAccessKey = process.env.ZIWEI_EXPORT_STORAGE_ACCESS_KEY_ID;
    const previousSecret = process.env.ZIWEI_EXPORT_STORAGE_SECRET_ACCESS_KEY;
    const previousPublicBase = process.env.ZIWEI_EXPORT_STORAGE_PUBLIC_BASE_URL;
    process.env.ZIWEI_EXPORT_STORAGE_REQUIRED = "true";
    process.env.ZIWEI_EXPORT_STORAGE_ENDPOINT = "https://oss-cn-shanghai.example";
    process.env.ZIWEI_EXPORT_STORAGE_BUCKET = "ziwei-private-export";
    process.env.ZIWEI_EXPORT_STORAGE_ACCESS_KEY_ID = "access_key";
    process.env.ZIWEI_EXPORT_STORAGE_SECRET_ACCESS_KEY = "secret_key";
    process.env.ZIWEI_EXPORT_STORAGE_PUBLIC_BASE_URL = "https://cdn.example/export";
    try {
      const chart = createChart({ birth_profile: primaryBirthProfile });
      const draft = createReportDraft({
        report_type: "single_chart",
        chart_id: chart.chart_id,
        chart: chart.chart,
        mode: "professional"
      });
      const preview = createExportPreview({ report_id: draft.report_id, format: "pdf" });

      expect(resolveExportStorageReadiness()).toMatchObject({
        provider: "s3_compatible",
        ready: true,
        production_required: true
      });
      expect(preview.preview_url).toMatch(/^https:\/\/cdn\.example\/export\/reports\/pdf\/[a-f0-9]{64}\.pdf$/);
      expect(preview.storage).toMatchObject({
        provider: "s3_compatible",
        bucket: "ziwei-private-export",
        content_type: "application/pdf",
        private_acl: true,
        signed_url_required: true
      });
      expect(preview.storage?.object_key).toMatch(/^reports\/pdf\/[a-f0-9]{64}\.pdf$/);
      expect(preview.preview_url).not.toContain(draft.report_id);
      expect(preview.storage?.object_key).not.toContain(draft.report_id);
      expect(JSON.stringify(preview)).not.toContain("2000-08-16");
      expect(JSON.stringify(preview)).not.toContain("03:30");
      expect(JSON.stringify(preview)).not.toContain("Shanghai");
    } finally {
      restoreEnv("ZIWEI_EXPORT_STORAGE_REQUIRED", previousRequired);
      restoreEnv("ZIWEI_EXPORT_STORAGE_ENDPOINT", previousEndpoint);
      restoreEnv("ZIWEI_EXPORT_STORAGE_BUCKET", previousBucket);
      restoreEnv("ZIWEI_EXPORT_STORAGE_ACCESS_KEY_ID", previousAccessKey);
      restoreEnv("ZIWEI_EXPORT_STORAGE_SECRET_ACCESS_KEY", previousSecret);
      restoreEnv("ZIWEI_EXPORT_STORAGE_PUBLIC_BASE_URL", previousPublicBase);
    }
  });

  test("records failed report generation jobs, retries them, and opens support fallback after repeated failures", () => {
    clearReportsForTests();
    clearLaunchOpsForTests();

    const job = createReportGenerationJob({
      member_id: "member_report_retry",
      max_attempts: 2,
      request: {
        report_type: "single_chart",
        chart_id: "missing_report_retry_chart",
        mode: "professional"
      }
    });
    const retry = retryReportGenerationJob(job.job_id);

    expect(job.status).toBe("retry_pending");
    expect(job.attempt_count).toBe(1);
    expect(job.last_error_code).toBe("CHART_NOT_FOUND");
    expect(job.request_digest).toMatch(/^sha256:/);
    expect(retry.status).toBe("support_fallback");
    expect(retry.attempt_count).toBe(2);
    expect(retry.support_ticket_id).toMatch(/^ticket_/);
    expect(retry.audit_trail.at(-1)).toMatchObject({
      action: "report_generation_support_fallback",
      actor_role: "system"
    });
    expect(JSON.stringify({ job, retry })).not.toContain("2000-08-16");
    expect(JSON.stringify({ job, retry })).not.toContain("03:30");
    expect(JSON.stringify({ job, retry })).not.toContain("Shanghai");
  });

  test("creates a generated report job when retryable input is valid", () => {
    clearReportsForTests();
    const chart = createChart({ birth_profile: primaryBirthProfile });

    const job = createReportGenerationJob({
      member_id: "member_report_generated",
      request: {
        report_type: "single_chart",
        chart_id: chart.chart_id,
        mode: "professional"
      }
    });

    expect(job.status).toBe("generated");
    expect(job.report_id).toMatch(/^report_/);
    expect(job.attempt_count).toBe(1);
    expect(getReportDraft(job.report_id ?? "")?.report_id).toBe(job.report_id);
  });

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
    expect(draft.title).toBe("单盘六宫观察报告");
    expect(draft.template_version).toBe("v0.1");
    expect(draft.sections).toHaveLength(6);
    expect(draft.sections[0].title).toBe("命宫");
    expect(draft.sections[0].basis).not.toContain("life palace");
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

  test("attaches formal delivery metadata for paid layers, free summaries, prompt lineage, and export readiness", () => {
    const chart = createChart({ birth_profile: primaryBirthProfile });

    const draft = createReportDraft({
      report_type: "single_chart",
      chart_id: chart.chart_id,
      chart: chart.chart,
      mode: "professional"
    });

    expect(draft.report_version).toBe(1);
    expect(draft.access).toMatchObject({
      policy: "private_paid",
      free_summary_enabled: true,
      required_tier: "standard_49",
      owner_can_read: true,
      entitlement_required_for_private_sections: true
    });
    expect(draft.lineage).toMatchObject({
      report_version_id: `${draft.report_id}_v1`,
      template_version: draft.template_version,
      rule_version: chart.rule_version,
      prompt_version: promptVersion,
      generated_at: draft.created_at,
      ai_grounding_policy: "local_rules_trace_only"
    });
    expect(draft.share_summary).toMatchObject({
      visibility: "public_redacted",
      source_section_ids: expect.arrayContaining([draft.sections[0].section_id]),
      title: "单盘六宫观察报告摘要",
      privacy_note: expect.stringContaining("full birth date")
    });
    expect(draft.share_summary.summary).toContain("公开分享仅展示脱敏摘要");
    expect(draft.export_options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ format: "html", enabled: true, entitlement_required: true }),
        expect.objectContaining({ format: "pdf", enabled: true, entitlement_required: true })
      ])
    );
    expect(JSON.stringify(draft.share_summary)).not.toContain("2000-08-16");
    expect(JSON.stringify(draft.share_summary)).not.toContain("03:30");
    expect(JSON.stringify(draft.share_summary)).not.toContain("Shanghai");
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

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
