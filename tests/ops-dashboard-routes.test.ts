import { describe, expect, test } from "vitest";
import { GET as opsCommercialDashboardGet } from "../src/app/api/ops/commercial/dashboard/route.js";
import { GET as opsLaunchDashboardGet } from "../src/app/api/ops/launch/dashboard/route.js";

const opsHeaders = {
  "x-admin-token": "phase10_admin_token",
  "x-admin-role": "ops_admin",
  "x-admin-actor": "ops_dashboard_route_test"
};

describe("internal dashboard route handlers", () => {
  test("expose launch and commercial dashboards behind ops auth", async () => {
    const launchResponse = await opsLaunchDashboardGet(
      new Request("http://local/api/ops/launch/dashboard", {
        headers: opsHeaders
      })
    );
    const launch = await launchResponse.json();

    const commercialResponse = await opsCommercialDashboardGet(
      new Request("http://local/api/ops/commercial/dashboard", {
        headers: opsHeaders
      })
    );
    const commercial = await commercialResponse.json();

    expect(launchResponse.status).toBe(200);
    expect(launch.orders).toBeDefined();
    expect(launch.launch_config).toBeDefined();
    expect(commercialResponse.status).toBe(200);
    expect(commercial.total_orders).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify({ launch, commercial })).not.toMatch(/2000-08-16|03:30|Shanghai/);
  });

  test("rejects dashboard reads without ops credentials", async () => {
    const launchResponse = await opsLaunchDashboardGet(new Request("http://local/api/ops/launch/dashboard"));
    const commercialResponse = await opsCommercialDashboardGet(new Request("http://local/api/ops/commercial/dashboard"));
    const launch = await launchResponse.json();
    const commercial = await commercialResponse.json();

    expect(launchResponse.status).toBe(401);
    expect(launch.error.code).toBe("OPS_AUTH_REQUIRED");
    expect(commercialResponse.status).toBe(401);
    expect(commercial.error.code).toBe("OPS_AUTH_REQUIRED");
  });
});
