import { describe, expect, test } from "vitest";
import { createChart } from "../src/chartEngine.js";
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

describe("phase 12 route handlers", () => {
  test("serves daily theme, atlas cards, check-ins, and achievements", async () => {
    const chart = createChart({ birth_profile: birthProfile as never });
    const themeResponse = await dailyThemePost(
      new Request("http://local/api/daily/theme", {
        method: "POST",
        body: JSON.stringify({
          chart_id: chart.chart_id,
          date: "2027-08-16",
          mode: "entertainment"
        })
      })
    );
    const theme = await themeResponse.json();
    const atlasResponse = await atlasGet(new Request("http://local/api/star-atlas?member_id=member_phase12_route"));
    const atlas = await atlasResponse.json();
    const cardResponse = await atlasCardGet(new Request("http://local/api/star-atlas/star_zi_wei?member_id=member_phase12_route"), {
      params: Promise.resolve({ id: "star_zi_wei" })
    });
    const card = await cardResponse.json();
    const checkInResponse = await dailyCheckInPost(
      new Request("http://local/api/daily/check-in", {
        method: "POST",
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
    const achievementsResponse = await achievementsGet(new Request("http://local/api/member/achievements?member_id=member_phase12_route"));
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
});
