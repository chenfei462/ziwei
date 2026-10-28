import { beforeEach, describe, expect, test } from "vitest";
import { createChart } from "../src/chartEngine.js";
import { submitClosedTestFeedback } from "../src/phase4/feedback.js";
import { createShareCard, saveFavoriteSnapshot, submitReportIntent, summarizeBetaDashboard } from "../src/phase5/beta.js";
import { clearBetaForTests, clearChartsForTests, clearFeedbackForTests } from "../src/store.js";
import type { BirthProfile, ClosedTestFeedbackRequest } from "../src/types.js";

const birthProfile: BirthProfile = {
  display_name: "Beta user",
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

const feedback: ClosedTestFeedbackRequest = {
  session_id: "session_beta_feedback",
  chart_id: "chart_beta_feedback",
  device: {
    type: "desktop",
    browser: "chromium",
    viewport: { width: 1440, height: 980 },
    camera_permission: "not_requested"
  },
  completed_tasks: ["create_chart", "select_palace", "switch_mode", "open_trace", "gesture_or_fallback", "submit_feedback"],
  ratings: {
    overall: 5,
    interpretation_trust: 4,
    gesture_usability: 4,
    share_willingness: 5
  },
  issue_category: "minor",
  comment: "Flow complete.",
  consent: {
    agreed: true,
    no_sensitive_birth_data: true,
    no_video_frame: true
  }
};

describe("internal product signal and commercialization validation", () => {
  beforeEach(() => {
    clearChartsForTests();
    clearFeedbackForTests();
    clearBetaForTests();
  });

  test("creates a share card without full birth details or video data", () => {
    const chart = createChart({ birth_profile: birthProfile });

    const response = createShareCard({
      chart_id: chart.chart_id,
      palace_id: "wealth",
      mode: "entertainment",
      session_id: "session_beta_share"
    });
    const serialized = JSON.stringify(response);

    expect(response.share_card_id).toMatch(/^share_/);
    expect(response.share_card.palace_id).toBe("wealth");
    expect(response.share_card.star_keywords.length).toBeGreaterThan(0);
    expect(response.share_card.privacy_note).toContain("privacy");
    expect(response.privacy).toMatchObject({
      hides_full_birth_date: true,
      hides_birth_time: true,
      hides_location_detail: true,
      stores_video_frame: false,
      real_payment_enabled: false
    });
    expect(serialized).not.toContain("2000-08-16");
    expect(serialized).not.toContain("03:30");
    expect(serialized).not.toContain("Shanghai");
    expect(serialized).not.toContain("data:image/");
  });

  test("stores favorites and report intent as intent-only product signals", () => {
    const chart = createChart({ birth_profile: birthProfile });

    const favorite = saveFavoriteSnapshot({
      chart_id: chart.chart_id,
      palace_id: "wealth",
      session_id: "session_beta_favorite",
      note: "Review again after 2000-08-16 03:30 in Shanghai."
    });
    const intent = submitReportIntent({
      chart_id: chart.chart_id,
      session_id: "session_beta_report",
      tier_id: "standard_49",
      intent_level: 5,
      contact_opt_in: false,
      note: "Interested in a paid report, no payment yet."
    });

    expect(favorite.favorite_id).toMatch(/^fav_/);
    expect(JSON.stringify(favorite)).not.toContain("2000-08-16");
    expect(JSON.stringify(favorite)).not.toContain("03:30");
    expect(intent.report_intent.payment_status).toBe("intent_only");
    expect(intent.report_intent.tier_id).toBe("standard_49");
    expect(intent.privacy.real_payment_enabled).toBe(false);

    const dashboard = summarizeBetaDashboard();
    expect(dashboard.share_cards_created).toBe(0);
    expect(dashboard.favorites_saved).toBe(1);
    expect(dashboard.report_intents).toBe(1);
    expect(dashboard.report_price_interest.standard_49).toBe(1);
  });

  test("combines internal feedback with activation, share, favorite, and report metrics", () => {
    const chart = createChart({ birth_profile: birthProfile });
    submitClosedTestFeedback({ ...feedback, chart_id: chart.chart_id });
    createShareCard({
      chart_id: chart.chart_id,
      palace_id: "wealth",
      mode: "professional",
      session_id: "session_beta_dashboard"
    });
    saveFavoriteSnapshot({
      chart_id: chart.chart_id,
      palace_id: "wealth",
      session_id: "session_beta_dashboard"
    });
    submitReportIntent({
      chart_id: chart.chart_id,
      session_id: "session_beta_dashboard",
      tier_id: "premium_99",
      intent_level: 4,
      contact_opt_in: false
    });

    const dashboard = summarizeBetaDashboard();

    expect(dashboard.closed_test.total_feedback).toBe(1);
    expect(dashboard.share_cards_created).toBe(1);
    expect(dashboard.favorites_saved).toBe(1);
    expect(dashboard.report_intents).toBe(1);
    expect(dashboard.beta_exit_targets).toMatchObject({
      completion_rate_target: 0.6,
      share_rate_target: 0.2,
      report_intent_rate_target: 0.05
    });
    expect(dashboard.privacy.event_logs_store_sensitive_birth_data).toBe(false);
  });
});
