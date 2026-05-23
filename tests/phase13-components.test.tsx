// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { MobileGrowthPanel } from "../src/components/phase13/MobileGrowthPanel.js";
import type {
  ChallengeCheckInResponse,
  ChallengeJoinResponse,
  ChallengeListResponse,
  DailyStreakResponse,
  ReferralEventResponse,
  ShareCreateResponse
} from "../src/types.js";

const privacy = {
  hides_full_birth_date: true,
  hides_birth_time: true,
  hides_location_detail: true,
  stores_video_frame: false,
  stores_full_birth_profile: false
} as const;

const streak = {
  streak: {
    member_id: "member_phase13_component",
    current_streak_days: 3,
    longest_streak_days: 5,
    last_check_in_date: "2027-08-16",
    break_protection_available: true,
    week_theme: "Week of steady observation",
    next_recommended_action: "Generate today card and complete one low-risk quest.",
    privacy_note: "full birth date, birth time, location detail, and camera frames hidden."
  },
  privacy
} satisfies DailyStreakResponse;

const share = {
  share_url: "/share/share_phase13_component",
  snapshot: {
    share_id: "share_phase13_component",
    version: "v0.1",
    source_type: "daily_theme",
    source_id: "daily_20270816_life",
    title: "Daily Stargarden card",
    summary: "A light observation card.",
    keywords: ["Zi Wei"],
    safety_flags: ["daily_observation_only"],
    created_at: "2027-08-16T00:00:00.000Z",
    privacy_note: "full birth date, birth time, location detail, and camera frames hidden."
  },
  privacy
} satisfies ShareCreateResponse;

const referral = {
  event: {
    referral_event_id: "ref_component",
    share_id: "share_phase13_component",
    event_type: "share_opened",
    visitor_id: "visitor_component",
    member_id: "member_phase13_component",
    created_at: "2027-08-16T00:00:00.000Z",
    is_duplicate: false,
    metadata: {}
  },
  dashboard_snapshot: {
    total_referral_events: 1,
    share_opened: 1,
    invite_visit: 0,
    daily_theme_created: 0,
    daily_check_in: 0,
    atlas_unlocked: 0,
    challenge_joined: 0,
    privacy
  },
  privacy
} satisfies ReferralEventResponse;

const challenges = {
  challenges: [
    {
      challenge_id: "challenge_7_day_stargarden",
      title: "7-Day Stargarden Challenge",
      description: "Complete one gentle observation each day.",
      challenge_type: "seven_day_stargarden",
      target_count: 7,
      safety_flags: ["daily_observation_only"],
      share_card_enabled: true,
      seasonal: false
    }
  ],
  progress: [],
  privacy
} satisfies ChallengeListResponse;

const joined = {
  challenge: challenges.challenges[0],
  progress: {
    challenge_id: "challenge_7_day_stargarden",
    member_id: "member_phase13_component",
    status: "active",
    current_count: 0,
    target_count: 7,
    joined_at: "2027-08-16T00:00:00.000Z",
    completed_at: undefined,
    last_check_in_ref: undefined,
    privacy_note: "full birth date, birth time, location detail, and camera frames hidden."
  },
  privacy
} satisfies ChallengeJoinResponse;

const challengeCheckIn = {
  ...joined,
  progress: {
    ...joined.progress,
    current_count: 1,
    last_check_in_ref: "daily_20270816_life"
  },
  share_snapshot: {
    ...share.snapshot,
    share_id: "share_challenge_component",
    source_type: "achievement",
    source_id: "challenge_7_day_stargarden"
  }
} satisfies ChallengeCheckInResponse;

describe("phase 13 mobile growth panel", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("loads streak, creates share, records referral, and checks in challenge without sensitive text", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => streak } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => share } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => referral } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => challenges } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => joined } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => challengeCheckIn } as Response);

    render(<MobileGrowthPanel initialChallenges={challenges} memberId="member_phase13_component" />);

    fireEvent.click(screen.getByRole("button", { name: "Load streak" }));
    await waitFor(() => expect(screen.getByText("current_streak: 3")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Create share landing" }));
    await waitFor(() => expect(screen.getByText("share_landing_ready")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Record referral" }));
    await waitFor(() => expect(screen.getByText("referral_recorded")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Join 7-day challenge" }));
    await waitFor(() => expect(screen.getByText("challenge_7_day_stargarden")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Challenge check-in" }));
    await waitFor(() => expect(screen.getByText("progress: 1/7")).toBeInTheDocument());

    expect(screen.queryByText("2000-08-16")).not.toBeInTheDocument();
    expect(screen.queryByText("03:30")).not.toBeInTheDocument();
    expect(screen.queryByText("Shanghai")).not.toBeInTheDocument();
  });
});
