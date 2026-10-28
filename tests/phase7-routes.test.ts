import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { POST as createChartPost } from "../src/app/api/chart/create/route.js";
import { POST as opsSynastryPost } from "../src/app/api/ops/synastry/create/route.js";
import { POST as opsTimelinePost } from "../src/app/api/ops/timeline/interpret/route.js";
import { handleApiRequest } from "../src/api.js";

const opsHeaders = {
  "x-admin-token": "phase10_admin_token",
  "x-admin-role": "content_reviewer",
  "x-admin-actor": "phase7_ops_route_test"
};

const primaryChartBody = {
  birth_profile: {
    display_name: "Phase 7 route primary",
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
  }
};

const partnerChartBody = {
  birth_profile: {
    display_name: "Phase 7 route partner",
    calendar_type: "gregorian",
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
    gender_rule: "traditional_female"
  }
};

describe("phase 7 synastry and timeline route handlers", () => {
  test("keeps synastry and timeline expansion tooling out of the public API tree", () => {
    expect(existsSync(resolve("src/app/api/synastry")), "public synastry API directory").toBe(false);
    expect(existsSync(resolve("src/app/api/timeline")), "public timeline API directory").toBe(false);

    const publicSynastry = handleApiRequest("POST", "/api/synastry/create", {
      mode: "professional",
      primary: { label: "A", chart_id: "missing", consent: { agreed: true, no_sensitive_birth_data: true } },
      partner: { label: "B", chart_id: "missing", consent: { agreed: true, no_sensitive_birth_data: true } }
    });
    const publicTimeline = handleApiRequest("POST", "/api/timeline/interpret", {
      chart_id: "missing",
      year: 2027,
      mode: "professional"
    });

    expect(publicSynastry.status).toBe(404);
    expect(publicSynastry.body.error).toMatchObject({ code: "ROUTE_NOT_FOUND" });
    expect(publicTimeline.status).toBe(404);
    expect(publicTimeline.body.error).toMatchObject({ code: "ROUTE_NOT_FOUND" });
  });

  test("creates ops-only synastry and timeline cards from chart snapshots with privacy defaults", async () => {
    const primaryResponse = await createChartPost(
      new Request("http://local/api/chart/create", {
        method: "POST",
        body: JSON.stringify(primaryChartBody)
      })
    );
    const primary = await primaryResponse.json();

    const partnerResponse = await createChartPost(
      new Request("http://local/api/chart/create", {
        method: "POST",
        body: JSON.stringify(partnerChartBody)
      })
    );
    const partner = await partnerResponse.json();

    const synastryResponse = await opsSynastryPost(
      new Request("http://local/api/ops/synastry/create", {
        method: "POST",
        headers: opsHeaders,
        body: JSON.stringify({
          mode: "professional",
          primary: {
            label: "Primary",
            chart_id: primary.chart_id,
            chart: primary.chart,
            consent: { agreed: true, no_sensitive_birth_data: true }
          },
          partner: {
            label: "Partner",
            chart_id: partner.chart_id,
            chart: partner.chart,
            consent: { agreed: true, no_sensitive_birth_data: true }
          }
        })
      })
    );
    const synastry = await synastryResponse.json();

    const timelineResponse = await opsTimelinePost(
      new Request("http://local/api/ops/timeline/interpret", {
        method: "POST",
        headers: opsHeaders,
        body: JSON.stringify({
          chart_id: primary.chart_id,
          chart: primary.chart,
          year: 2027,
          month: 5,
          mode: "entertainment",
          palace_id: "career"
        })
      })
    );
    const timeline = await timelineResponse.json();

    expect(synastryResponse.status).toBe(201);
    expect(synastry.result.status).toBe("ready");
    expect(synastry.share_card.title).toContain("合盘");
    expect(timelineResponse.status).toBe(200);
    expect(timeline.annual_theme.title).toContain("2027");
    expect(timeline.share_card.title).toContain("年度主题");
    expect(JSON.stringify({ synastry, timeline })).not.toContain("2000-08-16");
    expect(JSON.stringify({ synastry, timeline })).not.toContain("03:30");
    expect(JSON.stringify({ synastry, timeline })).not.toContain("Shanghai");
  });

  test("returns shared error envelopes for missing consent and invalid timeline month", async () => {
    const missingConsentResponse = await opsSynastryPost(
      new Request("http://local/api/ops/synastry/create", {
        method: "POST",
        headers: opsHeaders,
        body: JSON.stringify({
          mode: "professional",
          primary: { label: "A", chart_id: "missing", consent: { agreed: true, no_sensitive_birth_data: true } },
          partner: { label: "B", chart_id: "missing", consent: { agreed: false, no_sensitive_birth_data: true } }
        })
      })
    );
    const missingConsent = await missingConsentResponse.json();

    const invalidMonthResponse = await opsTimelinePost(
      new Request("http://local/api/ops/timeline/interpret", {
        method: "POST",
        headers: opsHeaders,
        body: JSON.stringify({
          chart_id: "missing",
          year: 2027,
          month: 13,
          mode: "professional"
        })
      })
    );
    const invalidMonth = await invalidMonthResponse.json();

    expect(missingConsentResponse.status).toBe(400);
    expect(missingConsent.error).toMatchObject({ code: "SYNASTRY_CONSENT_REQUIRED", field: "consent" });
    expect(invalidMonthResponse.status).toBe(400);
    expect(invalidMonth.error).toMatchObject({ code: "INVALID_TIMELINE_MONTH", field: "month" });
  });

  test("rejects ops-only synastry and timeline tooling without ops credentials", async () => {
    const synastryResponse = await opsSynastryPost(
      new Request("http://local/api/ops/synastry/create", {
        method: "POST",
        body: JSON.stringify({
          mode: "professional",
          primary: { label: "A", chart_id: "missing", consent: { agreed: true, no_sensitive_birth_data: true } },
          partner: { label: "B", chart_id: "missing", consent: { agreed: true, no_sensitive_birth_data: true } }
        })
      })
    );
    const synastry = await synastryResponse.json();
    const timelineResponse = await opsTimelinePost(
      new Request("http://local/api/ops/timeline/interpret", {
        method: "POST",
        body: JSON.stringify({
          chart_id: "missing",
          year: 2027,
          month: 5,
          mode: "professional"
        })
      })
    );
    const timeline = await timelineResponse.json();

    expect(synastryResponse.status).toBe(401);
    expect(synastry.error.code).toBe("OPS_AUTH_REQUIRED");
    expect(timelineResponse.status).toBe(401);
    expect(timeline.error.code).toBe("OPS_AUTH_REQUIRED");
  });
});
