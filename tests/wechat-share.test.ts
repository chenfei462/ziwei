import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { createShareLandingSnapshot } from "../src/phase13/growth.js";
import { resolveLaunchPaymentConfig } from "../src/phase10/launchOps.js";
import { buildWechatJssdkConfig, resolveWechatJssdkReadiness } from "../src/wechatShare.js";

describe("WeChat JS-SDK share readiness", () => {
  test("reports blockers until app id, ticket, site url, and enabled flag are configured", () => {
    const readiness = resolveWechatJssdkReadiness({
      appId: "",
      jsapiTicket: "",
      siteUrl: "",
      enabled: false
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.requiredEnv).toEqual([
      "WECHAT_JS_SDK_APP_ID",
      "WECHAT_JS_SDK_TICKET",
      "NEXT_PUBLIC_SITE_URL",
      "WECHAT_JS_SDK_ENABLED"
    ]);
    expect(readiness.blockers).toEqual([
      "WECHAT_JS_SDK_APP_ID is required for WeChat browser sharing.",
      "WECHAT_JS_SDK_TICKET is required for JS-SDK signature generation.",
      "NEXT_PUBLIC_SITE_URL is required to build canonical share links.",
      "WECHAT_JS_SDK_ENABLED=true is required before exposing signed JS-SDK config."
    ]);
  });

  test("builds a signed config with redacted share metadata and canonical URL", () => {
    const share = createShareLandingSnapshot({
      source_type: "chart_summary",
      source_id: "chart_wechat_share",
      title: "命盘摘要 2000-08-16",
      summary: "出生时间 03:30，地点 上海，仅供自我观察。",
      keywords: ["紫微斗数", "自我观察"],
      safety_flags: ["privacy_redaction_required"]
    });
    const timestamp = 1_779_721_234;
    const nonceStr = "nonce_for_unit_test";
    const url = "https://ziwei.example/share/demo?from=wechat#wechat_redirect";
    const expectedSignature = createHash("sha1")
      .update(`jsapi_ticket=ticket_for_test&noncestr=${nonceStr}&timestamp=${timestamp}&url=https://ziwei.example/share/demo?from=wechat`)
      .digest("hex");

    const config = buildWechatJssdkConfig({
      appId: "wx_test_app",
      jsapiTicket: "ticket_for_test",
      siteUrl: "https://ziwei.example",
      enabled: true,
      url,
      share: share.snapshot,
      timestamp,
      nonceStr
    });

    expect(config.ready).toBe(true);
    expect(config.config.signature).toBe(expectedSignature);
    expect(config.config.appId).toBe("wx_test_app");
    expect(config.config.jsApiList).toEqual(["updateAppMessageShareData", "updateTimelineShareData"]);
    expect(config.share.link).toBe("https://ziwei.example/share/demo?from=wechat");
    expect(config.share.imgUrl).toBe("https://ziwei.example/share-card-preview.png");
    expect(config.share.title).not.toContain("2000-08-16");
    expect(config.share.desc).not.toContain("03:30");
    expect(config.share.desc).not.toContain("上海");
    expect(config.privacy.hides_full_birth_date).toBe(true);
  });

  test("exposes WeChat share readiness in launch gates without leaking the jsapi ticket", () => {
    const originalEnv = {
      appId: process.env.WECHAT_JS_SDK_APP_ID,
      ticket: process.env.WECHAT_JS_SDK_TICKET,
      enabled: process.env.WECHAT_JS_SDK_ENABLED,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL
    };

    process.env.WECHAT_JS_SDK_APP_ID = "wx_launch_app";
    process.env.WECHAT_JS_SDK_TICKET = "ticket_for_launch_gate";
    process.env.WECHAT_JS_SDK_ENABLED = "true";
    process.env.NEXT_PUBLIC_SITE_URL = "https://ziwei.example";
    try {
      const config = resolveLaunchPaymentConfig();

      expect(config.wechat_share?.ready).toBe(true);
      expect(config.wechat_share?.jsApiList).toEqual(["updateAppMessageShareData", "updateTimelineShareData"]);
      expect(JSON.stringify(config.wechat_share)).not.toContain("ticket_for_launch_gate");
    } finally {
      process.env.WECHAT_JS_SDK_APP_ID = originalEnv.appId;
      process.env.WECHAT_JS_SDK_TICKET = originalEnv.ticket;
      process.env.WECHAT_JS_SDK_ENABLED = originalEnv.enabled;
      process.env.NEXT_PUBLIC_SITE_URL = originalEnv.siteUrl;
    }
  });
});
