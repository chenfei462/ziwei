import { describe, expect, test } from "vitest";
import { POST as createChartPost } from "../src/app/api/chart/create/route.js";
import { POST as sessionPost } from "../src/app/api/immersive/session/route.js";
import { GET as sessionGet } from "../src/app/api/immersive/session/[id]/route.js";
import { POST as eventPost } from "../src/app/api/immersive/session/[id]/event/route.js";
import { GET as streamGet } from "../src/app/api/immersive/session/[id]/stream/route.js";

const chartBody = {
  birth_profile: {
    display_name: "Immersive route user",
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

describe("phase 6 immersive route handlers", () => {
  test("create, read, update, and stream a temporary immersive session", async () => {
    const createdChartResponse = await createChartPost(
      new Request("http://local/api/chart/create", {
        method: "POST",
        body: JSON.stringify(chartBody)
      })
    );
    const chart = await createdChartResponse.json();

    const sessionResponse = await sessionPost(
      new Request("http://local/api/immersive/session", {
        method: "POST",
        body: JSON.stringify({
          chart_id: chart.chart_id,
          display_mode: "stage_screen",
          ttl_minutes: 30
        })
      })
    );
    const sessionBody = await sessionResponse.json();

    const readResponse = await sessionGet(new Request(`http://local/api/immersive/session/${sessionBody.session.session_id}`), {
      params: Promise.resolve({ id: sessionBody.session.session_id })
    });
    const readBody = await readResponse.json();

    const eventResponse = await eventPost(
      new Request(`http://local/api/immersive/session/${sessionBody.session.session_id}/event`, {
        method: "POST",
        body: JSON.stringify({
          type: "select_palace",
          target_palace_id: "wealth",
          confidence: 0.92,
          note: "never store 2000-08-16 03:30 Shanghai"
        })
      }),
      { params: Promise.resolve({ id: sessionBody.session.session_id }) }
    );
    const eventBody = await eventResponse.json();

    const streamResponse = await streamGet(new Request(`http://local/api/immersive/session/${sessionBody.session.session_id}/stream`), {
      params: Promise.resolve({ id: sessionBody.session.session_id })
    });
    const streamBody = await streamResponse.json();

    expect(sessionResponse.status).toBe(201);
    expect(readResponse.status).toBe(200);
    expect(readBody.session.short_code).toBe(sessionBody.session.short_code);
    expect(eventResponse.status).toBe(201);
    expect(eventBody.session.active_palace_id).toBe("wealth");
    expect(eventBody.event.note).toContain("[birth_date_redacted]");
    expect(streamResponse.status).toBe(200);
    expect(streamBody.events).toHaveLength(1);
    expect(JSON.stringify(streamBody)).not.toContain("Shanghai");
  });

  test("returns the shared error envelope for missing immersive sessions", async () => {
    const response = await sessionGet(new Request("http://local/api/immersive/session/missing"), {
      params: Promise.resolve({ id: "missing" })
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toMatchObject({ code: "IMMERSIVE_SESSION_NOT_FOUND", field: "session_id" });
  });

  test("returns the shared error envelope for empty immersive event bodies", async () => {
    const response = await eventPost(
      new Request("http://local/api/immersive/session/missing/event", {
        method: "POST",
        body: ""
      }),
      { params: Promise.resolve({ id: "missing" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatchObject({ code: "INVALID_JSON" });
  });
});
