import { beforeEach, describe, expect, test } from "vitest";
import { POST as loginPost } from "../src/app/api/mini-program/login/route.js";
import { POST as linkMemberPost } from "../src/app/api/mini-program/link-member/route.js";
import { GET as releaseGateGet } from "../src/app/api/mini-program/release-gate/route.js";
import { POST as reminderEventPost } from "../src/app/api/mini-program/reminder-event/route.js";
import { POST as subscribePost } from "../src/app/api/mini-program/subscribe/route.js";
import { POST as shareCreatePost } from "../src/app/api/share/create/route.js";
import {
  getSubscribeConsentRecord,
  listMiniProgramReminderEvents,
  clearGrowthForTests,
  clearMiniProgramForTests
} from "../src/store.js";

describe("phase 15 mini program route handlers", () => {
  beforeEach(() => {
    clearGrowthForTests();
    clearMiniProgramForTests();
  });

  test("serves login, link, mini share, subscribe, reminder, and release gate endpoints", async () => {
    const identityHeaders = {
      "content-type": "application/json",
      "x-visitor-id": "visitor_route",
      "x-member-id": "member_phase15_route"
    };
    const loginResponse = await loginPost(
      new Request("http://local/api/mini-program/login", {
        method: "POST",
        headers: identityHeaders,
        body: JSON.stringify({
          code: "wx_code_phase15_route",
          channel: "mini_program",
          campaign: "route_2000-08-16"
        })
      })
    );
    const login = await loginResponse.json();

    const linkResponse = await linkMemberPost(
      new Request("http://local/api/mini-program/link-member", {
        method: "POST",
        headers: identityHeaders,
        body: JSON.stringify({
          openid_hash: login.binding.openid_hash
        })
      })
    );
    const link = await linkResponse.json();

    const shareResponse = await shareCreatePost(
      new Request("http://local/api/share/create", {
        method: "POST",
        headers: identityHeaders,
        body: JSON.stringify({
          source_type: "daily_theme",
          source_id: "daily_20270816_life",
          title: "Wechat mini card 2000-08-16",
          summary: "Opened at 03:30 in Shanghai.",
          keywords: ["Zi Wei"],
          safety_flags: ["daily_observation_only"],
          mini_program_share_format: "wechat_mini_card",
          channel: "mini_program",
          campaign: "route_review"
        })
      })
    );
    const share = await shareResponse.json();

    const subscribeResponse = await subscribePost(
      new Request("http://local/api/mini-program/subscribe", {
        method: "POST",
        headers: identityHeaders,
        body: JSON.stringify({
          template_type: "daily_stargarden_reminder",
          template_id: "tmpl_daily_route",
          consent_granted: true,
          channel: "mini_program"
        })
      })
    );
    const subscribe = await subscribeResponse.json();

    const reminderResponse = await reminderEventPost(
      new Request("http://local/api/mini-program/reminder-event", {
        method: "POST",
        headers: identityHeaders,
        body: JSON.stringify({
          template_type: "daily_stargarden_reminder",
          target_date: "2027-08-16",
          action: "daily_reminder_queued",
          metadata: {
            note: "03:30 Shanghai reminder"
          }
        })
      })
    );
    const reminder = await reminderResponse.json();

    const gateResponse = await releaseGateGet(new Request("http://local/api/mini-program/release-gate"));
    const gate = await gateResponse.json();

    expect(loginResponse.status).toBe(201);
    expect(login.session.openid_binding_status).toBe("new");
    expect(linkResponse.status).toBe(201);
    expect(link.binding.member_id).toBe("member_phase15_route");
    expect(shareResponse.status).toBe(201);
    expect(share.mini_program_share.share_format).toBe("wechat_mini_card");
    expect(share.mini_program_share.path).not.toContain("visitor_id=");
    expect(share.share_url).not.toContain("visitor_id=");
    expect(subscribeResponse.status).toBe(201);
    expect(subscribe.consent.consent_granted).toBe(true);
    expect(reminderResponse.status).toBe(201);
    expect(reminder.event.action).toBe("daily_reminder_queued");
    expect(gateResponse.status).toBe(200);
    expect(gate.release_gate.fallback_to_h5).toBe(true);
    expect(JSON.stringify({ login, link, share, subscribe, reminder, gate })).not.toMatch(/wx_code_phase15_route|2000-08-16|03:30|Shanghai|data:image/);
  });

  test("returns typed errors for invalid wechat login code", async () => {
    const response = await loginPost(
      new Request("http://local/api/mini-program/login", {
        method: "POST",
        body: JSON.stringify({
          code: "temporary_code",
          channel: "mini_program"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("INVALID_WECHAT_CODE");
  });

  test("binds mini program public writes to server-resolved identity instead of spoofed body subjects", async () => {
    const identityHeaders = {
      "content-type": "application/json",
      "x-visitor-id": "visitor_phase15_route_owner",
      "x-member-id": "member_phase15_route_owner"
    };

    const loginResponse = await loginPost(
      new Request("http://local/api/mini-program/login", {
        method: "POST",
        headers: identityHeaders,
        body: JSON.stringify({
          code: "wx_code_phase15_identity",
          visitor_id: "visitor_phase15_body_spoof",
          channel: "mini_program",
          campaign: "route_identity"
        })
      })
    );
    const login = await loginResponse.json();

    const linkResponse = await linkMemberPost(
      new Request("http://local/api/mini-program/link-member", {
        method: "POST",
        headers: identityHeaders,
        body: JSON.stringify({
          visitor_id: "visitor_phase15_body_spoof",
          member_id: "member_phase15_body_spoof",
          openid_hash: login.binding.openid_hash
        })
      })
    );
    const link = await linkResponse.json();

    const subscribeResponse = await subscribePost(
      new Request("http://local/api/mini-program/subscribe", {
        method: "POST",
        headers: identityHeaders,
        body: JSON.stringify({
          member_id: "member_phase15_body_spoof",
          template_type: "daily_stargarden_reminder",
          template_id: "tmpl_daily_identity",
          consent_granted: true,
          channel: "mini_program"
        })
      })
    );
    const subscribe = await subscribeResponse.json();

    const reminderResponse = await reminderEventPost(
      new Request("http://local/api/mini-program/reminder-event", {
        method: "POST",
        headers: identityHeaders,
        body: JSON.stringify({
          member_id: "member_phase15_body_spoof",
          template_type: "daily_stargarden_reminder",
          target_date: "2027-08-16",
          action: "daily_reminder_queued"
        })
      })
    );
    const reminder = await reminderResponse.json();

    expect(loginResponse.status).toBe(201);
    expect(login.session.visitor_id).toBe("visitor_phase15_route_owner");
    expect(login.session.member_id).toBe("member_phase15_route_owner");
    expect(linkResponse.status).toBe(201);
    expect(link.binding.visitor_id).toBe("visitor_phase15_route_owner");
    expect(link.binding.member_id).toBe("member_phase15_route_owner");
    expect(subscribeResponse.status).toBe(201);
    expect(subscribe.consent.member_id).toBe("member_phase15_route_owner");
    expect(getSubscribeConsentRecord("member_phase15_route_owner", "daily_stargarden_reminder")).toBeDefined();
    expect(reminderResponse.status).toBe(201);
    expect(reminder.event.member_id).toBe("member_phase15_route_owner");
    expect(listMiniProgramReminderEvents().filter((event) => event.member_id === "member_phase15_route_owner")).toHaveLength(1);
  });
});
