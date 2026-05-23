// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { RuleKnowledgePanel } from "../src/components/phase11/RuleKnowledgePanel.js";
import type { KnowledgeNodeDetail, KnowledgeSearchResponse, RuleCompareResponse, RuleProfileListResponse } from "../src/types.js";

const profiles = {
  profiles: [
    {
      profile_id: "default_ziwei_v0_1",
      label: "Default Zi Wei v0.1",
      description: "Frozen default profile",
      version: {
        version_id: "rules_v0.2",
        label: "Rule table v0.2",
        released_at: "2026-04-30",
        source: "phase 0-10 baseline"
      },
      rule_config: {
        school_id: "default_ziwei_v0_1",
        zi_hour_day_boundary: "civil_midnight",
        leap_month_policy: "same_month_number",
        true_solar_time_policy: "disabled",
        four_transform_policy: "default_stem",
        interpretation_style: "balanced_modern"
      },
      consultant_review_status: "confirmed",
      is_default: true,
      risk_note: "baseline",
      supported_features: ["chart", "interpretation"],
      safety_flags: ["avoid_absolute_prediction"]
    },
    {
      profile_id: "experimental_sanhe_v0_1",
      label: "Experimental Sanhe v0.1",
      description: "Candidate profile",
      version: {
        version_id: "rules_v0.2-exp",
        label: "Experimental profile",
        released_at: "2026-04-30",
        source: "phase 11 candidate"
      },
      rule_config: {
        school_id: "experimental_sanhe_v0_1",
        zi_hour_day_boundary: "late_zi_next_day",
        leap_month_policy: "split_leap_month",
        true_solar_time_policy: "optional",
        four_transform_policy: "experimental_stem_variant",
        interpretation_style: "classical_source_first"
      },
      consultant_review_status: "experimental",
      is_default: false,
      risk_note: "not default",
      supported_features: ["chart_compare"],
      safety_flags: ["consultant_review_required"]
    }
  ],
  default_profile_id: "default_ziwei_v0_1"
} satisfies RuleProfileListResponse;

const comparison = {
  base_profile: profiles.profiles[0],
  candidate_profile: profiles.profiles[1],
  base_chart: {
    chart_id: "chart_phase11_base",
    rule_profile_id: "default_ziwei_v0_1",
    rule_version: "rules_v0.2",
    palace_count: 12,
    transform_count: 4
  },
  candidate_chart: {
    chart_id: "chart_phase11_candidate",
    rule_profile_id: "experimental_sanhe_v0_1",
    rule_version: "rules_v0.2-exp",
    palace_count: 12,
    transform_count: 4
  },
  diffs: [
    {
      field: "leap_month_policy",
      base_value: "same_month_number",
      candidate_value: "split_leap_month",
      reason: "Candidate treats leap month as split observation.",
      impact: "calendar normalization",
      requires_consultant_review: true
    }
  ],
  privacy: {
    stores_full_birth_date: false,
    stores_birth_time: false,
    stores_location_detail: false,
    stores_video_frame: false
  }
} satisfies RuleCompareResponse;

const search = {
  query: "Zi Wei",
  results: [
    {
      node: {
        node_id: "star_zi_wei",
        node_type: "star",
        label: "Zi Wei",
        summary: "Major star knowledge node",
        tags: ["major_star"],
        source: {
          title: "Zi Wei Dou Shu Quan Shu",
          excerpt: "short classical excerpt",
          modern_translation: "Modern translation for rule use."
        },
        safety_flags: ["avoid_absolute_prediction"]
      },
      matched_fields: ["label"],
      score: 100
    }
  ],
  privacy: comparison.privacy
} satisfies KnowledgeSearchResponse;

const node = {
  node: search.results[0].node,
  edges: [
    {
      edge_id: "edge_ziwei_rule",
      from_node_id: "star_zi_wei",
      to_node_id: "source_doushu_quanshu",
      relation: "appears_in_rule",
      rule_ids: ["phase11_star_ziwei_basis"],
      weight: 90,
      note: "source trace"
    }
  ],
  related_nodes: [
    {
      node_id: "source_doushu_quanshu",
      node_type: "source",
      label: "Zi Wei Dou Shu Quan Shu",
      summary: "Source node",
      tags: ["source"],
      source: {
        title: "Zi Wei Dou Shu Quan Shu",
        excerpt: "source excerpt",
        modern_translation: "source translation"
      },
      safety_flags: ["avoid_absolute_prediction"]
    }
  ],
  privacy: comparison.privacy
} satisfies KnowledgeNodeDetail;

describe("phase 11 rule knowledge panel", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("compares rule profiles, searches knowledge, opens a node, and hides sensitive birth input", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => comparison } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => search } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => node } as Response);

    render(<RuleKnowledgePanel initialProfiles={profiles} />);

    expect(screen.getAllByText("Default Zi Wei v0.1").length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByRole("button", { name: "Compare rule profiles" }));
    await waitFor(() => expect(screen.getByText("leap_month_policy")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Knowledge query"), { target: { value: "Zi Wei 2000-08-16 03:30 Shanghai" } });
    fireEvent.click(screen.getByRole("button", { name: "Search knowledge" }));
    await waitFor(() => expect(screen.getByText("star_zi_wei")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Open node star_zi_wei" }));
    await waitFor(() => expect(screen.getByText("appears_in_rule")).toBeInTheDocument());
    expect(screen.queryByText("2000-08-16")).not.toBeInTheDocument();
    expect(screen.queryByText("03:30")).not.toBeInTheDocument();
    expect(screen.queryByText("Shanghai")).not.toBeInTheDocument();
  });
});
