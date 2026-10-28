import { createHmac, timingSafeEqual } from "node:crypto";
import { ApiError } from "./errors.js";
import type { ChartOwnerRecord } from "./repositories/productRepository.js";

export const visitorCookieName = "zv_visitor_id";
export const memberCookieName = "zv_member_id";

export type RequestIdentity = {
  visitorId: string;
  memberId?: string;
};

export type IdentityResolutionOptions = {
  nodeEnv?: string;
  nowSeconds?: number;
};

export type ResolvedRequestIdentity = {
  identity: RequestIdentity;
  shouldSetVisitorCookie: boolean;
};

export type SessionCookieOptions = {
  secure?: boolean;
};

export type LoginProviderReadinessInput = {
  smsProvider?: string;
  smsAccessKey?: string;
  smsTemplateId?: string;
  smsHttpEndpoint?: string;
  smsHttpSigningSecret?: string;
  wechatAppId?: string;
  wechatSecret?: string;
  sessionSecret?: string;
};

export type LoginProviderReadiness = {
  ready: boolean;
  providers: {
    sms: {
      provider: string;
      ready: boolean;
      requiredEnv: string[];
    };
    wechat_web: {
      provider: "wechat_web";
      ready: boolean;
      requiredEnv: string[];
    };
  };
  session: {
    httpOnly: true;
    sameSite: "Lax";
    maxAgeSeconds: number;
    secretConfigured: boolean;
  };
  blockers: string[];
};

const trustedIdentityTimestampToleranceSeconds = 5 * 60;

export function getRequestIdentity(request: Request, options: IdentityResolutionOptions = {}): RequestIdentity {
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
  const trustedHeaderIdentity = readTrustedIdentityHeaders(request.headers, options.nowSeconds);
  if (trustedHeaderIdentity) return trustedHeaderIdentity;
  if (nodeEnv === "production") {
    return normalizeIdentity({
      visitorId: readSessionCookie(request.headers.get("cookie"), visitorCookieName),
      memberId: readSessionCookie(request.headers.get("cookie"), memberCookieName)
    });
  }
  const url = new URL(request.url);
  return normalizeIdentity({
    visitorId: request.headers.get("x-visitor-id") ?? url.searchParams.get("visitor_id") ?? readSessionCookie(request.headers.get("cookie"), visitorCookieName),
    memberId: request.headers.get("x-member-id") ?? url.searchParams.get("member_id") ?? readSessionCookie(request.headers.get("cookie"), memberCookieName)
  });
}

export function getOrCreateRequestIdentity(request: Request, options: IdentityResolutionOptions = {}): ResolvedRequestIdentity {
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
  const trustedHeaderIdentity = readTrustedIdentityHeaders(request.headers, options.nowSeconds);
  if (trustedHeaderIdentity) {
    return {
      identity: trustedHeaderIdentity,
      shouldSetVisitorCookie: false
    };
  }
  if (nodeEnv === "production") {
    const explicitVisitorId = readSessionCookie(request.headers.get("cookie"), visitorCookieName);
    const generatedVisitorId = explicitVisitorId ? undefined : createVisitorId();
    return {
      identity: normalizeIdentity({
        visitorId: explicitVisitorId ?? generatedVisitorId,
        memberId: readSessionCookie(request.headers.get("cookie"), memberCookieName)
      }),
      shouldSetVisitorCookie: Boolean(generatedVisitorId)
    };
  }
  const url = new URL(request.url);
  const explicitVisitorId = request.headers.get("x-visitor-id") ?? url.searchParams.get("visitor_id") ?? readSessionCookie(request.headers.get("cookie"), visitorCookieName);
  const generatedVisitorId = explicitVisitorId ? undefined : createVisitorId();
  return {
    identity: normalizeIdentity({
      visitorId: explicitVisitorId ?? generatedVisitorId,
      memberId: request.headers.get("x-member-id") ?? url.searchParams.get("member_id") ?? readSessionCookie(request.headers.get("cookie"), memberCookieName)
    }),
    shouldSetVisitorCookie: Boolean(generatedVisitorId)
  };
}

export function normalizeIdentity(input: { visitorId?: string; memberId?: string } = {}): RequestIdentity {
  return {
    visitorId: sanitizeIdentity(input.visitorId) || "visitor_guest",
    memberId: sanitizeIdentity(input.memberId) || undefined
  };
}

export function identityFromSessionCookieValues(input: { visitorCookie?: string; memberCookie?: string }): RequestIdentity {
  return normalizeIdentity({
    visitorId: readSessionCookieValue(input.visitorCookie, visitorCookieName),
    memberId: readSessionCookieValue(input.memberCookie, memberCookieName)
  });
}

