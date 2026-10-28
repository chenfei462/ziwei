import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  buildLogoutCookieHeaders,
  buildMemberCookieHeader,
  buildVisitorCookieHeader,
  buildTrustedIdentityHeaders,
  getRequestIdentity,
  resolveLoginProviderReadiness
} from "../src/auth.js";
import { POST as logoutPost } from "../src/app/api/account/logout/route.js";
import { POST as createChartPost } from "../src/app/api/chart/create/route.js";
import { GET as chartGet } from "../src/app/api/chart/[id]/route.js";
import { POST as sendSmsPost } from "../src/app/api/account/sms/send/route.js";
import { POST as loginSmsPost } from "../src/app/api/account/sms/login/route.js";
import { clearChannelForTests, clearChartsForTests, getSmsVerificationChallengeRecord, getUserRecord } from "../src/store.js";

const birthProfile = {
  display_name: "短信登录用户",
  calendar_type: "gregorian",
  birth_date: "2000-08-16",
  birth_time: "03:30",
  timezone: "Asia/Shanghai",
  location: {
    name: "上海",
    longitude: 121.4737,
    latitude: 31.2304
  },
  is_leap_month: false,
  true_solar_time_enabled: false,
  gender_rule: "traditional_male"
};

describe("formal account provider readiness", () => {
  beforeEach(() => {
    clearChannelForTests();
    clearChartsForTests();
    delete process.env.SMS_PROVIDER;
    delete process.env.SMS_ACCESS_KEY;
    delete process.env.SMS_TEMPLATE_ID;
    delete process.env.SMS_TEST_FIXED_CODE;
    delete process.env.SMS_HTTP_ENDPOINT;
    delete process.env.SMS_HTTP_SIGNING_SECRET;
    delete process.env.SESSION_SECRET;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    delete process.env.SMS_PROVIDER;
    delete process.env.SMS_ACCESS_KEY;
    delete process.env.SMS_TEMPLATE_ID;
    delete process.env.SMS_TEST_FIXED_CODE;
    delete process.env.SMS_HTTP_ENDPOINT;
    delete process.env.SMS_HTTP_SIGNING_SECRET;
    delete process.env.SESSION_SECRET;
    vi.restoreAllMocks();
  });

  test("sets HttpOnly session cookies with explicit expiry and secure production attributes", () => {
    process.env.SESSION_SECRET = "session_secret_at_least_32_characters_long";
    const visitorCookie = buildVisitorCookieHeader("visitor_cookie", { secure: true });
    const memberCookie = buildMemberCookieHeader("member_cookie", { secure: true });

    expect(visitorCookie).toContain("zv_visitor_id=visitor_cookie");
    expect(visitorCookie).toContain("HttpOnly");
    expect(visitorCookie).toContain("SameSite=Lax");
    expect(visitorCookie).toContain("Secure");
    expect(visitorCookie).toContain("Max-Age=15552000");
    expect(memberCookie).toContain("zv_member_id=member_cookie");
    expect(memberCookie).toContain("Secure");
  });

  test("signs session cookies when SESSION_SECRET is configured and rejects tampered cookie values", () => {
    process.env.SESSION_SECRET = "session_secret_at_least_32_chars";
    const cookie = buildMemberCookieHeader("member_signed", { secure: true });
    const cookieValue = /zv_member_id=([^;]+)/.exec(cookie)?.[1] ?? "";
    const decodedValue = decodeURIComponent(cookieValue);
    const tamperedCookie = cookie.replace("member_signed", "member_attacker");

    expect(decodedValue).toMatch(/^member_signed\.[a-f0-9]{64}$/);
    expect(getRequestIdentity(new Request("https://ziwei.example/member", { headers: { cookie } })).memberId).toBe("member_signed");
    expect(getRequestIdentity(new Request("https://ziwei.example/member", { headers: { cookie: tamperedCookie } })).memberId).toBeUndefined();
  });

  test("ignores unsigned identity headers in production and accepts signed gateway identity headers", () => {
    const previousSecret = process.env.TRUSTED_IDENTITY_HEADER_SECRET;
    const previousSessionSecret = process.env.SESSION_SECRET;
    process.env.TRUSTED_IDENTITY_HEADER_SECRET = "trusted_identity_header_secret_at_least_32_chars";
    process.env.SESSION_SECRET = "session_secret_at_least_32_characters_long";
    const cookie = buildVisitorCookieHeader("visitor_cookie_owner", { secure: true });
    const unsignedIdentity = getRequestIdentity(
      new Request("https://ziwei.example/chart/chart_1", {
        headers: {
          cookie,
          "x-visitor-id": "visitor_header_attacker",
          "x-member-id": "member_header_attacker"
        }
      }),
      { nodeEnv: "production" }
    );
    const signedHeaders = buildTrustedIdentityHeaders({
      visitorId: "visitor_gateway",
      memberId: "member_gateway",
      secret: process.env.TRUSTED_IDENTITY_HEADER_SECRET,
      timestampSeconds: 1_800_000_000
    });
    const signedIdentity = getRequestIdentity(
      new Request("https://ziwei.example/chart/chart_1", {
        headers: {
          cookie,
          ...signedHeaders
        }
      }),
      { nodeEnv: "production", nowSeconds: 1_800_000_030 }
    );

    try {
      expect(unsignedIdentity).toEqual({ visitorId: "visitor_cookie_owner", memberId: undefined });
      expect(signedIdentity).toEqual({ visitorId: "visitor_gateway", memberId: "member_gateway" });
    } finally {
      process.env.TRUSTED_IDENTITY_HEADER_SECRET = previousSecret;
      process.env.SESSION_SECRET = previousSessionSecret;
    }
  });

  test("ignores query identity spoofing in production", () => {
    const previousSecret = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "session_secret_at_least_32_characters_long";
    const cookie = buildVisitorCookieHeader("visitor_query_owner", { secure: true });
    const identity = getRequestIdentity(
      new Request("https://ziwei.example/chart/chart_1?visitor_id=visitor_query_attacker&member_id=member_query_attacker", {
        headers: { cookie }
      }),
      { nodeEnv: "production" }
    );

    expect(identity).toEqual({ visitorId: "visitor_query_owner", memberId: undefined });
    process.env.SESSION_SECRET = previousSecret;
  });

  test("builds logout cookies that expire visitor and member sessions", () => {
    const headers = buildLogoutCookieHeaders({ secure: true });

    expect(headers).toHaveLength(2);
    expect(headers[0]).toContain("zv_visitor_id=;");
    expect(headers[0]).toContain("Max-Age=0");
    expect(headers[0]).toContain("HttpOnly");
    expect(headers[1]).toContain("zv_member_id=;");
    expect(headers[1]).toContain("Secure");
  });

  test("reports SMS and WeChat login as blocked until external providers are configured", () => {
    const readiness = resolveLoginProviderReadiness({
      smsProvider: "",
      smsAccessKey: "",
      smsTemplateId: "",
      smsHttpEndpoint: "",
      smsHttpSigningSecret: "",
      wechatAppId: "",
      wechatSecret: "",
      sessionSecret: ""
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.providers.sms.ready).toBe(false);
    expect(readiness.providers.wechat_web.ready).toBe(false);
    expect(readiness.blockers).toContain("SMS_PROVIDER, SMS_ACCESS_KEY, and SMS_TEMPLATE_ID are required for phone verification login.");
    expect(readiness.blockers).toContain("WECHAT_APP_ID and WECHAT_APP_SECRET are required for WeChat login.");
    expect(readiness.blockers).toContain("SESSION_SECRET is required before enabling formal login sessions.");
  });

  test("keeps http SMS login blocked until the signed gateway is configured", () => {
    const readiness = resolveLoginProviderReadiness({
      smsProvider: "http_sms",
      smsAccessKey: "ak_test",
      smsTemplateId: "SMS_123",
      smsHttpEndpoint: "",
      smsHttpSigningSecret: "",
      wechatAppId: "wx123",
      wechatSecret: "secret",
      sessionSecret: "session_secret_at_least_32_chars"
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.providers.sms.provider).toBe("http_sms");
    expect(readiness.providers.sms.ready).toBe(false);
    expect(readiness.providers.sms.requiredEnv).toEqual([
      "SMS_PROVIDER",
      "SMS_ACCESS_KEY",
      "SMS_TEMPLATE_ID",
      "SMS_HTTP_ENDPOINT",
      "SMS_HTTP_SIGNING_SECRET"
    ]);
    expect(readiness.blockers).toContain("SMS_HTTP_ENDPOINT and SMS_HTTP_SIGNING_SECRET are required for http_sms delivery.");
  });

  test("reports formal login readiness when HTTP SMS, WeChat, and session secrets are configured", () => {
    const readiness = resolveLoginProviderReadiness({
      smsProvider: "http_sms",
      smsAccessKey: "ak_test",
      smsTemplateId: "SMS_123",
      smsHttpEndpoint: "https://sms-gateway.example/send",
      smsHttpSigningSecret: "sms_http_signing_secret_at_least_32_chars",
      wechatAppId: "wx123",
      wechatSecret: "secret",
      sessionSecret: "session_secret_at_least_32_chars"
    });

    expect(readiness.ready).toBe(true);
    expect(readiness.providers.sms.provider).toBe("http_sms");
    expect(readiness.providers.sms.ready).toBe(true);
    expect(readiness.providers.wechat_web.ready).toBe(true);
    expect(readiness.blockers).toEqual([]);
  });

  test("logout route clears HttpOnly visitor and member cookies", async () => {
    const response = await logoutPost(new Request("https://example.com/api/account/logout", { method: "POST" }));
    const body = await response.json();
    const setCookie = response.headers.getSetCookie ? response.headers.getSetCookie() : [response.headers.get("set-cookie") ?? ""];

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(setCookie.join("\n")).toContain("zv_visitor_id=;");
    expect(setCookie.join("\n")).toContain("zv_member_id=;");
    expect(setCookie.join("\n")).toContain("Max-Age=0");
    expect(setCookie.join("\n")).toContain("HttpOnly");
  });

  test("sends SMS verification without exposing the phone number or code", async () => {
    configureMockSms();

    const response = await sendSmsPost(
      new Request("https://ziwei.example/api/account/sms/send", {
        method: "POST",
        body: JSON.stringify({
          phone: "13800138000"
        })
      })
    );
    const body = await response.json();
    const challenge = getSmsVerificationChallengeRecord(body.challenge_id);

    expect(response.status).toBe(202);
    expect(body.masked_phone).toBe("138****8000");
    expect(body.delivery.provider).toBe("mock_sms");
    expect(challenge?.phone_hash).toMatch(/^sha256:/);
    expect(challenge?.code_hash).toMatch(/^sha256:/);
    expect(challenge?.attempt_count).toBe(0);
    expect(JSON.stringify({ body, challenge })).not.toContain("13800138000");
    expect(JSON.stringify({ body, challenge })).not.toContain("246810");
  });

  test("sends production SMS through a signed HTTP gateway without returning the code", async () => {
    configureHttpSms();
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(JSON.stringify({ message_id: "sms_msg_prod_001" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });

    const response = await sendSmsPost(
      new Request("https://ziwei.example/api/account/sms/send", {
        method: "POST",
        body: JSON.stringify({
          phone: "13800138000"
        })
      })
    );
    const body = await response.json();
    const requestBody = JSON.parse(String(requests[0]?.init?.body ?? "{}")) as Record<string, unknown>;
    const challenge = getSmsVerificationChallengeRecord(body.challenge_id);

    expect(response.status).toBe(202);
    expect(body.delivery).toMatchObject({
      provider: "http_sms",
      status: "sent",
      external_delivery_required: true,
      message_id: "sms_msg_prod_001"
    });
    expect(requests[0]?.url).toBe("https://sms-gateway.example/send");
    expect(requests[0]?.init?.headers).toMatchObject({
      "content-type": "application/json",
      "x-ziwei-sms-provider": "http_sms"
    });
    expect(String((requests[0]?.init?.headers as Record<string, string>)["x-ziwei-sms-signature"])).toMatch(/^sha256=/);
    expect(requestBody.phone).toBe("13800138000");
    expect(requestBody.template_id).toBe("SMS_FORMAL_LOGIN");
    expect(requestBody.code).toMatch(/^\d{6}$/);
    expect(challenge?.delivery_status).toBe("sent");
    expect(JSON.stringify({ body, challenge })).not.toContain(String(requestBody.code));
    expect(JSON.stringify({ body, challenge })).not.toContain("13800138000");
  });

  test("fails closed when production SMS gateway delivery fails", async () => {
    configureHttpSms();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "provider_down" }), {
        status: 502,
        headers: { "content-type": "application/json" }
      })
    );

    const response = await sendSmsPost(
      new Request("https://ziwei.example/api/account/sms/send", {
        method: "POST",
        body: JSON.stringify({
          phone: "13800138000"
        })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toMatchObject({ code: "SMS_DELIVERY_FAILED", field: "provider" });
    expect(JSON.stringify(body)).not.toContain("13800138000");
  });

  test("logs in with SMS code, sets HttpOnly member cookie, and migrates anonymous charts", async () => {
    configureMockSms();
    const chartResponse = await createChartPost(
      new Request("https://ziwei.example/api/chart/create", {
        method: "POST",
        headers: { "x-visitor-id": "visitor_sms_login" },
        body: JSON.stringify({ birth_profile: birthProfile })
      })
    );
    const chart = await chartResponse.json();

    await sendSmsPost(
      new Request("https://ziwei.example/api/account/sms/send", {
        method: "POST",
        body: JSON.stringify({ phone: "13800138000" })
      })
    );
    const loginResponse = await loginSmsPost(
      new Request("https://ziwei.example/api/account/sms/login", {
        method: "POST",
        headers: { "x-visitor-id": "visitor_sms_login" },
        body: JSON.stringify({
          phone: "13800138000",
          code: "246810",
          display_name: "正式短信用户"
        })
      })
    );
    const login = await loginResponse.json();
    const memberReadResponse = await chartGet(
      new Request(`https://ziwei.example/api/chart/${chart.chart_id}`, {
        headers: { "x-member-id": login.user.member_id }
      }),
      { params: Promise.resolve({ id: chart.chart_id }) }
    );

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.headers.get("set-cookie")).toContain("zv_member_id=");
    expect(login.user.phone_hash).toMatch(/^sha256:/);
    expect(login.user.display_name).toBe("正式短信用户");
    expect(login.migrated.chart_ids).toContain(chart.chart_id);
    expect(getUserRecord(login.user.member_id)?.phone_hash).toBe(login.user.phone_hash);
    expect(memberReadResponse.status).toBe(200);
    expect(JSON.stringify(login)).not.toContain("13800138000");
    expect(JSON.stringify(login)).not.toContain("246810");
  });

  test("rejects an invalid SMS verification code with a typed error", async () => {
    configureMockSms();
    await sendSmsPost(
      new Request("https://ziwei.example/api/account/sms/send", {
        method: "POST",
        body: JSON.stringify({ phone: "13800138000" })
      })
    );

    const response = await loginSmsPost(
      new Request("https://ziwei.example/api/account/sms/login", {
        method: "POST",
        body: JSON.stringify({
          phone: "13800138000",
          code: "000000"
        })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toMatchObject({ code: "SMS_CODE_INVALID", field: "code" });
    expect(JSON.stringify(body)).not.toContain("13800138000");
    expect(JSON.stringify(body)).not.toContain("000000");
  });
});

function configureMockSms(): void {
  process.env.SMS_PROVIDER = "mock_sms";
  process.env.SMS_ACCESS_KEY = "mock_access_key";
  process.env.SMS_TEMPLATE_ID = "SMS_FORMAL_LOGIN";
  process.env.SMS_TEST_FIXED_CODE = "246810";
  process.env.SESSION_SECRET = "session_secret_at_least_32_chars";
}

function configureHttpSms(): void {
  process.env.SMS_PROVIDER = "http_sms";
  process.env.SMS_ACCESS_KEY = "http_access_key";
  process.env.SMS_TEMPLATE_ID = "SMS_FORMAL_LOGIN";
  process.env.SMS_HTTP_ENDPOINT = "https://sms-gateway.example/send";
  process.env.SMS_HTTP_SIGNING_SECRET = "sms_http_signing_secret_at_least_32_chars";
  process.env.SESSION_SECRET = "session_secret_at_least_32_chars";
}
