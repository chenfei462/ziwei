import { createHash, randomUUID } from "node:crypto";
import { ApiError } from "./errors.js";
import type { DailyPrivacy, ShareLandingSnapshot } from "./types.js";

export type WechatJssdkReadinessInput = {
  appId?: string;
  jsapiTicket?: string;
  siteUrl?: string;
  enabled?: boolean;
};

export type WechatJssdkReadiness = {
  ready: boolean;
  requiredEnv: string[];
  blockers: string[];
};

export type WechatJssdkConfigInput = WechatJssdkReadinessInput & {
  url: string;
  share?: ShareLandingSnapshot;
  timestamp?: number;
  nonceStr?: string;
};

export type WechatJssdkConfigResponse = {
  ready: true;
  config: {
    appId: string;
    timestamp: number;
    nonceStr: string;
    signature: string;
    jsApiList: ["updateAppMessageShareData", "updateTimelineShareData"];
  };
  share: {
    title: string;
    desc: string;
    link: string;
    imgUrl: string;
  };
  privacy: DailyPrivacy;
};

const requiredWechatJssdkEnv = ["WECHAT_JS_SDK_APP_ID", "WECHAT_JS_SDK_TICKET", "NEXT_PUBLIC_SITE_URL", "WECHAT_JS_SDK_ENABLED"];

const privacy: DailyPrivacy = {
  hides_full_birth_date: true,
  hides_birth_time: true,
  hides_location_detail: true,
  stores_video_frame: false,
  stores_full_birth_profile: false
};

export function resolveWechatJssdkReadiness(input: WechatJssdkReadinessInput = {}): WechatJssdkReadiness {
  const appId = input.appId ?? process.env.WECHAT_JS_SDK_APP_ID ?? "";
  const jsapiTicket = input.jsapiTicket ?? process.env.WECHAT_JS_SDK_TICKET ?? "";
  const siteUrl = input.siteUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const enabled = input.enabled ?? process.env.WECHAT_JS_SDK_ENABLED === "true";
  const blockers: string[] = [];

  if (!appId) blockers.push("WECHAT_JS_SDK_APP_ID is required for WeChat browser sharing.");
  if (!jsapiTicket) blockers.push("WECHAT_JS_SDK_TICKET is required for JS-SDK signature generation.");
  if (!siteUrl) blockers.push("NEXT_PUBLIC_SITE_URL is required to build canonical share links.");
  if (!enabled) blockers.push("WECHAT_JS_SDK_ENABLED=true is required before exposing signed JS-SDK config.");

  return {
    ready: blockers.length === 0,
    requiredEnv: requiredWechatJssdkEnv,
    blockers
  };
}

export function buildWechatJssdkConfig(input: WechatJssdkConfigInput): WechatJssdkConfigResponse {
  const appId = input.appId ?? process.env.WECHAT_JS_SDK_APP_ID ?? "";
  const jsapiTicket = input.jsapiTicket ?? process.env.WECHAT_JS_SDK_TICKET ?? "";
  const siteUrl = input.siteUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const readiness = resolveWechatJssdkReadiness({ appId, jsapiTicket, siteUrl, enabled: input.enabled });
  if (!readiness.ready) {
    throw new ApiError("WECHAT_JSSDK_NOT_READY", "WeChat JS-SDK is not configured.", { status: 503 });
  }

  const canonicalUrl = canonicalizeWechatUrl(input.url, siteUrl);
  const timestamp = input.timestamp ?? Math.floor(Date.now() / 1000);
  const nonceStr = input.nonceStr ?? randomUUID().replace(/-/g, "");
  const signature = createHash("sha1")
    .update(`jsapi_ticket=${jsapiTicket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${canonicalUrl}`)
    .digest("hex");
  const link = canonicalUrl;

  return {
    ready: true,
    config: {
      appId,
      timestamp,
      nonceStr,
      signature,
      jsApiList: ["updateAppMessageShareData", "updateTimelineShareData"]
    },
    share: {
      title: sanitizeShareText(input.share?.title ?? "紫微星垣隐私分享"),
      desc: sanitizeShareText(input.share?.summary ?? "隐私友好的紫微斗数自我观察分享。"),
      link,
      imgUrl: new URL("/share-card-preview.png", siteUrl).toString()
    },
    privacy
  };
}

export function canonicalizeWechatUrl(rawUrl: string, siteUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new ApiError("INVALID_WECHAT_SHARE_URL", "url must be an absolute URL.", { field: "url", status: 400 });
  }
  const site = new URL(siteUrl);
  if (parsed.origin !== site.origin) {
    throw new ApiError("WECHAT_SHARE_URL_ORIGIN_FORBIDDEN", "url must use the configured site origin.", { field: "url", status: 403 });
  }
  parsed.hash = "";
  return parsed.toString();
}

function sanitizeShareText(text: string): string {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/g, "[birth_date_redacted]")
    .replace(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g, "[birth_time_redacted]")
    .replace(/\b(?:Shanghai|Beijing|Guangzhou|Shenzhen|Chengdu|Hangzhou|Nanjing|Wuhan)\b|(?:北京|上海|广州|深圳|成都|杭州|南京|武汉)/gi, "[location_redacted]")
    .replace(/data:image\/[a-zA-Z+.-]+;base64,[A-Za-z0-9+/=]+/g, "[image_payload_redacted]");
}
