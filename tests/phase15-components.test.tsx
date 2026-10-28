// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { MiniProgramLaunchPanel } from "../src/components/phase15/MiniProgramLaunchPanel.js";
import type {
  MiniProgramLinkMemberResponse,
  MiniProgramLoginResponse,
  MiniProgramReleaseGateResponse,
  MiniProgramReminderEventResponse,
  MiniProgramShareCreateResponse,
  MiniProgramSubscribeResponse
} from "../src/types.js";

const privacy = {
  hides_full_birth_date: true,
  hides_birth_time: true,
  hides_location_detail: true,
  stores_video_frame: false,
  stores_full_birth_profile: false
} as const;

const releaseGate = {
  release_gate: {
    version: "mini_program_v0.1",
    review_status: "materials_ready",
    rollout_percent: 10,
    fallback_to_h5: true,
    allowed_channels: ["mini_program", "wechat_group"],
    review_notes: ["Service copy uses traditional culture self-observation wording."]
  },
  privacy
} satisfies MiniProgramReleaseGateResponse;

const login = {
  session: {
    session_id: "mp_session_component",
    visitor_id: "visitor_phase15_component",
    member_id: "member_phase15_component_auto",
    openid_hash: "wx_openid_hash_component",
    openid_binding_status: "new",
    channel: "mini_program",
    campaign: "phase15_component",
    created_at: "2027-08-16T00:00:00.000Z",
    expires_at: "2027-08-16T02:00:00.000Z",
    release_gate: releaseGate.release_gate,
    privacy_note: "openid is hashed; full birth date, birth time, location detail, and camera frames hidden."
  },
  binding: {
    binding_id: "mp_binding_component",
    openid_hash: "wx_openid_hash_component",
    visitor_id: "visitor_phase15_component",
    member_id: "member_phase15_component_auto",
    linked_at: "2027-08-16T00:00:00.000Z",
    is_duplicate: false,
    privacy_note: "raw wechat code and raw openid are not stored."
  },
  release_gate: releaseGate.release_gate,
  privacy
} satisfies MiniProgramLoginResponse;

const link = {
  binding: {
    ...login.binding,
    member_id: "member_phase15_component",
    is_duplicate: true
  },
  privacy
} satisfies MiniProgramLinkMemberResponse;

const share = {
  share_url: "pages/index/index?share_id=share_phase15_component&channel=mini_program",
  snapshot: {
    share_id: "share_phase15_component",
    version: "v0.1",
    source_type: "daily_theme",
    source_id: "daily_20270816_life",
    title: "Today mini program card",
    summary: "Privacy-safe mini program share.",
    keywords: ["Zi Wei"],
    safety_flags: ["daily_observation_only", "privacy_redaction_required", "mini_program_review_required"],
    created_at: "2027-08-16T00:00:00.000Z",
    privacy_note: "full birth date, birth time, location detail, and camera frames hidden."
  },
  mini_program_share: {
    share_id: "share_phase15_component",
    share_format: "wechat_mini_card",
    channel: "mini_program",
    campaign: "phase15_component",
    title: "Today mini program card",
    summary: "Privacy-safe mini program share.",
    path: "pages/index/index?share_id=share_phase15_component&channel=mini_program",
    qr_payload: "mini://pages/index/index?share_id=share_phase15_component&channel=mini_program",
    review_copy: "Traditional culture Stargarden card for self-observation.",
    privacy_note: "full birth date, birth time, location detail, and camera frames hidden.",
    safety_flags: ["daily_observation_only", "privacy_redaction_required", "mini_program_review_required"]
  },
  privacy
} satisfies MiniProgramShareCreateResponse;

const subscribe = {
  consent: {
    consent_id: "mp_subscribe_component",
    member_id: "member_phase15_component",
    template_type: "daily_stargarden_reminder",
    template_id: "tmpl_daily_component",
    consent_granted: true,
    channel: "mini_program",
    created_at: "2027-08-16T00:00:00.000Z",
    privacy_note: "subscription events store template consent only, not sensitive birth data."
  },
  privacy
} satisfies MiniProgramSubscribeResponse;

const reminder = {
  event: {
    reminder_event_id: "mp_reminder_component",
    member_id: "member_phase15_component",
    template_type: "daily_stargarden_reminder",
    target_date: "2027-08-16",
    action: "daily_reminder_queued",
    created_at: "2027-08-16T00:00:00.000Z",
    metadata: {
      surface: "mini_program"
    },
    privacy_note: "reminder logs do not contain full birth data, location detail, or camera frames."
  },
  privacy
} satisfies MiniProgramReminderEventResponse;

describe("phase 15 mini program launch panel", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("runs login, binding, share, subscription, reminder, and release gate actions without sensitive text", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => login } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => link } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => share } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => subscribe } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => reminder } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => releaseGate } as Response);

    render(<MiniProgramLaunchPanel memberId="member_phase15_component" />);

    fireEvent.click(screen.getByRole("button", { name: "Login mini program" }));
    await waitFor(() => expect(screen.getByText("mini_program_session_ready")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Link WeChat member" }));
    await waitFor(() => expect(screen.getByText("openid_bound")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Create mini share" }));
    await waitFor(() => expect(screen.getByText("wechat_mini_card")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Authorize reminder" }));
    await waitFor(() => expect(screen.getByText("subscribe_authorized")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Record reminder event" }));
    await waitFor(() => expect(screen.getByText("reminder_event_recorded")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Load release gate" }));
    await waitFor(() => expect(screen.getByText("review_status: materials_ready")).toBeInTheDocument());

    expect(screen.getByText("fallback_to_h5: true")).toBeInTheDocument();
    expect(screen.queryByText(/\/phase14/)).not.toBeInTheDocument();
    expect(screen.queryByText(/visitor_id=/)).not.toBeInTheDocument();
    expect(screen.queryByText("2000-08-16")).not.toBeInTheDocument();
    expect(screen.queryByText("03:30")).not.toBeInTheDocument();
    expect(screen.queryByText("Shanghai")).not.toBeInTheDocument();
    expect(screen.queryByText("wx_code_phase15_component")).not.toBeInTheDocument();

    expect(readFetchBodyAt(0)).not.toHaveProperty("visitor_id");
    expect(readFetchBodyAt(1)).not.toHaveProperty("visitor_id");
    expect(readFetchBodyAt(1)).not.toHaveProperty("member_id");
    expect(readFetchBodyAt(2)).not.toHaveProperty("visitor_id");
    expect(readFetchBodyAt(2)).not.toHaveProperty("member_id");
    expect(readFetchBodyAt(3)).not.toHaveProperty("member_id");
    expect(readFetchBodyAt(4)).not.toHaveProperty("member_id");
  });
});

function readFetchBodyAt(index: number): Record<string, unknown> {
  const init = vi.mocked(globalThis.fetch).mock.calls[index]?.[1] as RequestInit | undefined;
  return JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
}
