// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createChart } from "../src/chartEngine.js";
import { SynastryPanel } from "../src/components/phase7/SynastryPanel.js";
import { TimelinePanel } from "../src/components/phase7/TimelinePanel.js";
import type { SynastryCreateResponse, TimelineInterpretResponse } from "../src/types.js";

const primary = createChart({
  birth_profile: {
    display_name: "组件甲方",
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

const partner = createChart({
  birth_profile: {
    display_name: "组件乙方",
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

const synastryResponse: SynastryCreateResponse = {
  result: {
    synastry_id: "syn_test",
    status: "ready",
    mode: "professional",
    created_at: "2026-04-30T00:00:00.000Z",
    participant_labels: ["甲方", "乙方"],
    summary: "合盘对照显示沟通与协作可以用边界感来承接。",
    communication_style: "沟通风格：先确认事实，再讨论感受。",
    cooperation_rhythm: "合作节奏：适合用阶段检查点推进。",
    complementary_points: ["一方偏执行，一方偏整合。"],
    conflict_reminders: ["冲突提醒保持建议式，不做婚恋结论。"],
    shared_advice: ["共同建议：先定可复盘的小目标。"],
    confidence: "medium_structure",
    safety_flags: ["avoid_absolute_prediction", "relationship_decision_guard"],
    trace: [
      {
        rule_id: "phase7_synastry_life_spouse_bridge",
        layer: "synastry",
        title: "命宫与夫妻宫沟通桥",
        weight: 30,
        confidence: "medium_structure",
        source: {
          title: "斗数骨髓赋",
          excerpt: "吉凶不可一例而断",
          modern_translation: "关系解读必须多因素合参。"
        },
        safety_flags: ["avoid_absolute_prediction"],
        matched_points: ["life", "spouse"]
      }
    ]
  },
  share_card: {
    share_card_id: "syn_share",
    title: "甲方 × 乙方 合盘分享",
    summary: "沟通与协作可以用边界感来承接。",
    share_text: "合盘分享 | 沟通与协作",
    privacy_note: "full birth date, birth time, and location detail hidden by default.",
    safety_flags: ["avoid_absolute_prediction"]
  },
  privacy: {
    hides_full_birth_date: true,
    hides_birth_time: true,
    hides_location_detail: true,
    stores_video_frame: false,
    requires_participant_consent: true
  }
};

const timelineResponse: TimelineInterpretResponse = {
  timeline_id: "timeline_test",
  chart_id: primary.chart_id,
  scope: "monthly",
  mode: "entertainment",
  palace_id: "career",
  annual_theme: {
    year: 2027,
    focus_palace_id: "career",
    title: "2027 年度主题：官禄宫",
    basis: "依据：大限与官禄宫主题共同触发。",
    scenario: "适合观察职责边界和协作节奏。",
    advice: "以阶段目标复盘，不做重大决策承诺。",
    confidence: "medium_structure",
    safety_flags: ["avoid_absolute_prediction"]
  },
  monthly_theme: {
    month: 5,
    focus_palace_id: "career",
    title: "5 月观察：官禄宫",
    focus: "月度观察聚焦协作安排。",
    scenario: "适合安排项目节奏。",
    advice: "先用小任务确认方向。",
    confidence: "weak_structure",
    safety_flags: ["avoid_absolute_prediction"]
  },
  trace: [
    {
      rule_id: "phase7_timeline_major_period_overlay",
      layer: "annual_monthly",
      title: "大限叠加年度主题",
      weight: 28,
      confidence: "medium_structure",
      source: {
        title: "斗数发微论",
        excerpt: "行限参看",
        modern_translation: "阶段主题需要与本命结构互参。"
      },
      safety_flags: ["avoid_absolute_prediction"],
      matched_points: ["career", "major_period"]
    }
  ],
  share_card: {
    share_card_id: "timeline_share",
    title: "2027 年度主题卡",
    summary: "年度主题聚焦职责边界。",
    share_text: "年度主题 | 官禄宫",
    privacy_note: "full birth date, birth time, and location detail hidden by default.",
    safety_flags: ["avoid_absolute_prediction"]
  },
  privacy: {
    hides_full_birth_date: true,
    hides_birth_time: true,
    hides_location_detail: true,
    stores_video_frame: false,
    requires_participant_consent: true
  }
};

describe("phase 7 expansion UI", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("synastry panel requests consent-gated comparison and renders traceable share output", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => synastryResponse
    } as Response);

    render(<SynastryPanel partnerChart={partner} primaryChart={primary} />);

    expect(screen.getByRole("heading", { name: "合盘对照" })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/我确认双方资料仅用于合盘演示/));
    fireEvent.click(screen.getByRole("button", { name: "Create synastry" }));

    await waitFor(() => expect(screen.getByText(/沟通风格：/)).toBeInTheDocument());
    expect(screen.getByText(/甲方 × 乙方 合盘分享/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /查看合盘规则溯源/ }));
    expect(screen.getByText("phase7_synastry_life_spouse_bridge")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ops/synastry/create",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"no_sensitive_birth_data":true')
      })
    );
  });

  test("timeline panel generates annual and monthly theme cards without exposing birth details", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => timelineResponse
    } as Response);

    render(<TimelinePanel chart={primary} />);

    expect(screen.getByRole("heading", { name: "年度主题" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Year"), { target: { value: "2027" } });
    fireEvent.change(screen.getByLabelText("Month"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate annual theme" }));

    await waitFor(() => expect(screen.getAllByText(/2027 年度主题/).length).toBeGreaterThan(0));
    expect(screen.getByText(/5 月观察/)).toBeInTheDocument();
    expect(screen.getByText(/full birth date/)).toBeInTheDocument();
    expect(screen.queryByText("2000-08-16")).not.toBeInTheDocument();
    expect(screen.queryByText("03:30")).not.toBeInTheDocument();
    expect(screen.queryByText("Shanghai")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ops/timeline/interpret",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"palace_id":"career"')
      })
    );
  });
});