export function assertCanReadChart(owner: ChartOwnerRecord | undefined, identity: RequestIdentity): void {
  // A missing owner is an authorization failure, never an invitation to
  // continue.  Treating an unknown chart as public creates an IDOR fail-open
  // path whenever the backing store is stale or unavailable.
  if (!owner) {
    throw new ApiError("CHART_ACCESS_FORBIDDEN", "你无权访问该命盘。", { field: "chart_id", status: 403 });
  }
  if (owner.member_id && identity.memberId && owner.member_id === identity.memberId) return;
  if (owner.visitor_id && owner.visitor_id === identity.visitorId) return;
  throw new ApiError("CHART_ACCESS_FORBIDDEN", "你无权访问该命盘。", { field: "chart_id", status: 403 });
}

export async function assertCanReadChartAsync(owner: Promise<ChartOwnerRecord | undefined>, identity: RequestIdentity): Promise<void> {
  assertCanReadChart(await owner, identity);
}

export function getCommerceSubjectId(identity: RequestIdentity): string {
  return identity.memberId ?? identity.visitorId;
}

export function buildVisitorCookieHeader(visitorId: string, options: SessionCookieOptions = {}): string {
  const maxAge = 60 * 60 * 24 * 180;
  return buildSessionCookie(visitorCookieName, sanitizeIdentity(visitorId), maxAge, options);
}

export function buildMemberCookieHeader(memberId: string, options: SessionCookieOptions = {}): string {
  const maxAge = 60 * 60 * 24 * 180;
  return buildSessionCookie(memberCookieName, sanitizeIdentity(memberId), maxAge, options);
}

export function buildLogoutCookieHeaders(options: SessionCookieOptions = {}): string[] {
  return [
    buildSessionCookie(visitorCookieName, "", 0, options),
    buildSessionCookie(memberCookieName, "", 0, options)
  ];
}

export function buildTrustedIdentityHeaders(input: {
  visitorId?: string;
  memberId?: string;
  secret?: string;
  timestampSeconds?: number;
}): Record<string, string> {
  const visitorId = sanitizeIdentity(input.visitorId) || "visitor_guest";
  const memberId = sanitizeIdentity(input.memberId);
  const timestamp = String(input.timestampSeconds ?? Math.floor(Date.now() / 1000));
  const payload = trustedIdentityPayload(visitorId, memberId, timestamp);
  const secret = input.secret ?? getTrustedIdentityHeaderSecret();
  if (!secret) {
    throw new Error("TRUSTED_IDENTITY_HEADER_SECRET is required to sign trusted identity headers.");
  }
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  return {
    "x-trusted-visitor-id": visitorId,
    ...(memberId ? { "x-trusted-member-id": memberId } : {}),
    "x-trusted-identity-timestamp": timestamp,
    "x-trusted-identity-signature": `sha256=${signature}`
  };
}

export function resolveLoginProviderReadiness(input: LoginProviderReadinessInput = {}): LoginProviderReadiness {
  const smsProvider = input.smsProvider ?? process.env.SMS_PROVIDER ?? "";
  const smsAccessKey = input.smsAccessKey ?? process.env.SMS_ACCESS_KEY ?? "";
  const smsTemplateId = input.smsTemplateId ?? process.env.SMS_TEMPLATE_ID ?? "";
  const smsHttpEndpoint = input.smsHttpEndpoint ?? process.env.SMS_HTTP_ENDPOINT ?? "";
  const smsHttpSigningSecret = input.smsHttpSigningSecret ?? process.env.SMS_HTTP_SIGNING_SECRET ?? "";
  const wechatAppId = input.wechatAppId ?? process.env.WECHAT_APP_ID ?? "";
  const wechatSecret = input.wechatSecret ?? process.env.WECHAT_APP_SECRET ?? "";
  const sessionSecret = input.sessionSecret ?? process.env.SESSION_SECRET ?? "";
  const smsBaseReady = Boolean(smsProvider && smsAccessKey && smsTemplateId);
  const smsHttpReady = smsProvider === "http_sms" ? Boolean(smsHttpEndpoint && smsHttpSigningSecret) : true;
  const smsSupported = smsProvider === "mock_sms" || smsProvider === "http_sms";
  const smsReady = smsBaseReady && smsHttpReady && smsSupported;
  const wechatReady = Boolean(wechatAppId && wechatSecret);
  const sessionReady = sessionSecret.length >= 24;
  const blockers: string[] = [];

  if (!smsBaseReady) {
    blockers.push("SMS_PROVIDER, SMS_ACCESS_KEY, and SMS_TEMPLATE_ID are required for phone verification login.");
  }
  if (smsBaseReady && !smsSupported) {
    blockers.push("SMS_PROVIDER must be mock_sms or http_sms.");
  }
  if (smsProvider === "http_sms" && !smsHttpReady) {
    blockers.push("SMS_HTTP_ENDPOINT and SMS_HTTP_SIGNING_SECRET are required for http_sms delivery.");
  }
  if (!wechatReady) {
    blockers.push("WECHAT_APP_ID and WECHAT_APP_SECRET are required for WeChat login.");
  }
  if (!sessionReady) {
    blockers.push("SESSION_SECRET is required before enabling formal login sessions.");
  }

  return {
    ready: smsReady && wechatReady && sessionReady,
    providers: {
      sms: {
        provider: smsProvider || "unconfigured",
        ready: smsReady,
        requiredEnv:
          smsProvider === "http_sms"
            ? ["SMS_PROVIDER", "SMS_ACCESS_KEY", "SMS_TEMPLATE_ID", "SMS_HTTP_ENDPOINT", "SMS_HTTP_SIGNING_SECRET"]
            : ["SMS_PROVIDER", "SMS_ACCESS_KEY", "SMS_TEMPLATE_ID"]
      },
      wechat_web: {
        provider: "wechat_web",
        ready: wechatReady,
        requiredEnv: ["WECHAT_APP_ID", "WECHAT_APP_SECRET"]
      }
    },
    session: {
      httpOnly: true,
      sameSite: "Lax",
      maxAgeSeconds: 60 * 60 * 24 * 180,
      secretConfigured: sessionReady
    },
    blockers
  };
}

