import { beforeEach, describe, expect, test } from "vitest";
import { POST as channelEntryPost } from "../src/app/api/channel/entry/route.js";
import { POST as channelEventPost } from "../src/app/api/growth/channel-event/route.js";
import { GET as channelDashboardGet } from "../src/app/api/growth/channel-dashboard/route.js";
import { POST as memberLinkPost } from "../src/app/api/member/link-anonymous/route.js";
import { POST as shareCreatePost } from "../src/app/api/share/create/route.js";
import { clearChannelForTests, clearGrowthForTests } from "../src/store.js";

describe("phase 14 channel route handlers", () => {
  beforeEach(() => {
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
        body: JSON.stringify({
          visitor_id: entry.entry.visitor_id,
          member_id: "member_phase14_route",
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

    const dashboardResponse = await channelDashboardGet(new Request("http://local/api/growth/channel-dashboard"));
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
});
