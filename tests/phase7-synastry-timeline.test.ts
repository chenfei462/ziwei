import { describe, expect, test } from "vitest";
import { createChart } from "../src/chartEngine.js";
import { createSynastry, interpretTimeline } from "../src/phase7/synastryTimeline.js";

const primaryBirthProfile = {
  display_name: "阶段7甲方",
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

const partnerBirthProfile = {
  display_name: "阶段7乙方",
  calendar_type: "gregorian" as const,
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
  gender_rule: "traditional_female" as const
};

describe("phase 7 synastry and timeline engine", () => {
  test("creates a consent-gated synastry result with traceable and safe relationship guidance", () => {
    const primary = createChart({ birth_profile: primaryBirthProfile });
    const partner = createChart({ birth_profile: partnerBirthProfile });

    const response = createSynastry({
      mode: "professional",
      primary: {
        label: "甲方",
        chart_id: primary.chart_id,
        chart: primary.chart,
        consent: { agreed: true, no_sensitive_birth_data: true }
      },
      partner: {
        label: "乙方",
        chart_id: partner.chart_id,
        chart: partner.chart,
        consent: { agreed: true, no_sensitive_birth_data: true }
      }
    });

    expect(response.result.status).toBe("ready");
    expect(response.result.communication_style).toContain("沟通");
    expect(response.result.cooperation_rhythm).toContain("节奏");
    expect(response.result.complementary_points.length).toBeGreaterThan(0);
    expect(response.result.conflict_reminders.join(" ")).not.toMatch(/必然|一定|离婚|分手|灾祸|死亡/);
    expect(response.result.safety_flags).toEqual(expect.arrayContaining(["avoid_absolute_prediction", "relationship_decision_guard"]));
    expect(response.result.trace[0]).toMatchObject({
      rule_id: expect.stringMatching(/^phase7_synastry_/),
      layer: "synastry",
      confidence: expect.any(String)
    });
    expect(response.share_card.privacy_note).toContain("full birth date");
    expect(JSON.stringify(response)).not.toContain("2000-08-16");
    expect(JSON.stringify(response)).not.toContain("03:30");
    expect(JSON.stringify(response)).not.toContain("Shanghai");
  });

  test("rejects synastry creation without both participant consents", () => {
    const primary = createChart({ birth_profile: primaryBirthProfile });
    const partner = createChart({ birth_profile: partnerBirthProfile });

    expect(() =>
      createSynastry({
        mode: "entertainment",
        primary: {
          label: "甲方",
          chart_id: primary.chart_id,
          chart: primary.chart,
          consent: { agreed: true, no_sensitive_birth_data: true }
        },
        partner: {
          label: "乙方",
          chart_id: partner.chart_id,
          chart: partner.chart,
          consent: { agreed: false, no_sensitive_birth_data: true }
        }
      })
    ).toThrow(/consent/i);
  });

  test("returns annual and monthly theme cards for MVP palaces without event prediction", () => {
    const chart = createChart({ birth_profile: primaryBirthProfile });

    const response = interpretTimeline({
      chart_id: chart.chart_id,
      chart: chart.chart,
      year: 2027,
      month: 5,
      mode: "entertainment",
      palace_id: "career"
    });

    expect(response.scope).toBe("monthly");
    expect(response.annual_theme.title).toContain("2027");
    expect(response.monthly_theme?.month).toBe(5);
    expect(response.annual_theme.focus_palace_id).toBe("career");
    expect(response.annual_theme.safety_flags).toContain("avoid_absolute_prediction");
    expect(response.trace[0]).toMatchObject({
      rule_id: expect.stringMatching(/^phase7_timeline_/),
      layer: "annual_monthly"
    });
    expect(response.share_card.share_text).toContain("年度主题");
    expect(JSON.stringify(response)).not.toMatch(/必然|一定|破产|绝症|死亡/);
  });
});
