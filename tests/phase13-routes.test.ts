import { describe, expect, test, beforeEach } from "vitest";
import { createChart } from "../src/chartEngine.js";
import { createDailyTheme, recordDailyCheckIn } from "../src/phase12/daily.js";
import { clearDailyForTests, clearGrowthForTests } from "../src/store.js";
import { GET as streakGet } from "../src/app/api/daily/streak/route.js";
import { POST as referralPost } from "../src/app/api/growth/referral-event/route.js";
import { GET as challengeListGet } from "../src/app/api/challenge/list/route.js";
import { POST as challengeJoinPost } from "../src/app/api/challenge/join/route.js";
import { POST as challengeCheckInPost } from "../src/app/api/challenge/check-in/route.js";
import { POST as shareCreatePost } from "../src/app/api/share/create/route.js";
import { GET as shareGet } from "../src/app/api/share/[id]/route.js";

const birthProfile = {
  display_name: "Phase 13 route profile",
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
};

const consent = {
  agreed: true,
  no_sensitive_birth_data: true,
  no_video_frame: true
} as const;

const memberHeaders = {
  "x-member-id": "member_phase13_route_owner"
};

describe("phase 13 route handlers", () => {
  beforeEach(() => {
    clearDailyForTests();
    clearGrowthForTests();
  });

  test("serves streak, share landing, referral, and challenge endpoints", async () => {
    const chart = createChart({ birth_profile: birthProfile as never });
    const memberId = "member_phase13_route";
    for (const date of ["2027-08-15", "2027-08-16"]) {
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

    const streakResponse = await streakGet(
      new Request("http://local/api/daily/streak?member_id=member_phase13_route&as_of_date=2027-08-16")
    );
    const streak = await streakResponse.json();
    const shareResponse = await shareCreatePost(
      new Request("http://local/api/share/create", {
        method: "POST",
        body: JSON.stringify({
          member_id: memberId,
          source_type: "daily_theme",
          source_id: "daily_20270816_life",
          title: "Daily card 2000-08-16",
          summary: "Opened at 03:30 in Shanghai.",
          keywords: ["Zi Wei"],
          safety_flags: ["daily_observation_only"]
        })
      })
    );
    const share = await shareResponse.json();
    const shareLoadResponse = await shareGet(new Request(`http://local/api/share/${share.snapshot.share_id}`), {
      params: Promise.resolve({ id: share.snapshot.share_id })
    });
    const shareLoad = await shareLoadResponse.json();
    const referralResponse = await referralPost(
      new Request("http://local/api/growth/referral-event", {
        method: "POST",
        body: JSON.stringify({
          share_id: share.snapshot.share_id,
          event_type: "share_opened",
          visitor_id: "visitor_route"
        })
      })
    );
    const referral = await referralResponse.json();
    const challengeListResponse = await challengeListGet(new Request("http://local/api/challenge/list?member_id=member_phase13_route"));
    const challengeList = await challengeListResponse.json();
    const challengeJoinResponse = await challengeJoinPost(
      new Request("http://local/api/challenge/join", {
        method: "POST",
        body: JSON.stringify({ member_id: memberId, challenge_id: "challenge_7_day_stargarden" })
      })
    );
    const challengeJoin = await challengeJoinResponse.json();
    const challengeCheckInResponse = await challengeCheckInPost(
      new Request("http://local/api/challenge/check-in", {
        method: "POST",
        body: JSON.stringify({
          member_id: memberId,
          challenge_id: "challenge_7_day_stargarden",
          check_in_ref: "daily_20270816_life"
        })
      })
    );
    const challengeCheckIn = await challengeCheckInResponse.json();

    expect(streakResponse.status).toBe(200);
    expect(streak.streak.current_streak_days).toBe(2);
    expect(shareResponse.status).toBe(201);
    expect(share.snapshot.title).toContain("[birth_date_redacted]");
    expect(shareLoadResponse.status).toBe(200);
    expect(shareLoad.snapshot.share_id).toBe(share.snapshot.share_id);
    expect(referralResponse.status).toBe(201);
    expect(referral.event.event_type).toBe("share_opened");
    expect(challengeListResponse.status).toBe(200);
    expect(challengeList.challenges.length).toBeGreaterThanOrEqual(3);
    expect(challengeJoinResponse.status).toBe(201);
    expect(challengeJoin.progress.status).toBe("active");
    expect(challengeCheckInResponse.status).toBe(201);
    expect(challengeCheckIn.progress.current_count).toBe(1);
    expect(JSON.stringify({ streak, share, shareLoad, referral, challengeList, challengeJoin, challengeCheckIn })).not.toContain("2000-08-16");
    expect(JSON.stringify({ streak, share, shareLoad, referral, challengeList, challengeJoin, challengeCheckIn })).not.toContain("03:30");
    expect(JSON.stringify({ streak, share, shareLoad, referral, challengeList, challengeJoin, challengeCheckIn })).not.toContain("Shanghai");
  });

  test("returns typed errors for missing share and challenge ids", async () => {
    const shareResponse = await shareGet(new Request("http://local/api/share/missing"), {
      params: Promise.resolve({ id: "missing" })
    });
    const share = await shareResponse.json();
    const challengeJoinResponse = await challengeJoinPost(
      new Request("http://local/api/challenge/join", {
        method: "POST",
        body: JSON.stringify({ member_id: "member_route", challenge_id: "missing" })
      })
    );
    const challengeJoin = await challengeJoinResponse.json();

    expect(shareResponse.status).toBe(404);
    expect(share.error.code).toBe("SHARE_SNAPSHOT_NOT_FOUND");
    expect(challengeJoinResponse.status).toBe(404);
    expect(challengeJoin.error.code).toBe("COMMUNITY_CHALLENGE_NOT_FOUND");
  });

  test("binds streak and challenge progress to the server-resolved member identity", async () => {
    const chart = createChart({ birth_profile: birthProfile as never });
    for (const date of ["2027-08-15", "2027-08-16"]) {
      const daily = createDailyTheme({
        chart_id: chart.chart_id,
        date,
        mode: "entertainment"
      });
      recordDailyCheckIn({
        daily_theme_id: daily.daily_theme.daily_theme_id,
        member_id: "member_phase13_route_owner",
        completed_quest_ids: daily.daily_theme.quests.map((quest) => quest.quest_id),
        favorite_star_card_ids: ["star_zi_wei"],
        share_intent: true,
        consent
      });
    }

    const streakResponse = await streakGet(
      new Request("http://local/api/daily/streak?member_id=member_phase13_query_spoof&as_of_date=2027-08-16", {
        headers: memberHeaders
      })
    );
    const streak = await streakResponse.json();
    const challengeJoinResponse = await challengeJoinPost(
      new Request("http://local/api/challenge/join", {
        method: "POST",
        headers: memberHeaders,
        body: JSON.stringify({ member_id: "member_phase13_body_spoof", challenge_id: "challenge_7_day_stargarden" })
      })
    );
    const challengeJoin = await challengeJoinResponse.json();
    const challengeListResponse = await challengeListGet(
      new Request("http://local/api/challenge/list?member_id=member_phase13_query_spoof", {
        headers: memberHeaders
      })
    );
    const challengeList = await challengeListResponse.json();
    const challengeCheckInResponse = await challengeCheckInPost(
      new Request("http://local/api/challenge/check-in", {
        method: "POST",
        headers: memberHeaders,
        body: JSON.stringify({
          member_id: "member_phase13_body_spoof",
          challenge_id: "challenge_7_day_stargarden",
          check_in_ref: "daily_20270816_life"
        })
      })
    );
    const challengeCheckIn = await challengeCheckInResponse.json();

    expect(streakResponse.status).toBe(200);
    expect(streak.streak.member_id).toBe("member_phase13_route_owner");
    expect(streak.streak.current_streak_days).toBe(2);
    expect(challengeJoinResponse.status).toBe(201);
    expect(challengeJoin.progress.member_id).toBe("member_phase13_route_owner");
    expect(JSON.stringify(challengeJoin)).not.toContain("member_phase13_body_spoof");
    expect(challengeListResponse.status).toBe(200);
    expect(challengeList.progress.some((progress: { member_id: string }) => progress.member_id === "member_phase13_route_owner")).toBe(true);
    expect(challengeCheckInResponse.status).toBe(201);
    expect(challengeCheckIn.progress.member_id).toBe("member_phase13_route_owner");
    expect(challengeCheckIn.progress.current_count).toBe(1);
  });
});
