import { describe, expect, test } from "vitest";
import { POST as createChartPost } from "../src/app/api/chart/create/route.js";
import { GET as getChartGet } from "../src/app/api/chart/[id]/route.js";
import { POST as interpretPost } from "../src/app/api/interpret/route.js";

const body = {
  birth_profile: {
    display_name: "Route测试用户",
    calendar_type: "gregorian",
    birth_date: "2000-08-16",
    birth_time: "03:30",
    timezone: "Asia/Shanghai",
    location: {
      name: "上海",
      longitude: 121.4737,
      latitude: 31.2304
    },
    is_leap_month: false,
    true_solar_time_enabled: false,
    gender_rule: "traditional_female"
  }
};

describe("phase 2 Next route handlers", () => {
  test("wrap chart create and chart read while preserving phase 1 contracts", async () => {
    const createdResponse = await createChartPost(new Request("http://local/api/chart/create", {
      method: "POST",
      body: JSON.stringify(body)
    }));
    const created = await createdResponse.json();

    expect(createdResponse.status).toBe(201);
    expect(created.chart.palaces).toHaveLength(12);

    const fetchedResponse = await getChartGet(
      new Request(`http://local/api/chart/${created.chart_id}`, {
        headers: { cookie: createdResponse.headers.get("set-cookie") ?? "" }
      }),
      {
        params: Promise.resolve({ id: created.chart_id })
      }
    );
    const fetched = await fetchedResponse.json();

    expect(fetchedResponse.status).toBe(200);
    expect(fetched.chart_id).toBe(created.chart_id);
  });

  test("wraps the formal phase-3 interpretation response", async () => {
    const createdResponse = await createChartPost(new Request("http://local/api/chart/create", {
      method: "POST",
      headers: { "x-visitor-id": "visitor_phase2_interpret_owner" },
      body: JSON.stringify(body)
    }));
    const created = await createdResponse.json();

    const interpretedResponse = await interpretPost(new Request("http://local/api/interpret", {
      method: "POST",
      headers: { "x-visitor-id": "visitor_phase2_interpret_owner" },
      body: JSON.stringify({
        chart_id: created.chart_id,
        palace_id: "life",
        mode: "professional",
        include_trace: true
      })
    }));
    const interpreted = await interpretedResponse.json();

    expect(interpretedResponse.status).toBe(200);
    expect(interpreted.status).toBe("ready");
    expect(interpreted.interpretation.safety_flags).toContain("avoid_absolute_prediction");
    expect(interpreted.trace.length).toBeGreaterThan(0);
  });

  test("blocks interpretation of a chart owned by another visitor", async () => {
    const createdResponse = await createChartPost(
      new Request("http://local/api/chart/create", {
        method: "POST",
        headers: { "x-visitor-id": "visitor_phase2_interpret_owner" },
        body: JSON.stringify(body)
      })
    );
    const created = await createdResponse.json();

    const interpretedResponse = await interpretPost(
      new Request("http://local/api/interpret", {
        method: "POST",
        headers: { "x-visitor-id": "visitor_phase2_interpret_stranger" },
        body: JSON.stringify({
          chart_id: created.chart_id,
          palace_id: "life",
          mode: "professional",
          include_trace: true
        })
      })
    );
    const interpreted = await interpretedResponse.json();

    expect(interpretedResponse.status).toBe(403);
    expect(interpreted.error).toMatchObject({ code: "CHART_ACCESS_FORBIDDEN", field: "chart_id" });
    expect(JSON.stringify(interpreted)).not.toContain("2000-08-16");
    expect(JSON.stringify(interpreted)).not.toContain("03:30");
    expect(JSON.stringify(interpreted)).not.toContain("涓婃捣");
  });

  test("returns a shared error envelope when interpretation receives an empty body", async () => {
    const response = await interpretPost(new Request("http://local/api/interpret", {
      method: "POST",
      body: ""
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatchObject({ code: "INVALID_JSON" });
  });
});
