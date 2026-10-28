import { createHash } from "node:crypto";
import { ApiError } from "./errors.js";
import { getRequestIdentity } from "./auth.js";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export type RateLimitReadiness = {
  provider: "memory" | "redis_rest";
  ready: boolean;
  production_required: boolean;
  requiredEnv: ["ZIWEI_RATE_LIMIT_REDIS_REST_URL", "ZIWEI_RATE_LIMIT_REDIS_REST_TOKEN"];
  blockers: string[];
};

const buckets = new Map<string, RateLimitBucket>();
const defaultWindowMs = 60_000;
const defaultLimit = 60;

export async function assertWriteRequestAllowed(request: Request, options: { limit?: number; windowMs?: number } = {}): Promise<void> {
  assertTrustedOrigin(request);
  await assertRateLimit(request, options);
}

export function clearApiSecurityForTests(): void {
  buckets.clear();
}

export function resolveRateLimitReadiness(): RateLimitReadiness {
  const required = process.env.ZIWEI_RATE_LIMIT_REDIS_REQUIRED === "true";
  const configured = hasRedisRateLimitConfig();
  return {
    provider: configured ? "redis_rest" : "memory",
    ready: configured || !required,
    production_required: required,
    requiredEnv: ["ZIWEI_RATE_LIMIT_REDIS_REST_URL", "ZIWEI_RATE_LIMIT_REDIS_REST_TOKEN"],
    blockers: configured || !required ? [] : ["Configure Redis REST rate limiting before production traffic."]
  };
}

function assertTrustedOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  // Browser state-changing requests must carry an Origin.  In production a
  // missing Origin is ambiguous (and therefore fail-closed); local/test
  // callers may omit it for server-to-server and CLI workflows.
  if (!origin) {
    if (process.env.NODE_ENV === "production") {
      throw new ApiError("ORIGIN_REQUIRED", "origin is required for this state-changing request.", { field: "origin", status: 403 });
    }
    return;
  }
  const requestUrl = new URL(request.url);
  const expected = `${requestUrl.protocol}//${requestUrl.host}`;
  const publicSite = process.env.NEXT_PUBLIC_SITE_URL;
  if (origin === expected || (publicSite && origin === publicSite) || isEquivalentLoopbackOrigin(origin, requestUrl)) return;
  throw new ApiError("ORIGIN_FORBIDDEN", "origin is not allowed for this state-changing request.", { field: "origin", status: 403 });
}

function isEquivalentLoopbackOrigin(origin: string, requestUrl: URL): boolean {
  try {
    const originUrl = new URL(origin);
    if (originUrl.protocol !== requestUrl.protocol) return false;
    return isLoopbackHost(originUrl.hostname) && isLoopbackHost(requestUrl.hostname);
  } catch {
    return false;
  }
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

async function assertRateLimit(request: Request, options: { limit?: number; windowMs?: number }): Promise<void> {
  const limit = options.limit ?? defaultLimit;
  const windowMs = options.windowMs ?? defaultWindowMs;
  if (hasRedisRateLimitConfig()) {
    await assertRedisRateLimit(request, { limit, windowMs });
    return;
  }
  if (process.env.ZIWEI_RATE_LIMIT_REDIS_REQUIRED === "true") {
    throw new ApiError("RATE_LIMIT_REDIS_NOT_CONFIGURED", "production Redis rate limiting is not configured.", {
      field: "ZIWEI_RATE_LIMIT_REDIS_REST_URL",
      status: 503
    });
  }
  const now = Date.now();
  const key = clientKey(request);
  const current = buckets.get(key);
  const bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + windowMs };
  bucket.count += 1;
  buckets.set(key, bucket);
  if (bucket.count > limit) {
    throw new ApiError("RATE_LIMITED", "too many requests, please retry later.", { field: "client", status: 429 });
  }
}

async function assertRedisRateLimit(request: Request, options: { limit: number; windowMs: number }): Promise<void> {
  const url = process.env.ZIWEI_RATE_LIMIT_REDIS_REST_URL?.replace(/\/+$/, "");
  const token = process.env.ZIWEI_RATE_LIMIT_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new ApiError("RATE_LIMIT_REDIS_NOT_CONFIGURED", "production Redis rate limiting is not configured.", {
      field: "ZIWEI_RATE_LIMIT_REDIS_REST_URL",
      status: 503
    });
  }
  const key = `ziwei:rate:${hashRateLimitKey(clientKey(request))}`;
  const response = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify([
      ["INCR", key],
      ["PEXPIRE", key, options.windowMs, "NX"],
      ["PTTL", key]
    ])
  });
  if (!response.ok) {
    throw new ApiError("RATE_LIMIT_REDIS_UNAVAILABLE", "rate limit service is unavailable.", { field: "rate_limit", status: 503 });
  }
  const payload = (await response.json()) as Array<{ result?: unknown; error?: unknown }>;
  const count = Number(payload[0]?.result ?? 0);
  if (!Number.isFinite(count) || payload.some((item) => item?.error)) {
    throw new ApiError("RATE_LIMIT_REDIS_UNAVAILABLE", "rate limit service returned an invalid response.", { field: "rate_limit", status: 503 });
  }
  if (count > options.limit) {
    throw new ApiError("RATE_LIMITED", "too many requests, please retry later.", { field: "client", status: 429 });
  }
}

function clientKey(request: Request): string {
  const identity = getRequestIdentity(request, { nodeEnv: "production" });
  const pathname = new URL(request.url).pathname;
  const trustedIdentity = identity.memberId ?? (identity.visitorId !== "visitor_guest" ? identity.visitorId : undefined);
  return [trustedIdentity, pathname].filter(Boolean).join(":") || `anonymous:${pathname}`;
}

function hasRedisRateLimitConfig(): boolean {
  return Boolean(process.env.ZIWEI_RATE_LIMIT_REDIS_REST_URL?.trim() && process.env.ZIWEI_RATE_LIMIT_REDIS_REST_TOKEN?.trim());
}

function hashRateLimitKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
