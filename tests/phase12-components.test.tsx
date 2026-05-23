// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DailyStargardenPanel } from "../src/components/phase12/DailyStargardenPanel.js";
import type {
  AchievementListResponse,
  DailyCheckInResponse,
  DailyThemeResponse,
  StarAtlasCardResponse,
  StarAtlasListResponse
} from "../src/types.js";

const privacy = {
  hides_full_birth_date: true,
  hides_birth_time: true,
  hides_location_detail: true,
  stores_video_frame: false,
  stores_full_birth_profile: false
} as const;

const dailyTheme = {
  daily_theme: {
    daily_theme_id: "daily_20270816_life",
    chart_id: "chart_phase12",
    date: "2027-08-16",
    mode: "entertainment",
    palace_id: "life",
    palace_label: "Life Palace",
    rule_profile_id: "default_ziwei_v0_1",
    rule_version: "rules_v0.2",
    title: "Daily Stargarden: Life Palace",
    summary: "Observe one small self-positioning pattern today.",
    star_keywords: ["Zi Wei", "Hua Lu"],
    seasonal_theme: {
      seasonal_theme_id: "birthday_month",
      label: "Birthday Month",
      theme_date: "2027-08-16",
      copy: "Use this month for gentle review.",
      safety_flags: ["daily_observation_only"]
    },
    quests: [
      {
        quest_id: "quest_daily_reflect",
        title: "Write one observation",
        prompt: "Record one low-risk observation.",
        category: "reflection",
        safety_flags: ["daily_observation_only"],
        completed: false
      }
    ],
    trace: [
      {
        trace_id: "trace_daily_life",
        rule_id: "daily_life_observation",
        rule_profile_id: "default_ziwei_v0_1",
        rule_version: "rules_v0.2",
        knowledge_node_ids: ["star_zi_wei"],
        basis: "Life palace daily observation.",
        confidence: "weak_structure",
        safety_flags: ["daily_observation_only"]
      }
    ],
    share_card: {
      share_card_id: "daily_share_001",
      version: "v0.3",
      card_type: "daily_theme",
      title: "Daily Stargarden card",
      summary: "Observe one small self-positioning pattern today.",
      keywords: ["Zi Wei"],
      privacy_note: "full birth date, birth time, location detail, and camera frames hidden by default.",
      safety_flags: ["daily_observation_only"]
    },
    safety_flags: ["avoid_absolute_prediction", "daily_observation_only", "major_decision_guard"]
  },
  privacy
} satisfies DailyThemeResponse;

const atlas = {
  cards: [
    {
      card_id: "star_zi_wei",
      label: "Zi Wei",
      category: "major_star",
      unlock_status: "unlocked",
      keywords: ["center", "structure"],
      summary: "Major star card.",
      knowledge_node_id: "star_zi_wei",
      source_title: "Zi Wei Dou Shu Quan Shu",
      safety_flags: ["avoid_absolute_prediction"]
    }
  ],
  privacy
} satisfies StarAtlasListResponse;

const card = {
  card: atlas.cards[0],
  related_knowledge_node_id: "star_zi_wei",
  privacy
} satisfies StarAtlasCardResponse;

const achievements = {
  member_id: "member_phase12_component",
  achievements: [
    {
      achievement_id: "achievement_daily_first_checkin",
      label: "First Daily Check-in",
      description: "Complete one daily quest.",
      unlocked: false,
      progress: 0,
      target: 1,
      unlocked_at: undefined,
      safety_flags: ["daily_observation_only"]
    }
  ],
  privacy
} satisfies AchievementListResponse;

const checkIn = {
  check_in: {
    check_in_id: "checkin_001",
    daily_theme_id: "daily_20270816_life",
    member_id: "member_phase12_component",
    completed_quest_ids: ["quest_daily_reflect"],
    favorite_star_card_ids: ["star_zi_wei"],
    share_intent: true,
    feedback: "Finished [birth_date_redacted] [birth_time_redacted] [location_redacted]",
    created_at: "2027-08-16T00:00:00.000Z",
    consent: {
      agreed: true,
      no_sensitive_birth_data: true,
      no_video_frame: true
    }
  },
  achievements: [{ ...achievements.achievements[0], unlocked: true, progress: 1, unlocked_at: "2027-08-16T00:00:00.000Z" }],
  privacy
} satisfies DailyCheckInResponse;

const chartSnapshot = {
  palaces: [
    {
      palace_id: "life",
      name: "Life Palace",
      branch: "zi",
      stem: "jia",
      main_stars: ["Zi Wei"],
      support_stars: [],
      transforms: [],
      strength_score: null,
      relation_refs: {
        opposite: "migration",
        triad: ["wealth", "career"],
        neighbors: ["parents", "siblings"]
      }
    }
  ],
  stars: [],
  transforms: [],
  major_periods: []
};

describe("phase 12 daily stargarden panel", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("generates daily theme, checks in, opens atlas card, and hides sensitive text", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => dailyTheme } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => checkIn } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => card } as Response);

    render(
      <DailyStargardenPanel
        chartId="chart_phase12"
        chartSnapshot={chartSnapshot}
        initialAtlas={atlas}
        initialAchievements={achievements}
        initialDate="2027-08-16"
        memberId="member_phase12_component"
      />
    );

    await waitFor(() => expect(screen.getByText("Zi Wei")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Generate daily theme" }));
    await waitFor(() => expect(screen.getByText("daily_observation_only")).toBeInTheDocument());
    const firstRequest = vi.mocked(globalThis.fetch).mock.calls[0]?.[1];
    expect(String(firstRequest?.body)).toContain("\"chart\"");

    fireEvent.click(screen.getByRole("button", { name: "Complete daily quest" }));
    await waitFor(() => expect(screen.getByText("First Daily Check-in")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Open atlas card star_zi_wei" }));
    await waitFor(() => expect(screen.getByText("star_zi_wei")).toBeInTheDocument());

    expect(screen.queryByText("2000-08-16")).not.toBeInTheDocument();
    expect(screen.queryByText("03:30")).not.toBeInTheDocument();
    expect(screen.queryByText("Shanghai")).not.toBeInTheDocument();
  });
});