function readCookie(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey !== name) continue;
    return decodeURIComponent(rawValue.join("="));
  }
  return undefined;
}

function readTrustedIdentityHeaders(headers: Headers, nowSeconds = Math.floor(Date.now() / 1000)): RequestIdentity | undefined {
  const secret = getTrustedIdentityHeaderSecret();
  if (!secret) return undefined;
  const visitorId = sanitizeIdentity(headers.get("x-trusted-visitor-id") ?? undefined);
  const memberId = sanitizeIdentity(headers.get("x-trusted-member-id") ?? undefined);
  const timestamp = headers.get("x-trusted-identity-timestamp") ?? "";
  const signatureHeader = headers.get("x-trusted-identity-signature") ?? "";
  if (!visitorId || !timestamp || !signatureHeader.startsWith("sha256=")) return undefined;
  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds) || Math.abs(nowSeconds - timestampSeconds) > trustedIdentityTimestampToleranceSeconds) return undefined;
  const signature = signatureHeader.slice("sha256=".length);
  if (!isValidTrustedIdentitySignature(visitorId, memberId, timestamp, signature, secret)) return undefined;
  return normalizeIdentity({ visitorId, memberId });
}

function readSessionCookie(cookieHeader: string | null, name: string): string | undefined {
  const value = readCookie(cookieHeader, name);
  return readSessionCookieValue(value, name);
}

function readSessionCookieValue(value: string | undefined, _name: string): string | undefined {
  if (!value) return undefined;
  const sessionSecret = getSessionSecret();
  // Never trust an unsigned cookie.  A missing SESSION_SECRET must fail
  // closed; otherwise an attacker can mint arbitrary member/visitor cookies.
  if (!sessionSecret) return undefined;
  const separatorIndex = value.lastIndexOf(".");
  if (separatorIndex <= 0) return undefined;
  const unsignedValue = value.slice(0, separatorIndex);
  const signature = value.slice(separatorIndex + 1);
  if (!isValidSessionSignature(unsignedValue, signature, sessionSecret)) return undefined;
  return sanitizeIdentity(unsignedValue);
}

function isValidTrustedIdentitySignature(visitorId: string, memberId: string, timestamp: string, signature: string, secret: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(trustedIdentityPayload(visitorId, memberId, timestamp)).digest("hex");
  return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
}

function trustedIdentityPayload(visitorId: string, memberId: string | undefined, timestamp: string): string {
  return JSON.stringify({
    visitor_id: sanitizeIdentity(visitorId),
    member_id: sanitizeIdentity(memberId) || "",
    timestamp
  });
}

function createVisitorId(): string {
  return `visitor_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

function buildSessionCookie(name: string, value: string, maxAge: number, options: SessionCookieOptions): string {
  const cookieValue = value && maxAge > 0 ? signSessionCookieValue(value) : value;
  return [
    `${name}=${encodeURIComponent(cookieValue)}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "SameSite=Lax",
    options.secure ? "Secure" : ""
  ]
    .filter(Boolean)
    .join("; ");
}

function signSessionCookieValue(value: string): string {
  const unsignedValue = sanitizeIdentity(value);
  const sessionSecret = getSessionSecret();
  if (!sessionSecret) throw new Error("SESSION_SECRET is required before issuing session cookies.");
  return `${unsignedValue}.${createSessionSignature(unsignedValue, sessionSecret)}`;
}

function createSessionSignature(value: string, sessionSecret: string): string {
  return createHmac("sha256", sessionSecret).update(value).digest("hex");
}

function isValidSessionSignature(value: string, signature: string, sessionSecret: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = createSessionSignature(value, sessionSecret);
  return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
}

function getSessionSecret(): string | undefined {
  const value = process.env.SESSION_SECRET?.trim() ?? "";
  return value.length >= 24 ? value : undefined;
}

function getTrustedIdentityHeaderSecret(): string | undefined {
  const value = process.env.TRUSTED_IDENTITY_HEADER_SECRET?.trim() ?? "";
  return value.length >= 24 ? value : undefined;
}

function sanitizeIdentity(value: string | undefined): string {
  return String(value ?? "")
    .replace(/[^a-zA-Z0-9_:-]/g, "")
    .slice(0, 80);
}
