import { describe, expect, test, beforeEach, afterEach, vi } from "vitest";
import manifest from "../src/app/manifest.js";
import { createChart } from "../src/chartEngine.js";
import { createDailyTheme, recordDailyCheckIn } from "../src/phase12/daily.js";
import {
  checkInChallenge,
  createShareLandingSnapshot,
  getDailyStreak,
  getShareLandingSnapshot,
  joinChallenge,
  listCommunityChallenges,
  recordReferralEvent
} from "../src/phase13/growth.js";
import { clearDailyForTests, clearGrowthForTests } from "../src/store.js";

const birthProfile = {
  display_name: "Phase 13 growth profile",
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

const consent = {
  agreed: true,
  no_sensitive_birth_data: true,
  no_video_frame: true
} as const;

describe("phase 13 mobile PWA and growth core", () => {
  beforeEach(() => {
    vi.useRealTimers();
    clearDailyForTests();
    clearGrowthForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("exposes a mobile-first PWA manifest and offline entry point", () => {
    const pwa = manifest();

    expect(pwa.name).toContain("紫微星垣");
    expect(pwa.start_url).toBe("/");
    expect(pwa.display).toBe("standalone");
    expect(pwa.icons?.length).toBeGreaterThanOrEqual(2);
  });

  test("calculates daily streaks from phase 12 check-ins without leaking birth data", () => {
    const chart = createChart({ birth_profile: birthProfile });
    const memberId = "member_phase13_streak";

    for (const date of ["2027-08-14", "2027-08-15", "2027-08-16"]) {
      const daily = createDailyTheme({
        chart_id: chart.chart_id,
        date,
        mode: "entertainment"
      });
      recordDailyCheckIn({
        daily_theme_id: daily.daily_theme.daily_theme_id,
        member_id: memberId,
        completed_quest_ids: daily.daily_theme.quests.map((quest) => quest.quest_id),
        favorite_star_card_ids: ["star_zi_wei"],
        share_intent: true,
        consent
      });
    }

    const streak = getDailyStreak({ member_id: memberId, as_of_date: "2027-08-16" });

    expect(streak.streak.current_streak_days).toBe(3);
    expect(streak.streak.longest_streak_days).toBe(3);
    expect(streak.streak.week_theme).toContain("Week");
    expect(streak.streak.next_recommended_action).toContain("today");
    expect(streak.privacy.hides_full_birth_date).toBe(true);
    expect(JSON.stringify(streak)).not.toContain("2000-08-16");
    expect(JSON.stringify(streak)).not.toContain("03:30");
    expect(JSON.stringify(streak)).not.toContain("Shanghai");
  });

  test("creates privacy-safe share landing snapshots and deduplicates referral events", () => {
    const share = createShareLandingSnapshot({
      member_id: "member_phase13_share",
      source_type: "daily_theme",
      source_id: "daily_20270816_life",
      title: "Daily card for 2000-08-16",
      summary: "Opened at 03:30 in Shanghai with a light observation.",
      keywords: ["Zi Wei", "Hua Lu"],
      safety_flags: ["daily_observation_only"]
    });
    const loaded = getShareLandingSnapshot(share.snapshot.share_id);
    const firstReferral = recordReferralEvent({
      share_id: share.snapshot.share_id,
      event_type: "share_opened",
      visitor_id: "visitor_a"
    });
    const duplicateReferral = recordReferralEvent({
      share_id: share.snapshot.share_id,
      event_type: "share_opened",
      visitor_id: "visitor_a"
    });

    expect(share.share_url).toBe(`/share/${share.snapshot.share_id}`);
    expect(loaded.snapshot.title).toContain("[birth_date_redacted]");
    expect(loaded.snapshot.summary).toContain("[birth_time_redacted]");
    expect(loaded.snapshot.summary).toContain("[location_redacted]");
    expect(firstReferral.event.is_duplicate).toBe(false);
    expect(duplicateReferral.event.is_duplicate).toBe(true);
    expect(JSON.stringify({ share, loaded, firstReferral, duplicateReferral })).not.toContain("2000-08-16");
    expect(JSON.stringify({ share, loaded, firstReferral, duplicateReferral })).not.toContain("03:30");
    expect(JSON.stringify({ share, loaded, firstReferral, duplicateReferral })).not.toContain("Shanghai");
  });

  test("lists, joins, and checks in community challenges with bounded progress", () => {
    const memberId = "member_phase13_challenge";
    const challenges = listCommunityChallenges({ member_id: memberId });
    const joined = joinChallenge({ member_id: memberId, challenge_id: "challenge_7_day_stargarden" });
    const firstCheckIn = checkInChallenge({
      member_id: memberId,
      challenge_id: "challenge_7_day_stargarden",
      check_in_ref: "daily_20270816_life"
    });

    expect(challenges.challenges.map((challenge) => challenge.challenge_id)).toContain("challenge_7_day_stargarden");
    expect(joined.progress.status).toBe("active");
    expect(firstCheckIn.progress.current_count).toBe(1);
    expect(firstCheckIn.progress.target_count).toBe(7);
    expect(firstCheckIn.share_snapshot.source_type).toBe("achievement");
    expect(JSON.stringify(firstCheckIn)).not.toMatch(/2000-08-16|03:30|Shanghai|data:image/);
  });

  test("keeps challenge check-ins idempotent by check-in reference", () => {
    const memberId = "member_phase13_challenge_idempotent";
    joinChallenge({ member_id: memberId, challenge_id: "challenge_7_day_stargarden" });

    const firstCheckIn = checkInChallenge({
      member_id: memberId,
      challenge_id: "challenge_7_day_stargarden",
      check_in_ref: "chart:chart_public:2027-08-16"
    });
    const duplicateCheckIn = checkInChallenge({
      member_id: memberId,
      challenge_id: "challenge_7_day_stargarden",
      check_in_ref: "chart:chart_public:2027-08-16"
    });
    const nextCheckIn = checkInChallenge({
      member_id: memberId,
      challenge_id: "challenge_7_day_stargarden",
      check_in_ref: "daily_20270817_life"
    });

    expect(firstCheckIn.progress.current_count).toBe(1);
    expect(firstCheckIn.progress.last_check_in_ref).toBe("chart:chart_public:2027-08-16");
    expect(duplicateCheckIn.progress.current_count).toBe(1);
    expect(nextCheckIn.progress.current_count).toBe(2);
  });

  test("uses Asia Shanghai date for default challenge check-in references", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-08-15T17:00:00.000Z"));

    const checkIn = checkInChallenge({
      member_id: "member_phase13_shanghai_date",
      challenge_id: "challenge_7_day_stargarden"
    });

    expect(checkIn.progress.last_check_in_ref).toBe("challenge_7_day_stargarden:2027-08-16");
  });
});
