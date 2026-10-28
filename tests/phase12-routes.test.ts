import { describe, expect, test } from "vitest";
import { POST as createChartPost } from "../src/app/api/chart/create/route.js";
import { POST as dailyCheckInPost } from "../src/app/api/daily/check-in/route.js";
import { POST as dailyThemePost } from "../src/app/api/daily/theme/route.js";
import { GET as achievementsGet } from "../src/app/api/member/achievements/route.js";
import { GET as atlasCardGet } from "../src/app/api/star-atlas/[id]/route.js";
import { GET as atlasGet } from "../src/app/api/star-atlas/route.js";

const birthProfile = {
  display_name: "Phase 12 route profile",
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

const memberHeaders = {
  "x-member-id": "member_phase12_route_owner"
};

describe("phase 12 route handlers", () => {
  test("serves daily theme, atlas cards, check-ins, and achievements", async () => {
    const routeHeaders = {
      "x-member-id": "member_phase12_route"
    };
    const chart = await createOwnedChart(routeHeaders);
    const themeResponse = await dailyThemePost(
      new Request("http://local/api/daily/theme", {
        method: "POST",
        headers: routeHeaders,
        body: JSON.stringify({
          chart_id: chart.chart_id,
          date: "2027-08-16",
          mode: "entertainment"
        })
      })
    );
    const theme = await themeResponse.json();
    const atlasResponse = await atlasGet(
      new Request("http://local/api/star-atlas?member_id=member_phase12_route", {
        headers: routeHeaders
      })
    );
    const atlas = await atlasResponse.json();
    const cardResponse = await atlasCardGet(
      new Request("http://local/api/star-atlas/star_zi_wei?member_id=member_phase12_route", {
        headers: routeHeaders
      }),
      {
        params: Promise.resolve({ id: "star_zi_wei" })
      }
    );
    const card = await cardResponse.json();
    const checkInResponse = await dailyCheckInPost(
      new Request("http://local/api/daily/check-in", {
        method: "POST",
        headers: routeHeaders,
        body: JSON.stringify({
          daily_theme_id: theme.daily_theme.daily_theme_id,
          member_id: "member_phase12_route",
          completed_quest_ids: theme.daily_theme.quests.map((quest: { quest_id: string }) => quest.quest_id),
          favorite_star_card_ids: ["star_zi_wei"],
          share_intent: true,
          feedback: "No sensitive 2000-08-16 03:30 Shanghai data should survive.",
          consent: {
            agreed: true,
            no_sensitive_birth_data: true,
            no_video_frame: true
          }
        })
      })
    );
    const checkIn = await checkInResponse.json();
    const achievementsResponse = await achievementsGet(
      new Request("http://local/api/member/achievements?member_id=member_phase12_route", {
        headers: routeHeaders
      })
    );
    const achievements = await achievementsResponse.json();

    expect(themeResponse.status).toBe(201);
    expect(theme.daily_theme.share_card.version).toBe("v0.3");
    expect(atlasResponse.status).toBe(200);
    expect(atlas.cards.length).toBeGreaterThanOrEqual(14);
    expect(cardResponse.status).toBe(200);
    expect(card.card.card_id).toBe("star_zi_wei");
    expect(checkInResponse.status).toBe(201);
    expect(checkIn.achievements.some((achievement: { unlocked: boolean }) => achievement.unlocked)).toBe(true);
    expect(achievementsResponse.status).toBe(200);
    expect(achievements.achievements.some((achievement: { unlocked: boolean }) => achievement.unlocked)).toBe(true);
    expect(JSON.stringify({ theme, atlas, card, checkIn, achievements })).not.toContain("2000-08-16");
    expect(JSON.stringify({ theme, atlas, card, checkIn, achievements })).not.toContain("03:30");
    expect(JSON.stringify({ theme, atlas, card, checkIn, achievements })).not.toContain("Shanghai");
  });

  test("returns existing error envelopes for invalid daily and atlas requests", async () => {
    const themeResponse = await dailyThemePost(
      new Request("http://local/api/daily/theme", {
        method: "POST",
        body: JSON.stringify({
          chart_id: "missing_chart",
          date: "2027-08-16",
          mode: "entertainment"
        })
      })
    );
    const theme = await themeResponse.json();
    const cardResponse = await atlasCardGet(new Request("http://local/api/star-atlas/missing"), {
      params: Promise.resolve({ id: "missing" })
    });
    const card = await cardResponse.json();

    expect(themeResponse.status).toBe(404);
    expect(theme.error.code).toBe("CHART_NOT_FOUND");
    expect(cardResponse.status).toBe(404);
    expect(card.error.code).toBe("STAR_ATLAS_CARD_NOT_FOUND");
  });

  test("binds check-ins, atlas unlocks, and achievements to the server-resolved member identity", async () => {
    const chart = await createOwnedChart(memberHeaders);
    const themeResponse = await dailyThemePost(
      new Request("http://local/api/daily/theme", {
        method: "POST",
        headers: memberHeaders,
        body: JSON.stringify({
          chart_id: chart.chart_id,
          date: "2027-08-17",
          mode: "entertainment"
        })
      })
    );
    const theme = await themeResponse.json();
    const checkInResponse = await dailyCheckInPost(
      new Request("http://local/api/daily/check-in", {
        method: "POST",
        headers: memberHeaders,
        body: JSON.stringify({
          daily_theme_id: theme.daily_theme.daily_theme_id,
          member_id: "member_phase12_body_spoof",
          completed_quest_ids: theme.daily_theme.quests.map((quest: { quest_id: string }) => quest.quest_id),
          favorite_star_card_ids: ["transform_lu"],
          share_intent: true,
          consent: {
            agreed: true,
            no_sensitive_birth_data: true,
            no_video_frame: true
          }
        })
      })
    );
    const checkIn = await checkInResponse.json();
    const cardResponse = await atlasCardGet(
      new Request("http://local/api/star-atlas/transform_lu?member_id=member_phase12_query_spoof", {
        headers: memberHeaders
      }),
      { params: Promise.resolve({ id: "transform_lu" }) }
    );
    const card = await cardResponse.json();
    const achievementsResponse = await achievementsGet(
      new Request("http://local/api/member/achievements?member_id=member_phase12_query_spoof", {
        headers: memberHeaders
      })
    );
    const achievements = await achievementsResponse.json();

    expect(checkInResponse.status).toBe(201);
    expect(checkIn.check_in.member_id).toBe("member_phase12_route_owner");
    expect(JSON.stringify(checkIn)).not.toContain("member_phase12_body_spoof");
    expect(cardResponse.status).toBe(200);
    expect(card.card.unlock_status).toBe("unlocked");
    expect(achievementsResponse.status).toBe(200);
    expect(achievements.member_id).toBe("member_phase12_route_owner");
    expect(achievements.achievements.some((achievement: { unlocked: boolean }) => achievement.unlocked)).toBe(true);
  });

  test("binds daily theme creation to the current chart owner", async () => {
    const chart = await createOwnedChart({ "x-visitor-id": "visitor_phase12_daily_owner" });

    const strangerThemeResponse = await dailyThemePost(
      new Request("http://local/api/daily/theme", {
        method: "POST",
        headers: { "x-visitor-id": "visitor_phase12_daily_stranger" },
        body: JSON.stringify({
          chart_id: chart.chart_id,
          date: "2027-08-18",
          mode: "entertainment"
        })
      })
    );
    const strangerTheme = await strangerThemeResponse.json();
    const ownerThemeResponse = await dailyThemePost(
      new Request("http://local/api/daily/theme", {
        method: "POST",
        headers: { "x-visitor-id": "visitor_phase12_daily_owner" },
        body: JSON.stringify({
          chart_id: chart.chart_id,
          date: "2027-08-18",
          mode: "entertainment"
        })
      })
    );
    const ownerTheme = await ownerThemeResponse.json();

    expect(strangerThemeResponse.status).toBe(403);
    expect(strangerTheme.error).toMatchObject({ code: "CHART_ACCESS_FORBIDDEN", field: "chart_id" });
    expect(JSON.stringify(strangerTheme)).not.toContain("2000-08-16");
    expect(JSON.stringify(strangerTheme)).not.toContain("03:30");
    expect(JSON.stringify(strangerTheme)).not.toContain("Shanghai");
    expect(ownerThemeResponse.status).toBe(201);
    expect(ownerTheme.daily_theme.chart_id).toBe(chart.chart_id);
  });
});

async function createOwnedChart(headers: Record<string, string>) {
  const response = await createChartPost(
    new Request("http://local/api/chart/create", {
      method: "POST",
      headers,
      body: JSON.stringify({ birth_profile: birthProfile })
    })
  );
  return response.json();
}
