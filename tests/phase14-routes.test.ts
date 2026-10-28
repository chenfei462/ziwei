import { beforeEach, describe, expect, test } from "vitest";
import { POST as channelEntryPost } from "../src/app/api/channel/entry/route.js";
import { POST as channelEventPost } from "../src/app/api/growth/channel-event/route.js";
import { GET as channelDashboardGet } from "../src/app/api/ops/growth/channel-dashboard/route.js";
import { POST as memberLinkPost } from "../src/app/api/member/link-anonymous/route.js";
import { POST as shareCreatePost } from "../src/app/api/share/create/route.js";
import {
  clearChannelForTests,
  clearChartsForTests,
  clearGrowthForTests,
  getAnonymousLinkRecord,
  getChartOwnerRecord,
  listChannelGrowthEvents,
  listReferralEvents,
  saveChartOwnerRecord
} from "../src/store.js";

const opsHeaders = {
  "x-admin-token": "phase10_admin_token",
  "x-admin-role": "ops_admin",
  "x-admin-actor": "phase14_route_test"
};

describe("phase 14 channel route handlers", () => {
  beforeEach(() => {
    clearChartsForTests();
    clearGrowthForTests();
    clearChannelForTests();
  });

  test("serves channel entry, anonymous link, channel share, event, and dashboard endpoints", async () => {
    const entryResponse = await channelEntryPost(
      new Request("http://local/api/channel/entry", {
        method: "POST",
        body: JSON.stringify({
          channel: "wechat_group",
          campaign: "launch_2000-08-16",
          referrer: "Shanghai group 03:30",
          visitor_id: "visitor_route"
        })
      })
    );
    const entry = await entryResponse.json();

    const linkResponse = await memberLinkPost(
      new Request("http://local/api/member/link-anonymous", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-visitor-id": entry.entry.visitor_id,
          "x-member-id": "member_phase14_route"
        },
        body: JSON.stringify({
          openid_placeholder: "openid_reserved_route"
        })
      })
    );
    const link = await linkResponse.json();

    const shareResponse = await shareCreatePost(
      new Request("http://local/api/share/create", {
        method: "POST",
        body: JSON.stringify({
          member_id: "member_phase14_route",
          source_type: "daily_theme",
          source_id: "daily_20270816_life",
          title: "Channel card 2000-08-16",
          summary: "A mini program card opened at 03:30 in Shanghai.",
          keywords: ["Zi Wei"],
          safety_flags: ["daily_observation_only"],
          share_format: "mini_program_card",
          channel: "wechat_group",
          campaign: "launch_route"
        })
      })
    );
    const share = await shareResponse.json();

    const eventResponse = await channelEventPost(
      new Request("http://local/api/growth/channel-event", {
        method: "POST",
        body: JSON.stringify({
          share_id: share.snapshot.share_id,
          event_type: "share_opened",
          channel: "wechat_group",
          visitor_id: entry.entry.visitor_id,
          campaign: "launch_route"
        })
      })
    );
    const event = await eventResponse.json();

    const dashboardResponse = await channelDashboardGet(new Request("http://local/api/ops/growth/channel-dashboard", { headers: opsHeaders }));
    const dashboard = await dashboardResponse.json();

    expect(entryResponse.status).toBe(201);
    expect(entry.entry.channel).toBe("wechat_group");
    expect(linkResponse.status).toBe(201);
    expect(link.link.member_id).toBe("member_phase14_route");
    expect(shareResponse.status).toBe(201);
    expect(share.channel_share.share_format).toBe("mini_program_card");
    expect(eventResponse.status).toBe(201);
    expect(event.event.event_type).toBe("share_opened");
    expect(dashboardResponse.status).toBe(200);
    expect(dashboard.dashboard.by_channel.wechat_group).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify({ entry, link, share, event, dashboard })).not.toMatch(/2000-08-16|03:30|Shanghai|data:image/);
  });

  test("returns typed errors for invalid channel entry requests", async () => {
    const response = await channelEntryPost(
      new Request("http://local/api/channel/entry", {
        method: "POST",
        body: JSON.stringify({
          channel: "unsupported"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("INVALID_CHANNEL_SOURCE");
  });

  test("blocks disabled channel routes with typed errors", async () => {
    process.env.ZIWEI_DISABLED_CHANNELS = "qr_event";
    try {
      const entryResponse = await channelEntryPost(
        new Request("http://local/api/channel/entry", {
          method: "POST",
          body: JSON.stringify({
            channel: "qr_event",
            campaign: "offline_2000-08-16",
            referrer: "Shanghai 03:30"
          })
        })
      );
      const entry = await entryResponse.json();

      const eventResponse = await channelEventPost(
        new Request("http://local/api/growth/channel-event", {
          method: "POST",
          body: JSON.stringify({
            event_type: "invite_visit",
            channel: "qr_event",
            visitor_id: "visitor_disabled_route"
          })
        })
      );
      const event = await eventResponse.json();

      const dashboardResponse = await channelDashboardGet(new Request("http://local/api/ops/growth/channel-dashboard", { headers: opsHeaders }));
      const dashboard = await dashboardResponse.json();

      expect(entryResponse.status).toBe(403);
      expect(entry.error.code).toBe("CHANNEL_DISABLED");
      expect(eventResponse.status).toBe(403);
      expect(event.error.code).toBe("CHANNEL_DISABLED");
      expect(dashboard.dashboard.disabled_channels).toContain("qr_event");
      expect(JSON.stringify({ entry, event, dashboard })).not.toMatch(/2000-08-16|03:30|Shanghai|data:image/);
    } finally {
      delete process.env.ZIWEI_DISABLED_CHANNELS;
    }
  });

  test("binds public channel writes to server-resolved identity instead of spoofed body subjects", async () => {
    const identityHeaders = {
      "content-type": "application/json",
      "x-visitor-id": "visitor_phase14_route_owner",
      "x-member-id": "member_phase14_route_owner"
    };

    const entryResponse = await channelEntryPost(
      new Request("http://local/api/channel/entry", {
        method: "POST",
        headers: identityHeaders,
        body: JSON.stringify({
          channel: "wechat_group",
          campaign: "launch_route_identity",
          visitor_id: "visitor_phase14_body_spoof"
        })
      })
    );
    const entry = await entryResponse.json();

    const shareResponse = await shareCreatePost(
      new Request("http://local/api/share/create", {
        method: "POST",
        headers: identityHeaders,
        body: JSON.stringify({
          member_id: "member_phase14_body_spoof",
          visitor_id: "visitor_phase14_body_spoof",
          source_type: "daily_theme",
          source_id: "daily_20270816_life",
          title: "Channel card",
          summary: "Privacy-safe channel share.",
          keywords: ["Zi Wei"],
          safety_flags: ["daily_observation_only"],
          share_format: "mini_program_card",
          channel: "wechat_group",
          campaign: "launch_route_identity"
        })
      })
    );
    const share = await shareResponse.json();

    const channelEventResponse = await channelEventPost(
      new Request("http://local/api/growth/channel-event", {
        method: "POST",
        headers: identityHeaders,
        body: JSON.stringify({
          share_id: share.snapshot.share_id,
          event_type: "share_opened",
          channel: "wechat_group",
          visitor_id: "visitor_phase14_body_spoof",
          member_id: "member_phase14_body_spoof"
        })
      })
    );
    const channelEvent = await channelEventResponse.json();

    expect(entryResponse.status).toBe(201);
    expect(entry.entry.visitor_id).toBe("visitor_phase14_route_owner");
    expect(entry.landing_url).toMatch(/^\/chart\/new(?:\?|$)/);
    expect(entry.landing_url).not.toContain("visitor_id=");
    expect(shareResponse.status).toBe(201);
    expect(share.share_url).not.toContain("visitor_id=");
    expect(share.channel_share.path).not.toContain("visitor_id=");
    expect(channelEventResponse.status).toBe(201);
    expect(channelEvent.event.visitor_id).toBe("visitor_phase14_route_owner");
    expect(channelEvent.event.member_id).toBe("member_phase14_route_owner");
    expect(listChannelGrowthEvents().at(-1)).toMatchObject({
      visitor_id: "visitor_phase14_route_owner",
      member_id: "member_phase14_route_owner"
    });
  });

  test("binds direct anonymous member linking to server-resolved identity instead of spoofed body subjects", async () => {
    saveChartOwnerRecord({
      chart_id: "chart_phase14_link_victim",
      visitor_id: "visitor_phase14_link_victim",
      created_at: "2026-06-01T00:00:00.000Z"
    });
    saveChartOwnerRecord({
      chart_id: "chart_phase14_link_owner",
      visitor_id: "visitor_phase14_link_owner",
      created_at: "2026-06-01T00:00:01.000Z"
    });

    const response = await memberLinkPost(
      new Request("http://local/api/member/link-anonymous", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-visitor-id": "visitor_phase14_link_owner",
          "x-member-id": "member_phase14_link_owner"
        },
        body: JSON.stringify({
          visitor_id: "visitor_phase14_link_victim",
          member_id: "member_phase14_body_spoof",
          openid_placeholder: "openid_body_spoof"
        })
      })
    );
    const link = await response.json();

    expect(response.status).toBe(201);
    expect(link.link.visitor_id).toBe("visitor_phase14_link_owner");
    expect(link.link.member_id).toBe("member_phase14_link_owner");
    expect(link.migrated.chart_ids).toContain("chart_phase14_link_owner");
    expect(link.migrated.chart_ids).not.toContain("chart_phase14_link_victim");
    expect(getAnonymousLinkRecord("visitor_phase14_link_owner")?.member_id).toBe("member_phase14_link_owner");
    expect(getAnonymousLinkRecord("visitor_phase14_link_victim")).toBeUndefined();
    expect(getChartOwnerRecord("chart_phase14_link_owner")).toMatchObject({ member_id: "member_phase14_link_owner" });
    expect(getChartOwnerRecord("chart_phase14_link_victim")).toMatchObject({ visitor_id: "visitor_phase14_link_victim" });
  });

  test("binds referral events to server-resolved identity instead of spoofed body subjects", async () => {
    const shareResponse = await shareCreatePost(
      new Request("http://local/api/share/create", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-visitor-id": "visitor_phase14_referral_owner",
          "x-member-id": "member_phase14_referral_owner"
        },
        body: JSON.stringify({
          member_id: "member_phase14_body_spoof",
          source_type: "daily_theme",
          source_id: "daily_20270816_life",
          title: "Referral card",
          summary: "Privacy-safe referral share."
        })
      })
    );
    const share = await shareResponse.json();

    const eventResponse = await fetchReferralEvent({
      share_id: share.snapshot.share_id,
      event_type: "share_opened",
      visitor_id: "visitor_phase14_body_spoof",
      member_id: "member_phase14_body_spoof"
    });
    const event = await eventResponse.json();

    expect(shareResponse.status).toBe(201);
    expect(eventResponse.status).toBe(201);
    expect(event.event.visitor_id).toBe("visitor_phase14_referral_owner");
    expect(event.event.member_id).toBe("member_phase14_referral_owner");
    expect(listReferralEvents().at(-1)).toMatchObject({
      visitor_id: "visitor_phase14_referral_owner",
      member_id: "member_phase14_referral_owner"
    });
  });

  test("rejects channel dashboard reads without ops credentials", async () => {
    const response = await channelDashboardGet(new Request("http://local/api/ops/growth/channel-dashboard"));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe("OPS_AUTH_REQUIRED");
  });
});

function fetchReferralEvent(body: Record<string, unknown>): Promise<Response> {
  return import("../src/app/api/growth/referral-event/route.js").then(({ POST }) =>
    POST(
      new Request("http://local/api/growth/referral-event", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-visitor-id": "visitor_phase14_referral_owner",
          "x-member-id": "member_phase14_referral_owner"
        },
        body: JSON.stringify(body)
      })
    )
  );
}
