import { describe, expect, test } from "vitest";
import { POST as shareCreatePost } from "../src/app/api/share/create/route.js";
import { GET as wechatJssdkGet } from "../src/app/api/wechat/jssdk/route.js";

describe("WeChat JS-SDK route", () => {
  test("returns readiness blockers when credentials are not configured", async () => {
    const response = await wechatJssdkGet(new Request("https://ziwei.example/api/wechat/jssdk?url=https%3A%2F%2Fziwei.example%2Fshare%2Fmissing"));
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.ready).toBe(false);
    expect(payload.blockers).toContain("WECHAT_JS_SDK_APP_ID is required for WeChat browser sharing.");
    expect(JSON.stringify(payload)).not.toMatch(/jsapi_ticket|ticket_for_test|secret/i);
  });

  test("returns signed redacted share metadata for a valid snapshot", async () => {
    const shareResponse = await shareCreatePost(
      new Request("https://ziwei.example/api/share/create", {
        method: "POST",
        body: JSON.stringify({
          source_type: "chart_summary",
          source_id: "chart_route_wechat",
          title: "分享标题 2000-08-16",
          summary: "出生时间 03:30，地点 上海。",
          keywords: ["紫微斗数"],
          safety_flags: ["privacy_redaction_required"]
        })
      })
    );
    const share = await shareResponse.json();
    const originalEnv = {
      appId: process.env.WECHAT_JS_SDK_APP_ID,
      ticket: process.env.WECHAT_JS_SDK_TICKET,
      enabled: process.env.WECHAT_JS_SDK_ENABLED,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL
    };

    process.env.WECHAT_JS_SDK_APP_ID = "wx_route_app";
    process.env.WECHAT_JS_SDK_TICKET = "ticket_for_route";
    process.env.WECHAT_JS_SDK_ENABLED = "true";
    process.env.NEXT_PUBLIC_SITE_URL = "https://ziwei.example";
    try {
      const response = await wechatJssdkGet(
        new Request(`https://ziwei.example/api/wechat/jssdk?url=https%3A%2F%2Fziwei.example${encodeURIComponent(share.share_url)}&share_id=${share.snapshot.share_id}`)
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.ready).toBe(true);
      expect(payload.config.appId).toBe("wx_route_app");
      expect(payload.share.link).toBe(`https://ziwei.example${share.share_url}`);
      expect(payload.share.imgUrl).toBe("https://ziwei.example/share-card-preview.png");
      expect(JSON.stringify(payload)).not.toContain("2000-08-16");
      expect(JSON.stringify(payload)).not.toContain("03:30");
      expect(JSON.stringify(payload)).not.toContain("上海");
      expect(JSON.stringify(payload)).not.toContain("ticket_for_route");
    } finally {
      process.env.WECHAT_JS_SDK_APP_ID = originalEnv.appId;
      process.env.WECHAT_JS_SDK_TICKET = originalEnv.ticket;
      process.env.WECHAT_JS_SDK_ENABLED = originalEnv.enabled;
      process.env.NEXT_PUBLIC_SITE_URL = originalEnv.siteUrl;
    }
  });
});
