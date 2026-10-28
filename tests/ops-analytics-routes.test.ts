import { describe, expect, test } from "vitest";
import { GET as analyticsGet } from "../src/app/api/ops/analytics/events/route.js";
import { GET as channelDashboardGet } from "../src/app/api/ops/growth/channel-dashboard/route.js";

const opsHeaders = {
  "x-admin-token": "phase10_admin_token",
  "x-admin-role": "ops_admin",
  "x-admin-actor": "ops_analytics_route_test"
};

describe("internal analytics route handlers", () => {
  test("expose analytics and channel dashboards behind ops auth", async () => {
    const analyticsResponse = await analyticsGet(
      new Request("http://local/api/ops/analytics/events", {
        headers: opsHeaders
      })
    );
    const analytics = await analyticsResponse.json();

    const channelResponse = await channelDashboardGet(
      new Request("http://local/api/ops/growth/channel-dashboard", {
        headers: opsHeaders
      })
    );
    const channel = await channelResponse.json();

    expect(analyticsResponse.status).toBe(200);
    expect(analytics.events_by_type).toBeDefined();
    expect(channelResponse.status).toBe(200);
    expect(channel.dashboard.channel_health).toBeDefined();
    expect(JSON.stringify({ analytics, channel })).not.toMatch(/2000-08-16|03:30|Shanghai/);
  });

  test("rejects analytics dashboards without ops credentials", async () => {
    const analyticsResponse = await analyticsGet(new Request("http://local/api/ops/analytics/events"));
    const channelResponse = await channelDashboardGet(new Request("http://local/api/ops/growth/channel-dashboard"));
    const analytics = await analyticsResponse.json();
    const channel = await channelResponse.json();

    expect(analyticsResponse.status).toBe(401);
    expect(analytics.error.code).toBe("OPS_AUTH_REQUIRED");
    expect(channelResponse.status).toBe(401);
    expect(channel.error.code).toBe("OPS_AUTH_REQUIRED");
  });
});
