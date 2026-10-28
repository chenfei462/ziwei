import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findActiveSmsVerificationChallengeByPhoneHashAsync: vi.fn(),
  getUserAsync: vi.fn(),
  getChartOwnerAsync: vi.fn(),
  saveAnonymousLinkAsync: vi.fn(),
  saveAnonymousVisitorAsync: vi.fn(),
  saveChartOwnerAsync: vi.fn(),
  saveSmsVerificationChallengeAsync: vi.fn(),
  saveUserAsync: vi.fn()
}));

vi.mock("../src/repositories/productRepository.js", () => ({
  productRepository: {
    findActiveSmsVerificationChallengeByPhoneHashAsync: mocks.findActiveSmsVerificationChallengeByPhoneHashAsync,
    getUserAsync: mocks.getUserAsync,
    getChartOwnerAsync: mocks.getChartOwnerAsync,
    saveAnonymousLinkAsync: mocks.saveAnonymousLinkAsync,
    saveAnonymousVisitorAsync: mocks.saveAnonymousVisitorAsync,
    saveChartOwnerAsync: mocks.saveChartOwnerAsync,
    saveSmsVerificationChallengeAsync: mocks.saveSmsVerificationChallengeAsync,
    saveUserAsync: mocks.saveUserAsync
  }
}));

import { loginWithSmsVerification, requestSmsVerification } from "../src/accountAuth.js";
import { POST as memberLinkPost } from "../src/app/api/member/link-anonymous/route.js";
import { clearChannelForTests, saveChartOwnerRecord } from "../src/store.js";

describe("account repository boundary", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }
    clearChannelForTests();
    process.env.SMS_PROVIDER = "mock_sms";
    process.env.SMS_ACCESS_KEY = "ak_test";
    process.env.SMS_TEMPLATE_ID = "SMS_123";
    process.env.SMS_TEST_FIXED_CODE = "246810";
    process.env.SESSION_SECRET = "session_secret_at_least_32_chars";
  });

  afterEach(() => {
    delete process.env.SMS_PROVIDER;
    delete process.env.SMS_ACCESS_KEY;
    delete process.env.SMS_TEMPLATE_ID;
    delete process.env.SMS_TEST_FIXED_CODE;
    delete process.env.SESSION_SECRET;
    clearChannelForTests();
    vi.restoreAllMocks();
  });

  test("persists SMS challenges through the repository boundary", async () => {
    await requestSmsVerification({ phone: "13800138000" });

    expect(mocks.saveSmsVerificationChallengeAsync).toHaveBeenCalledTimes(1);
    expect(mocks.saveSmsVerificationChallengeAsync.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        provider: "mock_sms",
        delivery_status: "mock_sent",
        phone_hash: expect.stringMatching(/^sha256:/),
        code_hash: expect.stringMatching(/^sha256:/)
      })
    );
  });

  test("persists SMS account binding and forces migrated chart ownership to the member", async () => {
    saveChartOwnerRecord({
      chart_id: "chart_sms_repo",
      visitor_id: "visitor_sms_repo",
      created_at: "2026-06-01T00:00:00.000Z"
    });
    mocks.findActiveSmsVerificationChallengeByPhoneHashAsync.mockResolvedValue({
      challenge_id: "sms_challenge_repo",
      phone_hash: expect.stringMatching(/^sha256:/),
      code_hash: "sha256:0b87880bc394b45ed04e9a4e9deb9161f70baca7ebe3d45fbc84d87ca4fc50c2",
      provider: "mock_sms",
      template_id: "SMS_123",
      purpose: "login",
      attempt_count: 0,
      max_attempts: 5,
      created_at: "2026-06-01T00:00:01.000Z",
      expires_at: "2026-06-01T00:05:01.000Z",
      delivery_status: "mock_sent",
      privacy_note: "raw phone number and verification code are never stored; only sha256 hashes are persisted."
    });
    mocks.getChartOwnerAsync.mockResolvedValue({
      chart_id: "chart_sms_repo",
      visitor_id: "visitor_sms_repo",
      created_at: "2026-06-01T00:00:00.000Z"
    });

    const result = await loginWithSmsVerification({
      phone: "13800138000",
      code: "246810",
      visitor_id: "visitor_sms_repo",
      member_id: "member_sms_repo"
    });

    expect(result.migrated.chart_ids).toEqual(["chart_sms_repo"]);
    expect(mocks.saveAnonymousLinkAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        visitor_id: "visitor_sms_repo",
        member_id: "member_sms_repo"
      })
    );
    expect(mocks.saveChartOwnerAsync).toHaveBeenCalledWith({
      chart_id: "chart_sms_repo",
      member_id: "member_sms_repo",
      created_at: "2026-06-01T00:00:00.000Z"
    });
    expect(mocks.saveChartOwnerAsync.mock.calls[0]?.[0]).not.toHaveProperty("visitor_id");
  });

  test("persists direct anonymous member linking through the repository boundary", async () => {
    saveChartOwnerRecord({
      chart_id: "chart_direct_link_repo",
      visitor_id: "visitor_direct_link_repo",
      created_at: "2026-06-01T00:00:00.000Z"
    });
    mocks.getChartOwnerAsync.mockResolvedValue({
      chart_id: "chart_direct_link_repo",
      visitor_id: "visitor_direct_link_repo",
      created_at: "2026-06-01T00:00:00.000Z"
    });

    const response = await memberLinkPost(
      new Request("https://ziwei.example/api/member/link-anonymous", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-visitor-id": "visitor_direct_link_repo",
          "x-member-id": "member_direct_link_repo"
        },
        body: JSON.stringify({
          openid_placeholder: "wx_placeholder"
        })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.migrated.chart_ids).toEqual(["chart_direct_link_repo"]);
    expect(mocks.saveUserAsync).toHaveBeenCalledWith(expect.objectContaining({ member_id: "member_direct_link_repo" }));
    expect(mocks.saveAnonymousVisitorAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        visitor_id: "visitor_direct_link_repo",
        upgraded_member_id: "member_direct_link_repo"
      })
    );
    expect(mocks.saveAnonymousLinkAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        visitor_id: "visitor_direct_link_repo",
        member_id: "member_direct_link_repo"
      })
    );
    expect(mocks.saveUserAsync).toHaveBeenCalledTimes(1);
    expect(mocks.saveAnonymousVisitorAsync).toHaveBeenCalledTimes(1);
    expect(mocks.saveChartOwnerAsync).toHaveBeenCalledWith({
      chart_id: "chart_direct_link_repo",
      member_id: "member_direct_link_repo",
      created_at: "2026-06-01T00:00:00.000Z"
    });
  });
});
