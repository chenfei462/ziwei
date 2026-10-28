import { describe, expect, test } from "vitest";
import { POST as opsLaunchGrowthEventPost } from "../src/app/api/ops/launch/growth-event/route.js";
import { handleApiRequest } from "../src/api.js";

const opsHeaders = {
  "x-admin-token": "phase10_admin_token",
  "x-admin-role": "ops_admin",
  "x-admin-actor": "ops_launch_growth_event_route_test"
};

describe("internal launch growth event route handler", () => {
  test("records launch growth events behind ops authorization", async () => {
    const response = await opsLaunchGrowthEventPost(
      new Request("http://local/api/ops/launch/growth-event", {
        method: "POST",
        headers: opsHeaders,
        body: JSON.stringify({
          type: "preview_to_payment",
          member_id: "member_launch_growth_route",
          report_id: "report_launch_growth_route",
          order_id: "order_launch_growth_route",
          value_cents: 4900
        })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      type: "preview_to_payment",
      member_id: "member_launch_growth_route",
      report_id: "report_launch_growth_route",
      order_id: "order_launch_growth_route",
      value_cents: 4900
    });
    expect(body.growth_event_id).toMatch(/^growth_/);
  });

  test("rejects launch growth event writes without ops credentials", async () => {
    const response = await opsLaunchGrowthEventPost(
      new Request("http://local/api/ops/launch/growth-event", {
        method: "POST",
        body: JSON.stringify({
          type: "chart_to_purchase",
          member_id: "member_public_spoof"
        })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toMatchObject({ code: "OPS_AUTH_REQUIRED" });
  });

  test("does not serve the legacy public launch growth event dispatcher path", () => {
    const response = handleApiRequest("POST", "/api/launch/growth-event", {
      type: "payment_to_revisit",
      member_id: "member_legacy_public_spoof"
    });

    expect(response.status).toBe(404);
    expect(response.body.error).toMatchObject({ code: "ROUTE_NOT_FOUND" });
  });
});
