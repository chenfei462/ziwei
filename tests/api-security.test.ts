import { existsSync, readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { POST as orderCreatePost } from "../src/app/api/order/create/route.js";
import { assertWriteRequestAllowed, clearApiSecurityForTests, resolveRateLimitReadiness } from "../src/apiSecurity.js";

const orderBody = {
  report_id: "report_security",
  package_id: "single_report",
  tier_id: "standard_49",
  consent: {
    agreed: true,
    service_terms: true,
    privacy_policy: true,
    refund_policy: true,
    cultural_entertainment_only: true
  }
};

describe("public API security guards", () => {
  beforeEach(() => {
    clearApiSecurityForTests();
    delete process.env.ZIWEI_RATE_LIMIT_REDIS_REQUIRED;
    delete process.env.ZIWEI_RATE_LIMIT_REDIS_REST_URL;
    delete process.env.ZIWEI_RATE_LIMIT_REDIS_REST_TOKEN;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ZIWEI_RATE_LIMIT_REDIS_REQUIRED;
    delete process.env.ZIWEI_RATE_LIMIT_REDIS_REST_URL;
    delete process.env.ZIWEI_RATE_LIMIT_REDIS_REST_TOKEN;
  });

  test("blocks state-changing browser requests from untrusted origins", async () => {
    const response = await orderCreatePost(
      new Request("http://local/api/order/create", {
        method: "POST",
        headers: {
          origin: "https://evil.example",
          host: "local"
        },
        body: JSON.stringify(orderBody)
      })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toMatchObject({ code: "ORIGIN_FORBIDDEN", field: "origin" });
  });

  test("allows equivalent localhost and loopback origins for local e2e runs", async () => {
    const response = await orderCreatePost(
      new Request("http://localhost/api/order/create", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1:43117",
          host: "localhost"
        },
        body: JSON.stringify(orderBody)
      })
    );
    const body = await response.json();

    expect(response.status).not.toBe(403);
    expect(body.error?.code).not.toBe("ORIGIN_FORBIDDEN");
  });


  test("rate limits repeated state-changing requests with a typed error envelope", async () => {
    let limited: Response | undefined;
    for (let index = 0; index < 70; index += 1) {
      const response = await orderCreatePost(
        new Request("http://local/api/order/create", {
          method: "POST",
          headers: {
            "x-forwarded-for": "198.51.100.77",
            "x-visitor-id": "visitor_rate_limit"
          },
          body: JSON.stringify(orderBody)
        })
      );
      if (response.status === 429) {
        limited = response;
        break;
      }
    }

    expect(limited).toBeDefined();
    const body = await limited?.json();
    expect(body.error).toMatchObject({ code: "RATE_LIMITED", field: "client" });
  });

  test("does not let spoofed visitor or member headers create separate rate-limit buckets", async () => {
    const request = (visitorId: string, memberId: string) =>
      new Request("https://ziwei.example/api/order/create", {
        method: "POST",
        headers: {
          "x-forwarded-for": "198.51.100.78",
          "x-visitor-id": visitorId,
          "x-member-id": memberId
        }
      });

    await assertWriteRequestAllowed(request("attacker_a", "member_a"), { limit: 1, windowMs: 60_000 });
    await expect(assertWriteRequestAllowed(request("attacker_b", "member_b"), { limit: 1, windowMs: 60_000 })).rejects.toMatchObject({
      code: "RATE_LIMITED"
    });
  });

  test("fails closed when production Redis rate limiting is required but not configured", async () => {
    process.env.ZIWEI_RATE_LIMIT_REDIS_REQUIRED = "true";

    const readiness = resolveRateLimitReadiness();

    expect(readiness).toMatchObject({
      provider: "memory",
      ready: false,
      production_required: true,
      requiredEnv: ["ZIWEI_RATE_LIMIT_REDIS_REST_URL", "ZIWEI_RATE_LIMIT_REDIS_REST_TOKEN"]
    });
    expect(readiness.blockers).toEqual(expect.arrayContaining(["Configure Redis REST rate limiting before production traffic."]));
    await expect(
      assertWriteRequestAllowed(
        new Request("https://ziwei.example/api/order/create", {
          method: "POST",
          headers: {
            "x-forwarded-for": "203.0.113.9",
            "x-visitor-id": "visitor_requires_redis"
          }
        })
      )
    ).rejects.toMatchObject({ code: "RATE_LIMIT_REDIS_NOT_CONFIGURED", field: "ZIWEI_RATE_LIMIT_REDIS_REST_URL" });
  });

  test("uses Redis REST rate limiting with hashed keys and no raw visitor identifiers", async () => {
    process.env.ZIWEI_RATE_LIMIT_REDIS_REQUIRED = "true";
    process.env.ZIWEI_RATE_LIMIT_REDIS_REST_URL = "https://redis.example";
    process.env.ZIWEI_RATE_LIMIT_REDIS_REST_TOKEN = "redis_secret_token";
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        fetchCalls.push({ url: String(url), init });
        return new Response(JSON.stringify([{ result: 1 }, { result: 1 }, { result: 60000 }]), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      })
    );

    await assertWriteRequestAllowed(
      new Request("https://ziwei.example/api/order/create", {
        method: "POST",
        headers: {
          "x-forwarded-for": "203.0.113.10",
          "x-visitor-id": "visitor_2000-08-16_0330_shanghai",
          "x-member-id": "member_sensitive_raw"
        }
      }),
      { limit: 3, windowMs: 60_000 }
    );

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]?.url).toBe("https://redis.example/pipeline");
    expect(fetchCalls[0]?.init?.headers).toMatchObject({
      authorization: "Bearer redis_secret_token"
    });
    const body = String(fetchCalls[0]?.init?.body ?? "");
    expect(body).toContain("ziwei:rate:");
    expect(body).not.toContain("visitor_2000-08-16");
    expect(body).not.toContain("member_sensitive_raw");
    expect(body).not.toContain("/api/order/create");
  });

  test("all non-webhook state-changing API route handlers use the write request guard or admin auth", () => {
    const routeFiles = [
      ...findRouteFiles(resolve("src/app/api"))
    ].filter((file) => /route\.tsx?$/.test(file));
    const mutableRouteFiles = routeFiles.filter((file) => /export async function (POST|PATCH|PUT|DELETE)/.test(readFileSync(file, "utf8")));
    const exemptPatterns = [
      /src[\\/]app[\\/]api[\\/]payment[\\/]webhook[\\/]route\.ts$/,
      /src[\\/]app[\\/]api[\\/]ops[\\/]/,
      /src[\\/]app[\\/]api[\\/]support[\\/]ticket[\\/]\[id\][\\/]route\.ts$/
    ];

    const uncovered = mutableRouteFiles
      .filter((file) => !exemptPatterns.some((pattern) => pattern.test(file)))
      .filter((file) => {
        const source = readFileSync(file, "utf8");
        return !/(assertWriteRequestAllowed|readProtectedJson)\(request/.test(source);
      })
      .map((file) => relative(resolve("."), file));

    expect(uncovered).toEqual([]);
  });

  test("public state-changing API routes read JSON through the protected helper", () => {
    const routeFiles = [...findRouteFiles(resolve("src/app/api"))].filter((file) => /route\.tsx?$/.test(file));
    const mutableRouteFiles = routeFiles.filter((file) => /export async function (POST|PATCH|PUT|DELETE)/.test(readFileSync(file, "utf8")));
    const exemptPatterns = [
      /src[\\/]app[\\/]api[\\/]payment[\\/]webhook[\\/]route\.ts$/,
      /src[\\/]app[\\/]api[\\/]ops[\\/]/,
      /src[\\/]app[\\/]api[\\/]support[\\/]ticket[\\/]\[id\][\\/]route\.ts$/
    ];

    const directJsonReaders = mutableRouteFiles
      .filter((file) => !exemptPatterns.some((pattern) => pattern.test(file)))
      .filter((file) => {
        const source = readFileSync(file, "utf8");
        return /request\.json\(\)/.test(source) && !/readProtectedJson\(request/.test(source);
      })
      .map((file) => relative(resolve("."), file));

    expect(directJsonReaders).toEqual([]);
  });
});

function findRouteFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  const entries = readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? findRouteFiles(path) : [path];
  });
}
