import { describe, expect, test } from "vitest";
import { POST as createChartPost } from "../src/app/api/chart/create/route.js";
import { GET as productSignalsDashboardGet } from "../src/app/api/ops/product-signals/dashboard/route.js";
import { POST as favoritePost } from "../src/app/api/ops/product-signals/favorite/route.js";
import { POST as reportIntentPost } from "../src/app/api/ops/product-signals/report-intent/route.js";
import { POST as shareCardPost } from "../src/app/api/ops/product-signals/share-card/route.js";

const chartBody = {
  birth_profile: {
    display_name: "Product signal route user",
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

const opsHeaders = {
  "content-type": "application/json",
  "x-admin-token": "phase10_admin_token",
  "x-admin-role": "ops_admin",
  "x-admin-actor": "product_signal_route_test"
};

describe("internal product signal route handlers", () => {
  test("support share card, favorite, report intent, and dashboard routes behind ops auth", async () => {
    const createdResponse = await createChartPost(
      new Request("http://local/api/chart/create", {
        method: "POST",
        body: JSON.stringify(chartBody)
      })
    );
    const created = await createdResponse.json();

    const shareResponse = await shareCardPost(
      new Request("http://local/api/ops/product-signals/share-card", {
        method: "POST",
        headers: opsHeaders,
        body: JSON.stringify({
          chart_id: created.chart_id,
          palace_id: "wealth",
          mode: "entertainment",
          session_id: "session_route_product_signal"
        })
      })
    );
    const share = await shareResponse.json();

    const favoriteResponse = await favoritePost(
      new Request("http://local/api/ops/product-signals/favorite", {
        method: "POST",
        headers: opsHeaders,
        body: JSON.stringify({
          chart_id: created.chart_id,
          palace_id: "wealth",
          session_id: "session_route_product_signal",
          note: "Keep this view, but never store 2000-08-16 03:30."
        })
      })
    );
    const favorite = await favoriteResponse.json();

    const reportResponse = await reportIntentPost(
      new Request("http://local/api/ops/product-signals/report-intent", {
        method: "POST",
        headers: opsHeaders,
        body: JSON.stringify({
          chart_id: created.chart_id,
          session_id: "session_route_product_signal",
          tier_id: "standard_49",
          intent_level: 4,
          contact_opt_in: false
        })
      })
    );
    const reportIntent = await reportResponse.json();

    const dashboardResponse = await productSignalsDashboardGet(
      new Request("http://local/api/ops/product-signals/dashboard", {
        headers: opsHeaders
      })
    );
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

  test("rejects product signal writes without ops credentials", async () => {
    const response = await favoritePost(
      new Request("http://local/api/ops/product-signals/favorite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chart_id: "chart_missing_auth",
          palace_id: "wealth",
          session_id: "session_missing_auth"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe("OPS_AUTH_REQUIRED");
  });
});
