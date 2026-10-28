import { beforeEach, describe, expect, test } from "vitest";
import {
  createChannelEntry,
  createChannelShare,
  getChannelDashboard,
  linkAnonymousMember,
  recordChannelGrowthEvent
} from "../src/phase14/channels.js";
import { clearChannelForTests, clearGrowthForTests } from "../src/store.js";

describe("phase 14 mini program and channel distribution core", () => {
  beforeEach(() => {
    clearGrowthForTests();
    clearChannelForTests();
  });

  test("creates privacy-safe channel entries and anonymous member links", () => {
    const entry = createChannelEntry({
      channel: "wechat_group",
      campaign: "qixi_launch_2000-08-16",
      share_id: "share_preview",
      referrer: "Shanghai group at 03:30",
      visitor_id: "visitor_phase14"
    });
    const link = linkAnonymousMember({
      visitor_id: entry.entry.visitor_id,
      member_id: "member_phase14",
      openid_placeholder: "openid_reserved_001"
    });

    expect(entry.entry.channel).toBe("wechat_group");
    expect(entry.entry.campaign).toContain("[birth_date_redacted]");
    expect(entry.entry.referrer).toContain("[birth_time_redacted]");
    expect(entry.entry.referrer).toContain("[location_redacted]");
    expect(entry.landing_url).toMatch(/^\/chart\/new(?:\?|$)/);
    expect(entry.landing_url).toContain("channel=wechat_group");
    expect(entry.landing_url).not.toContain("/phase14");
    expect(entry.landing_url).not.toContain("visitor_id=");
    expect(link.link.member_id).toBe("member_phase14");
    expect(link.link.openid_placeholder).toBe("openid_reserved_001");
    expect(JSON.stringify({ entry, link })).not.toMatch(/2000-08-16|03:30|Shanghai|data:image/);
  });

  test("creates channel share assets, deduplicates events, and summarizes attribution", () => {
    const share = createChannelShare({
      member_id: "member_phase14_share",
      source_type: "daily_theme",
      source_id: "daily_20270816_life",
      title: "Today card for 2000-08-16",
      summary: "Mini program poster opened at 03:30 in Shanghai. data:image/png;base64,AAAA",
      keywords: ["Zi Wei", "Hua Lu"],
      safety_flags: ["daily_observation_only"],
      share_format: "mini_program_card",
      channel: "wechat_group",
      campaign: "phase14_campaign"
    });

    const firstEvent = recordChannelGrowthEvent({
      share_id: share.snapshot.share_id,
      event_type: "share_opened",
      channel: "wechat_group",
      campaign: "phase14_campaign",
      visitor_id: "visitor_phase14_share",
      metadata: {
        surface: "mini_program_card",
        note: "Viewed at 03:30 in Shanghai"
      }
    });
    const duplicateEvent = recordChannelGrowthEvent({
      share_id: share.snapshot.share_id,
      event_type: "share_opened",
      channel: "wechat_group",
      campaign: "phase14_campaign",
      visitor_id: "visitor_phase14_share"
    });
    const dashboard = getChannelDashboard();

    expect(share.channel_share.share_format).toBe("mini_program_card");
    expect(share.channel_share.path).toContain("channel=wechat_group");
    expect(share.channel_share.path).not.toContain("visitor_id=");
    expect(share.channel_share.safety_flags).toContain("privacy_redaction_required");
    expect(share.snapshot.title).toContain("[birth_date_redacted]");
    expect(share.snapshot.summary).toContain("[birth_time_redacted]");
    expect(share.snapshot.summary).toContain("[location_redacted]");
    expect(share.snapshot.summary).toContain("[image_payload_redacted]");
    expect(firstEvent.event.is_duplicate).toBe(false);
    expect(duplicateEvent.event.is_duplicate).toBe(true);
    expect(dashboard.dashboard.total_channel_events).toBeGreaterThanOrEqual(2);
    expect(dashboard.dashboard.by_channel.wechat_group).toBeGreaterThanOrEqual(2);
    expect(dashboard.dashboard.by_event.share_opened).toBeGreaterThanOrEqual(2);
    expect(dashboard.dashboard.by_share_format.mini_program_card).toBeGreaterThanOrEqual(1);
    expect(dashboard.dashboard.channel_health.find((item) => item.channel === "wechat_group")).toMatchObject({
      channel: "wechat_group",
      status: "watch",
      duplicate_event_count: 1,
      disabled: false
    });
    expect(JSON.stringify({ share, firstEvent, duplicateEvent, dashboard })).not.toMatch(/2000-08-16|03:30|Shanghai|data:image/);
  });

  test("blocks paused channels while keeping sanitized health diagnostics visible", () => {
    process.env.ZIWEI_DISABLED_CHANNELS = "short_video";
    try {
      expect(() =>
        createChannelEntry({
          channel: "short_video",
          campaign: "suspicious_2000-08-16",
          referrer: "Shanghai 03:30"
        })
      ).toThrow(/channel is disabled/);

      expect(() =>
        recordChannelGrowthEvent({
          event_type: "invite_visit",
          channel: "short_video",
          visitor_id: "visitor_blocked"
        })
      ).toThrow(/channel is disabled/);

      const dashboard = getChannelDashboard();
      const shortVideoHealth = dashboard.dashboard.channel_health.find((item) => item.channel === "short_video");

      expect(dashboard.dashboard.disabled_channels).toContain("short_video");
      expect(shortVideoHealth).toMatchObject({
        channel: "short_video",
        status: "paused",
        disabled: true,
        recommendation: expect.stringContaining("Keep the channel paused")
      });
      expect(JSON.stringify(dashboard)).not.toMatch(/2000-08-16|03:30|Shanghai|data:image/);
    } finally {
      delete process.env.ZIWEI_DISABLED_CHANNELS;
    }
  });

  test("rejects unsupported channels and share formats with typed errors", () => {
    expect(() =>
      createChannelEntry({
        channel: "unsupported" as never
      })
    ).toThrow(/channel is invalid/);

    expect(() =>
      createChannelShare({
        source_type: "daily_theme",
        source_id: "daily_20270816_life",
        title: "Daily card",
        summary: "Daily summary",
        share_format: "poster_pdf" as never,
        channel: "wechat_group"
      })
    ).toThrow(/share_format is invalid/);
  });
});
