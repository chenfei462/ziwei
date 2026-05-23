// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ChannelDistributionPanel } from "../src/components/phase14/ChannelDistributionPanel.js";
import type {
  AnonymousLinkResponse,
  ChannelDashboardResponse,
  ChannelEntryResponse,
  ChannelGrowthEventResponse,
  ChannelShareCreateResponse
} from "../src/types.js";

const privacy = {
  hides_full_birth_date: true,
  hides_birth_time: true,
  hides_location_detail: true,
  stores_video_frame: false,
  stores_full_birth_profile: false
} as const;

const channelEntry = {
  entry: {
    entry_id: "entry_component",
    channel: "wechat_group",
    campaign: "phase14_component",
    share_id: "share_component",
    referrer: "component_referrer",
    visitor_id: "visitor_component",
    created_at: "2027-08-16T00:00:00.000Z",
    attribution: {
      channel: "wechat_group",
      campaign: "phase14_component",
      share_id: "share_component",
      referrer: "component_referrer",
      visitor_id: "visitor_component"
    },
    privacy_note: "full birth date, birth time, location detail, and camera frames hidden."
  },
  landing_url: "/phase14?channel=wechat_group&campaign=phase14_component&visitor_id=visitor_component",
  privacy
} satisfies ChannelEntryResponse;

const anonymousLink = {
  link: {
    link_id: "link_component",
    visitor_id: "visitor_component",
    member_id: "member_phase14_component",
    openid_placeholder: "openid_reserved_component",
    linked_at: "2027-08-16T00:00:00.000Z",
    privacy_note: "anonymous visitor, member id, and openid placeholder are linked without sensitive birth data."
  },
  privacy
} satisfies AnonymousLinkResponse;

const channelShare = {
  share_url: "/share/share_component?channel=wechat_group&campaign=phase14_component",
  snapshot: {
    share_id: "share_component",
    version: "v0.1",
    source_type: "daily_theme",
    source_id: "daily_20270816_life",
    title: "Today Stargarden card",
    summary: "Privacy-safe channel share.",
    keywords: ["Zi Wei"],
    safety_flags: ["daily_observation_only", "privacy_redaction_required"],
    created_at: "2027-08-16T00:00:00.000Z",
    privacy_note: "full birth date, birth time, location detail, and camera frames hidden."
  },
  channel_share: {
    share_id: "share_component",
    share_format: "mini_program_card",
    channel: "wechat_group",
    campaign: "phase14_component",
    title: "Today Stargarden card",
    summary: "Privacy-safe channel share.",
    path: "/share/share_component?channel=wechat_group&campaign=phase14_component",
    qr_payload: "/share/share_component?channel=wechat_group&campaign=phase14_component",
    privacy_note: "full birth date, birth time, location detail, and camera frames hidden.",
    safety_flags: ["daily_observation_only", "privacy_redaction_required"]
  },
  privacy
} satisfies ChannelShareCreateResponse;

const channelEvent = {
  event: {
    channel_event_id: "event_component",
    event_type: "share_opened",
    channel: "wechat_group",
    campaign: "phase14_component",
    share_id: "share_component",
    visitor_id: "visitor_component",
    member_id: "member_phase14_component",
    created_at: "2027-08-16T00:00:00.000Z",
    is_duplicate: false,
    share_format: "mini_program_card",
    metadata: {
      surface: "mini_program_card"
    }
  },
  dashboard_snapshot: {
    total_channel_events: 1,
    unique_visitors: 1,
    by_channel: {
      wechat_group: 1,
      mini_program: 0,
      qr_event: 0,
      short_video: 0,
      creator_homepage: 0,
      organic: 0
    },
    by_event: {
      share_opened: 1,
      invite_visit: 0,
      daily_theme_created: 0,
      daily_check_in: 0,
      challenge_joined: 0,
      report_intent: 0
    },
    by_share_format: {
      mini_program_card: 1,
      h5_poster: 0,
      qr_landing: 0
    },
    report_intent_events: 0,
    challenge_join_events: 0,
    privacy
  },
  privacy
} satisfies ChannelGrowthEventResponse;

const channelDashboard = {
  dashboard: channelEvent.dashboard_snapshot,
  privacy
} satisfies ChannelDashboardResponse;

describe("phase 14 channel distribution panel", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("runs channel entry, binding, share, event, and dashboard actions without sensitive text", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => channelEntry } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => anonymousLink } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => channelShare } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => channelEvent } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => channelDashboard } as Response);

    render(<ChannelDistributionPanel memberId="member_phase14_component" />);

    fireEvent.click(screen.getByRole("button", { name: "Create channel entry" }));
    await waitFor(() => expect(screen.getByText("channel_entry_ready")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Link anonymous visitor" }));
    await waitFor(() => expect(screen.getByText("anonymous_linked")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Create channel share" }));
    await waitFor(() => expect(screen.getByText("mini_program_card")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Record channel event" }));
    await waitFor(() => expect(screen.getByText("channel_event_recorded")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Load channel dashboard" }));
    await waitFor(() => expect(screen.getByText("total_channel_events: 1")).toBeInTheDocument());

    expect(screen.getAllByText("wechat_group").length).toBeGreaterThan(0);
    expect(screen.queryByText("2000-08-16")).not.toBeInTheDocument();
    expect(screen.queryByText("03:30")).not.toBeInTheDocument();
    expect(screen.queryByText("Shanghai")).not.toBeInTheDocument();
  });
});
