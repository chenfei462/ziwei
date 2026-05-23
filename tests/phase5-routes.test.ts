import { describe, expect, test } from "vitest";
import { POST as createChartPost } from "../src/app/api/chart/create/route.js";
import { GET as betaDashboardGet } from "../src/app/api/beta/dashboard/route.js";
import { POST as favoritePost } from "../src/app/api/beta/favorite/route.js";
import { POST as reportIntentPost } from "../src/app/api/beta/report-intent/route.js";
import { POST as shareCardPost } from "../src/app/api/beta/share-card/route.js";

const chartBody = {
  birth_profile: {
    display_name: "Beta route user",
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
    gender_rule: "traditional_female"
  }
};

describe("phase 5 beta route handlers", () => {
  test("support share card, favorite, report intent, and dashboard routes", async () => {
    const createdResponse = await createChartPost(
      new Request("http://local/api/chart/create", {
        method: "POST",
        body: JSON.stringify(chartBody)
      })
    );
    const created = await createdResponse.json();

    const shareResponse = await shareCardPost(
      new Request("http://local/api/beta/share-card", {
        method: "POST",
        body: JSON.stringify({
          chart_id: created.chart_id,
          palace_id: "wealth",
          mode: "entertainment",
          session_id: "session_route_beta"
        })
      })
    );
    const share = await shareResponse.json();

    const favoriteResponse = await favoritePost(
      new Request("http://local/api/beta/favorite", {
        method: "POST",
        body: JSON.stringify({
          chart_id: created.chart_id,
          palace_id: "wealth",
          session_id: "session_route_beta",
          note: "Keep this view, but never store 2000-08-16 03:30."
        })
      })
    );
    const favorite = await favoriteResponse.json();

    const reportResponse = await reportIntentPost(
      new Request("http://local/api/beta/report-intent", {
        method: "POST",
        body: JSON.stringify({
          chart_id: created.chart_id,
          session_id: "session_route_beta",
          tier_id: "standard_49",
          intent_level: 4,
          contact_opt_in: false
        })
      })
    );
    const reportIntent = await reportResponse.json();

    const dashboardResponse = await betaDashboardGet();
    const dashboard = await dashboardResponse.json();

    expect(shareResponse.status).toBe(201);
    expect(share.share_card.privacy_note).toContain("privacy");
    expect(favoriteResponse.status).toBe(201);
    expect(favorite.favorite_id).toMatch(/^fav_/);
    expect(reportResponse.status).toBe(201);
    expect(reportIntent.report_intent.payment_status).toBe("intent_only");
    expect(dashboardResponse.status).toBe(200);
    expect(dashboard.share_cards_created).toBeGreaterThanOrEqual(1);
    expect(dashboard.favorites_saved).toBeGreaterThanOrEqual(1);
    expect(dashboard.report_intents).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(dashboard)).not.toContain("2000-08-16");
  });
});
