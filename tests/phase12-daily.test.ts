import { describe, expect, test } from "vitest";
import { createChart } from "../src/chartEngine.js";
import {
  createDailyTheme,
  getMemberAchievements,
  getStarAtlasCard,
  listStarAtlas,
  recordDailyCheckIn
} from "../src/phase12/daily.js";

const birthProfile = {
  display_name: "Phase 12 daily profile",
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

describe("phase 12 daily stargarden", () => {
  test("creates a privacy-safe daily theme with rule version, quests, atlas links, and share card v0.3", () => {
    const chart = createChart({ birth_profile: birthProfile, rule_profile_id: "default_ziwei_v0_1" });
    const daily = createDailyTheme({
      chart_id: chart.chart_id,
      date: "2027-08-16",
      mode: "entertainment"
    });

    expect(daily.daily_theme.date).toBe("2027-08-16");
    expect(daily.daily_theme.rule_profile_id).toBe("default_ziwei_v0_1");
    expect(daily.daily_theme.rule_version).toBe("rules_v0.2");
    expect(daily.daily_theme.quests.length).toBeGreaterThanOrEqual(1);
    expect(daily.daily_theme.quests.length).toBeLessThanOrEqual(3);
    expect(daily.daily_theme.trace[0]?.knowledge_node_ids.length).toBeGreaterThan(0);
    expect(daily.daily_theme.share_card.version).toBe("v0.3");
    expect(daily.daily_theme.safety_flags).toContain("daily_observation_only");
    expect(daily.daily_theme.safety_flags).toContain("major_decision_guard");
    expect(daily.privacy.hides_full_birth_date).toBe(true);
    expect(JSON.stringify(daily)).not.toContain("2000-08-16");
    expect(JSON.stringify(daily)).not.toContain("03:30");
    expect(JSON.stringify(daily)).not.toContain("Shanghai");
    expect(JSON.stringify(daily)).not.toMatch(/必然|死亡|破产|离婚|投资建议|医疗建议|法律建议/);
  });

  test("serves atlas cards and records check-ins without storing sensitive birth data", () => {
    const chart = createChart({ birth_profile: birthProfile });
    const daily = createDailyTheme({
      chart_id: chart.chart_id,
      date: "2027-05-12",
      mode: "professional",
      palace_id: "career"
    });
    const atlas = listStarAtlas({ member_id: "member_phase12_test" });
    const card = getStarAtlasCard("star_zi_wei", "member_phase12_test");
    const checkIn = recordDailyCheckIn({
      daily_theme_id: daily.daily_theme.daily_theme_id,
      member_id: "member_phase12_test",
      completed_quest_ids: daily.daily_theme.quests.map((quest) => quest.quest_id),
      favorite_star_card_ids: ["star_zi_wei"],
      share_intent: true,
      feedback: "Finished 2027-05-12 at 03:30 in Shanghai",
      consent: {
        agreed: true,
        no_sensitive_birth_data: true,
        no_video_frame: true
      }
    });
    const achievements = getMemberAchievements("member_phase12_test");

    expect(atlas.cards.length).toBeGreaterThanOrEqual(14);
    expect(card.card.card_id).toBe("star_zi_wei");
    expect(card.card.knowledge_node_id).toBe("star_zi_wei");
    expect(checkIn.check_in.completed_quest_ids).toEqual(daily.daily_theme.quests.map((quest) => quest.quest_id));
    expect(checkIn.achievements.some((achievement) => achievement.achievement_id === "achievement_daily_first_checkin" && achievement.unlocked)).toBe(true);
    expect(achievements.achievements.some((achievement) => achievement.unlocked)).toBe(true);
    expect(JSON.stringify({ atlas, card, checkIn, achievements })).not.toContain("2000-08-16");
    expect(JSON.stringify({ atlas, card, checkIn, achievements })).not.toContain("03:30");
    expect(JSON.stringify({ atlas, card, checkIn, achievements })).not.toContain("Shanghai");
  });

  test("rejects invalid daily input with typed errors", () => {
    expect(() =>
      createDailyTheme({
        chart_id: "missing_chart",
        date: "2027-05-12",
        mode: "entertainment"
      })
    ).toThrow(/chart not found/i);
    expect(() =>
      createDailyTheme({
        chart_id: "chart_any",
        date: "2027-13-40",
        mode: "entertainment",
        chart: {
          palaces: [],
          stars: [],
          transforms: [],
          major_periods: []
        }
      })
    ).toThrow(/date must use yyyy-mm-dd/i);
    expect(() => getStarAtlasCard("missing_card")).toThrow(/star atlas card not found/i);
  });
});
