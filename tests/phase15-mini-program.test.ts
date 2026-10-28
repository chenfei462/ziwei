import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import {
  createMiniProgramShare,
  getMiniProgramReleaseGate,
  linkMiniProgramMember,
  loginMiniProgram,
  recordMiniProgramReminderEvent,
  subscribeMiniProgramTemplate
} from "../src/phase15/miniProgram.js";
import { clearGrowthForTests, clearMiniProgramForTests } from "../src/store.js";

describe("phase 15 formal mini program launch core", () => {
  beforeEach(() => {
    clearGrowthForTests();
    clearMiniProgramForTests();
  });

  test("logs in with a wechat code, stores only openid hash, and deduplicates repeated binding", () => {
    const first = loginMiniProgram({
      code: "wx_code_phase15_login",
      visitor_id: "visitor_phase15",
      channel: "mini_program",
      campaign: "review_2000-08-16"
    });
    const second = loginMiniProgram({
      code: "wx_code_phase15_login",
      visitor_id: "visitor_phase15",
      channel: "mini_program",
      campaign: "review_2000-08-16"
    });
    const linked = linkMiniProgramMember({
      visitor_id: "visitor_phase15",
      member_id: "member_phase15",
      openid_hash: first.binding.openid_hash
    });

    expect(first.session.channel).toBe("mini_program");
    expect(first.session.openid_binding_status).toBe("new");
    expect(first.binding.openid_hash).toMatch(/^wx_openid_hash_/);
    expect(second.session.openid_binding_status).toBe("reused");
    expect(second.binding.is_duplicate).toBe(true);
    expect(linked.binding.member_id).toBe("member_phase15");
    expect(first.release_gate.review_status).toBe("materials_ready");
    expect(first.release_gate.fallback_to_h5).toBe(true);
    expect(JSON.stringify({ first, second, linked })).not.toMatch(/wx_code_phase15_login|2000-08-16|03:30|Shanghai|data:image/);
  });

  test("creates mini program share payloads with privacy-safe review copy", () => {
    const share = createMiniProgramShare({
      member_id: "member_phase15_share",
      source_type: "daily_theme",
      source_id: "daily_20270816_life",
      title: "Mini card for 2000-08-16",
      summary: "Opened at 03:30 in Shanghai. data:image/png;base64,AAAA",
      keywords: ["Zi Wei", "Hua Lu"],
      safety_flags: ["daily_observation_only"],
      mini_program_share_format: "wechat_mini_card",
      channel: "mini_program",
      campaign: "review_share",
      visitor_id: "visitor_phase15_share"
    });

    expect(share.mini_program_share.share_format).toBe("wechat_mini_card");
    expect(share.mini_program_share.path).toContain("pages/index/index");
    expect(share.mini_program_share.qr_payload).toContain("share_id=");
    expect(share.mini_program_share.path).not.toContain("visitor_id=");
    expect(share.share_url).not.toContain("visitor_id=");
    expect(share.mini_program_share.safety_flags).toContain("mini_program_review_required");
    expect(share.snapshot.title).toContain("[birth_date_redacted]");
    expect(share.snapshot.summary).toContain("[birth_time_redacted]");
    expect(share.snapshot.summary).toContain("[location_redacted]");
    expect(share.snapshot.summary).toContain("[image_payload_redacted]");
    expect(JSON.stringify(share)).not.toMatch(/2000-08-16|03:30|Shanghai|data:image/);
  });

  test("records subscription consent and reminder events without sensitive data", () => {
    const login = loginMiniProgram({
      code: "wx_code_phase15_subscribe",
      visitor_id: "visitor_phase15_subscribe",
      channel: "mini_program"
    });
    const consent = subscribeMiniProgramTemplate({
      member_id: login.session.member_id,
      template_type: "daily_stargarden_reminder",
      template_id: "tmpl_daily_phase15",
      consent_granted: true,
      channel: "mini_program"
    });
    const reminder = recordMiniProgramReminderEvent({
      member_id: login.session.member_id,
      template_type: "daily_stargarden_reminder",
      target_date: "2027-08-16",
      action: "daily_reminder_queued",
      metadata: {
        note: "Do not include 2000-08-16 03:30 Shanghai"
      }
    });

    expect(consent.consent.consent_granted).toBe(true);
    expect(consent.consent.template_type).toBe("daily_stargarden_reminder");
    expect(reminder.event.action).toBe("daily_reminder_queued");
    expect(reminder.event.metadata.note).toContain("[birth_date_redacted]");
    expect(reminder.event.metadata.note).toContain("[birth_time_redacted]");
    expect(reminder.event.metadata.note).toContain("[location_redacted]");
    expect(JSON.stringify({ consent, reminder })).not.toMatch(/2000-08-16|03:30|Shanghai|data:image/);
  });

  test("exposes release gate defaults and rejects invalid mini program requests", () => {
    const gate = getMiniProgramReleaseGate();

    expect(gate.release_gate.version).toBe("mini_program_v0.1");
    expect(gate.release_gate.rollout_percent).toBe(10);
    expect(() =>
      loginMiniProgram({
        code: "temporary_code",
        channel: "mini_program"
      })
    ).toThrow(/wechat code is invalid/);
    expect(() =>
      createMiniProgramShare({
        source_type: "daily_theme",
        source_id: "daily_20270816_life",
        title: "Mini card",
        summary: "Mini summary",
        mini_program_share_format: "poster_pdf" as never,
        channel: "mini_program"
      })
    ).toThrow(/mini_program_share_format is invalid/);
  });

  test("mini program shell lands on formal H5 routes without exposing visitor identifiers", () => {
    const appSource = readFileSync(resolve("mini-program/app.js"), "utf8");
    const indexSource = readFileSync(resolve("mini-program/pages/index/index.js"), "utf8");

    expect(appSource).toContain('fallbackPath: "/chart/new"');
    expect(appSource).not.toContain("https://example.com");
    expect(indexSource).toContain("shareId ? `/share/${shareId}` : fallbackPath");
    expect(indexSource).toContain('app.globalData.fallbackPath === "/chart/new"');
    expect(indexSource).toContain("share_id");
    expect(indexSource).not.toMatch(/\/phase1[45]|visitor_id/);
  });
});
