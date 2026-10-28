// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createChart } from "../src/chartEngine.js";
import { CreatorWorkbench } from "../src/components/phase8/CreatorWorkbench.js";
import { createSynastry, interpretTimeline } from "../src/phase7/synastryTimeline.js";
import type { ExportPreview, ReportDraft } from "../src/types.js";

const chart = createChart({
  birth_profile: {
    display_name: "Phase 8 component user",
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
});

const partnerChart = createChart({
  birth_profile: {
    display_name: "Phase 8 component partner",
    calendar_type: "gregorian",
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
    gender_rule: "traditional_female"
  }
});

const synastry = createSynastry({
  mode: "entertainment",
  primary: {
    label: "Primary",
    chart_id: chart.chart_id,
    chart: chart.chart,
    consent: { agreed: true, no_sensitive_birth_data: true }
  },
  partner: {
    label: "Partner",
    chart_id: partnerChart.chart_id,
    chart: partnerChart.chart,
    consent: { agreed: true, no_sensitive_birth_data: true }
  }
});

const timeline = interpretTimeline({
  chart_id: chart.chart_id,
  chart: chart.chart,
  year: 2027,
  month: 5,
  mode: "entertainment",
  palace_id: "career"
});

const draft: ReportDraft = {
  report_id: "report_component",
  report_type: "single_chart",
  mode: "professional",
  template_id: "single_chart_six_palaces",
  template_version: "v0.1",
  title: "Single chart six-palace report",
  created_at: "2026-04-30T00:00:00.000Z",
  report_version: 1,
  access: {
    policy: "private_paid",
    free_summary_enabled: true,
    required_tier: "standard_49",
    owner_can_read: true,
    entitlement_required_for_private_sections: true
  },
  lineage: {
    report_version_id: "report_component_v1",
    template_id: "single_chart_six_palaces",
    template_version: "v0.1",
    prompt_version: "interpretation_rewrite_v2026_05_25",
    generated_at: "2026-04-30T00:00:00.000Z",
    ai_grounding_policy: "local_rules_trace_only"
  },
  share_summary: {
    visibility: "public_redacted",
    title: "Single chart six-palace report summary",
    summary: "Public share only includes a redacted summary.",
    source_section_ids: ["section_life"],
    safety_flags: ["avoid_absolute_prediction"],
    privacy_note: "full birth date, birth time, and location detail hidden by default."
  },
  export_options: [
    {
      format: "html",
      enabled: true,
      entitlement_required: true,
      storage_provider: "local_preview",
      readiness: "ready"
    },
    {
      format: "pdf",
      enabled: true,
      entitlement_required: true,
      storage_provider: "local_preview",
      readiness: "ready"
    }
  ],
  chart_ref: {
    chart_id: chart.chart_id,
    snapshot_type: "chart"
  },
  sections: [
    {
      section_id: "section_life",
      title: "Life palace",
      basis: "Basis: palace theme and triggered rules.",
      interpretation: "Professional interpretation.",
      trace: [
        {
          rule_id: "phase3_rule",
          title: "Traceable rule",
          source_title: "Classic source",
          modern_translation: "Modern translation",
          weight: 28,
          confidence: "medium_structure",
          safety_flags: ["avoid_absolute_prediction"]
        }
      ],
      safety_flags: ["avoid_absolute_prediction"],
      share_blocks: ["Life palace creator card"],
      confidence: "medium_structure"
    }
  ],
  creator_assets: [
    {
      asset_id: "asset_live",
      asset_type: "live_outline",
      title: "Live outline",
      body: "Intro, basis, safety reminder.",
      safety_flags: ["avoid_absolute_prediction"],
      privacy_note: "full birth date, birth time, and location detail hidden by default."
    },
    {
      asset_id: "asset_short",
      asset_type: "short_video_script",
      title: "Short video script",
      body: "Hook, topic card, closing note.",
      safety_flags: ["avoid_absolute_prediction"],
      privacy_note: "full birth date, birth time, and location detail hidden by default."
    }
  ],
  review: {
    review_id: "review_component",
    report_id: "report_component",
    source_type: "report",
    source_id: "report_component",
    status: "approved",
    blocked_terms: [],
    privacy_flags: [],
    safety_flags: ["avoid_absolute_prediction"],
    checked_at: "2026-04-30T00:00:00.000Z",
    notes: ["Content approved for preview export."]
  },
  privacy_note: "full birth date, birth time, and location detail hidden by default.",
  safety_flags: ["avoid_absolute_prediction"],
  price_tier_hint: "standard_49"
};

const preview: ExportPreview = {
  export_preview_id: "export_component",
  report_id: "report_component",
  format: "pdf",
  preview_url: "/report/report_component?format=pdf",
  created_at: "2026-04-30T00:00:00.000Z",
  expires_at: "2026-05-01T00:00:00.000Z",
  review_status: "approved",
  order_created: false,
  payment_status: "preview_only",
  privacy_note: "full birth date, birth time, and location detail hidden by default."
};

describe("phase 8 creator workbench UI", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("generates a report draft, shows review state and opens export preview", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => draft } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => preview } as Response);

    render(<CreatorWorkbench chart={chart} synastry={synastry} timeline={timeline} />);

    expect(screen.getByRole("heading", { name: "Creator Workbench" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Generate report draft" }));

    await waitFor(() => expect(screen.getByText("Report approved")).toBeInTheDocument());
    expect(screen.getByText("Single chart six-palace report")).toBeInTheDocument();
    expect(screen.getByText("live_outline")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Preview export" }));

    await waitFor(() => expect(screen.getByText("preview_only")).toBeInTheDocument());
    expect(screen.queryByText("2000-08-16")).not.toBeInTheDocument();
    expect(screen.queryByText("03:30")).not.toBeInTheDocument();
    expect(screen.queryByText("Shanghai")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/report/draft",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"report_type":"single_chart"')
      })
    );
  });
});
