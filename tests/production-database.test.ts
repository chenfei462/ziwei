import { existsSync, readFileSync } from "node:fs";
import { describe, expect, test, vi } from "vitest";
import {
  getRequiredProductionDatabaseTables,
  resolveBirthDataEncryptionReadiness,
  resolveProductRepositoryMode,
  resolveProductionDatabaseReadiness,
  sanitizeDatabaseUrlForLogs
} from "../src/repositories/productionDatabase.js";
import { createLazyProductRepository, createProductRepository } from "../src/repositories/productRepository.js";
import { resolveLaunchPaymentConfig } from "../src/phase10/launchOps.js";
import type { BirthProfile, ChartCreateResponse, ExportPreview } from "../src/types.js";

describe("production PostgreSQL delivery surface", () => {
  test("ships a Prisma schema and SQL migration for all formal delivery entities", () => {
    expect(existsSync("prisma/schema.prisma")).toBe(true);
    expect(existsSync("prisma/migrations/20260525000100_china_market_delivery/migration.sql")).toBe(true);
    expect(existsSync("scripts/migrate-phase-store-to-postgres.ts")).toBe(true);

    const schema = readFileSync("prisma/schema.prisma", "utf8");
    const migration = readFileSync("prisma/migrations/20260525000100_china_market_delivery/migration.sql", "utf8");
    const migrateScript = readFileSync("scripts/migrate-phase-store-to-postgres.ts", "utf8");

    for (const table of getRequiredProductionDatabaseTables()) {
      expect(schema).toContain(`@@map("${table}")`);
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }

    expect(schema).toMatch(/provider\s*=\s*"postgresql"/);
    expect(migration).toContain("CREATE EXTENSION IF NOT EXISTS pgcrypto");
    expect(getRequiredProductionDatabaseTables()).toContain("checkout_sessions");
    expect(migration).toContain("CREATE INDEX IF NOT EXISTS idx_orders_member_status");
    expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_events_provider_event");
    for (const bucket of [
      "users",
      "anonymous-visitors",
      "anonymous-links",
      "sms-verification-challenges",
      "share-landings",
      "support-tickets",
      "data-deletion-requests",
      "wechat-openid-bindings",
      "charts",
      "chart-owners",
      "product-events",
      "orders",
      "checkout-sessions",
      "payment-events",
      "entitlements",
      "admin-audit-logs",
      "reports",
      "report-generation-jobs",
      "export-previews",
      "ai-generation-logs",
      "content-review-records",
      "rule-versions"
    ]) {
      expect(migrateScript).toContain(bucket);
    }
    expect(getRequiredProductionDatabaseTables()).toContain("wechat_openid_bindings");
    expect(schema).toContain("@@map(\"wechat_openid_bindings\")");
    expect(schema).toContain("consentJson");
    expect(schema).toContain("auditTrailJson");
    expect(schema).toContain("model AnonymousLink");
    expect(schema).toContain("providerMessageId");
    expect(schema).toContain("privacyNote");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS anonymous_links");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS wechat_openid_bindings");
    expect(migration).toContain("provider_message_id varchar(120)");
    expect(migration).toContain("consent_json jsonb");
    expect(migration).toContain("audit_trail_json jsonb");
    expect(migration).toContain("privacy_note text");
    expect(schema).toContain("activeDefault");
    expect(migration).toContain("active_default boolean");
    expect(migrateScript).toContain("--dry-run");
    expect(migrateScript).toContain("DATABASE_URL");
  });

  test("does not report production database readiness without a PostgreSQL URL", () => {
    const readiness = resolveProductionDatabaseReadiness({
      databaseUrl: "",
      directUrl: "",
      nodeEnv: "production"
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.mode).toBe("not_configured");
    expect(readiness.blockers).toContain("DATABASE_URL must be a PostgreSQL connection string.");
    expect(JSON.stringify(readiness)).not.toContain("postgres://user:password");
  });

  test("reports production database readiness only when DATABASE_URL is PostgreSQL", () => {
    const readiness = resolveProductionDatabaseReadiness({
      databaseUrl: "postgresql://ziwei:secret@example.neon.tech/ziwei_prod?sslmode=require",
      directUrl: "postgresql://ziwei:secret@example.neon.tech/ziwei_prod?sslmode=require",
      nodeEnv: "production"
    });

    expect(readiness.ready).toBe(true);
    expect(readiness.mode).toBe("postgresql");
    expect(readiness.blockers).toEqual([]);
    expect(readiness.safeDatabaseUrl).toBe("postgresql://ziwei:[redacted]@example.neon.tech/ziwei_prod?sslmode=require");
  });

  test("reports birth data encryption readiness before production chart persistence", () => {
    expect(resolveBirthDataEncryptionReadiness({ encryptionKey: "" })).toMatchObject({
      ready: false,
      algorithm: "aes-256-gcm"
    });
    expect(resolveBirthDataEncryptionReadiness({ encryptionKey: "0123456789abcdef01234567" })).toMatchObject({
      ready: true,
      blockers: []
    });
  });

  test("redacts database credentials before logging or returning config status", () => {
    expect(sanitizeDatabaseUrlForLogs("postgresql://user:pass@db.example.com:5432/app?schema=public")).toBe(
      "postgresql://user:[redacted]@db.example.com:5432/app?schema=public"
    );
    expect(sanitizeDatabaseUrlForLogs("not a url")).toBe("[invalid_database_url]");
  });

  test("exposes database readiness in the launch gate response", () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    const previousDirectUrl = process.env.DIRECT_DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://ops:secret@db.example.com/ziwei";
    process.env.DIRECT_DATABASE_URL = "postgresql://ops:secret@db.example.com/ziwei";

    try {
      const config = resolveLaunchPaymentConfig();

      expect(config.database?.ready).toBe(true);
      expect(config.database?.mode).toBe("postgresql");
      expect(config.database?.safeDatabaseUrl).toBe("postgresql://ops:[redacted]@db.example.com/ziwei");
      expect(config.database?.requiredTables).toContain("payment_events");
      expect(config.birth_data_encryption?.ready).toBe(false);
      expect(config.birth_data_encryption?.requiredEnv).toContain("ZIWEI_BIRTH_DATA_ENCRYPTION_KEY");
    } finally {
      process.env.DATABASE_URL = previousDatabaseUrl;
      process.env.DIRECT_DATABASE_URL = previousDirectUrl;
    }
  });

  test("selects PostgreSQL repository mode when DATABASE_URL is configured", () => {
    const mode = resolveProductRepositoryMode({
      databaseUrl: "postgresql://ziwei:secret@example.neon.tech/ziwei_prod?sslmode=require",
      nodeEnv: "production"
    });

    expect(mode).toMatchObject({
      mode: "postgresql",
      productionReady: true,
      fallbackAllowed: false,
      adapter: "prisma"
    });
    expect(mode.blockers).toEqual([]);
    expect(JSON.stringify(mode)).not.toContain("secret");
  });

  test("fails closed instead of treating the file store as production repository", () => {
    const mode = resolveProductRepositoryMode({
      databaseUrl: "",
      nodeEnv: "production"
    });

    expect(mode).toMatchObject({
      mode: "not_configured",
      productionReady: false,
      fallbackAllowed: false,
      adapter: "none"
    });
    expect(mode.blockers).toContain("DATABASE_URL must be configured before product repositories can run in production.");
  });

  test("allows the file repository for production-built Playwright e2e only with an explicit test-double gate", () => {
    const mode = resolveProductRepositoryMode({
      databaseUrl: "",
      nodeEnv: "production",
      e2eStoreTestDouble: "true"
    });

    expect(mode).toMatchObject({
      mode: "file_store",
      productionReady: false,
      fallbackAllowed: true,
      adapter: "store_test_double"
    });
    expect(mode.blockers).toContain("E2E store test double is enabled; this mode is not production ready.");
  });

  test("defers production repository validation until runtime so Next build can import routes", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    const repository = createLazyProductRepository();

    await expect(repository.getChartOwnerAsync("chart_requires_runtime_db")).rejects.toThrow(
      "DATABASE_URL must be configured before product repositories can run in production."
    );

    vi.unstubAllEnvs();
  });

  test("allows the file repository only for development and automated tests", () => {
    const mode = resolveProductRepositoryMode({
      databaseUrl: "",
      nodeEnv: "test"
    });

    expect(mode).toMatchObject({
      mode: "file_store",
      productionReady: false,
      fallbackAllowed: true,
      adapter: "store_test_double"
    });
    expect(mode.blockers).toEqual([]);
  });

  test("Prisma product repository persists chart ownership, commerce, AI records, and content reviews through the database adapter", async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://ziwei:secret@example.neon.tech/ziwei_prod?sslmode=require";
    const chartOwners = new Map<string, { chartId: string; visitorId: string | null; memberId: string | null; createdAt: Date }>();
    const analyticsEvents: unknown[] = [];
    const auditLogs = new Map<string, unknown>();
    const smsVerificationChallenges = new Map<string, unknown>();
    const orders = new Map<string, unknown>();
    const checkoutSessions = new Map<string, unknown>();
    const paymentEvents = new Map<string, unknown>();
    const providerStatements = new Map<string, unknown>();
    const entitlements = new Map<string, unknown>();
    const reports = new Map<string, unknown>();
    const reportVersions = new Map<string, unknown>();
    const reportGenerationJobs = new Map<string, unknown>();
    const exportPreviews = new Map<string, unknown>();
    const aiGenerationLogs = new Map<string, unknown>();
    const followUpQuotas = new Map<string, unknown>();
    const contentReviewRecords = new Map<string, unknown>();
    const ruleVersions = new Map<string, unknown>();
    const birthProfiles = new Map<string, unknown>();
    const charts = new Map<string, unknown>();
    const refunds = new Map<string, unknown>();
    const repository = createProductRepository({
      birthProfile: {
        async upsert(input) {
          birthProfiles.set(input.where.birthProfileId, { ...input.create, ...input.update });
          return birthProfiles.get(input.where.birthProfileId);
        }
      },
      chart: {
        async findUnique(input) {
          return charts.get(input.where.chartId) ?? null;
        },
        async upsert(input) {
          charts.set(input.where.chartId, { ...input.create, ...input.update });
          return charts.get(input.where.chartId);
        }
      },
      chartOwner: {
        async findUnique(input) {
          return chartOwners.get(input.where.chartId) ?? null;
        },
        async upsert(input) {
          const record = {
            chartId: input.create.chartId,
            visitorId: input.update.visitorId ?? input.create.visitorId ?? null,
            memberId: input.update.memberId ?? input.create.memberId ?? null,
            createdAt: input.create.createdAt ?? new Date()
          };
          chartOwners.set(input.where.chartId, record);
          return record;
        }
      },
      analyticsEvent: {
        async create(input) {
          analyticsEvents.push(input.data);
          return input.data;
        },
        async findMany() {
          return [];
        }
      },
      auditLog: {
        async findMany() {
          return [...auditLogs.values()];
        },
        async upsert(input) {
          auditLogs.set(input.where.auditLogId, { ...input.create, ...input.update });
          return auditLogs.get(input.where.auditLogId);
        }
      },
      user: {
        async findUnique() {
          return null;
        },
        async findMany() {
          return [];
        },
        async upsert(input) {
          return input.create;
        }
      },
      anonymousVisitor: {
        async findUnique() {
          return null;
        },
        async findMany() {
          return [];
        },
        async upsert(input) {
          return input.create;
        }
      },
      anonymousLink: {
        async findUnique() {
          return null;
        },
        async upsert(input) {
          return input.create;
        }
      },
      smsVerificationChallenge: {
        async findUnique(input) {
          return smsVerificationChallenges.get(input.where.challengeId) ?? null;
        },
        async findMany(input) {
          return [...smsVerificationChallenges.values()]
            .filter((record) => {
              const challenge = record as { phoneHash?: string; consumedAt?: Date | null; expiresAt?: Date };
              const where = input?.where;
              return (
                (!where?.phoneHash || challenge.phoneHash === where.phoneHash) &&
                (!("consumedAt" in (where ?? {})) || challenge.consumedAt === where?.consumedAt) &&
                (!where?.expiresAt?.gt || (challenge.expiresAt?.getTime() ?? 0) > where.expiresAt.gt.getTime())
              );
            })
            .sort((left, right) => ((right as { createdAt?: Date }).createdAt?.getTime() ?? 0) - ((left as { createdAt?: Date }).createdAt?.getTime() ?? 0))
            .slice(0, input?.take ?? Number.POSITIVE_INFINITY);
        },
        async upsert(input) {
          smsVerificationChallenges.set(input.where.challengeId, { ...input.create, ...input.update });
          return smsVerificationChallenges.get(input.where.challengeId);
        }
      },
      share: {
        async findUnique() {
          return null;
        },
        async findMany() {
          return [];
        },
        async upsert(input) {
          return input.create;
        }
      },
      supportTicket: {
        async findUnique() {
          return null;
        },
        async findMany() {
          return [];
        },
        async upsert(input) {
          return input.create;
        }
      },
      dataDeletionRequest: {
        async findUnique() {
          return null;
        },
        async findMany() {
          return [];
        },
        async upsert(input) {
          return input.create;
        }
      },
      wechatOpenIdBinding: {
        async findUnique() {
          return null;
        },
        async upsert(input) {
          return input.create;
        }
      },
      order: {
        async findUnique(input) {
          return orders.get(input.where.orderId) ?? null;
        },
        async findMany(input) {
          return [...orders.values()].filter((order) => {
            const memberId = input?.where?.memberId;
            return memberId ? (order as { memberId?: string }).memberId === memberId : true;
          });
        },
        async upsert(input) {
          orders.set(input.where.orderId, { ...input.create, ...input.update });
          return orders.get(input.where.orderId);
        }
      },
      checkoutSession: {
        async findUnique(input) {
          return checkoutSessions.get(input.where.checkoutSessionId) ?? null;
        },
        async findFirst(input) {
          return [...checkoutSessions.values()].find(
            (session) => (session as { orderId?: string }).orderId === input.where.orderId
          ) ?? null;
        },
        async upsert(input) {
          checkoutSessions.set(input.where.checkoutSessionId, { ...input.create, ...input.update });
          return checkoutSessions.get(input.where.checkoutSessionId);
        }
      },
      paymentEvent: {
        async findUnique(input) {
          return paymentEvents.get(input.where.paymentEventId) ?? null;
        },
        async findMany() {
          return [...paymentEvents.values()];
        },
        async create(input) {
          paymentEvents.set(input.data.paymentEventId, input.data);
          return input.data;
        }
      },
      providerStatement: {
        async findMany() {
          return [...providerStatements.values()];
        },
        async upsert(input) {
          providerStatements.set(input.where.statementId, { ...input.create, ...input.update });
          return providerStatements.get(input.where.statementId);
        }
      },
      refund: {
        async findUnique(input) {
          return refunds.get(input.where.refundId) ?? null;
        },
        async findMany(input) {
          return [...refunds.values()].filter((refund) => {
            const orderId = input?.where?.orderId;
            return orderId ? (refund as { orderId?: string }).orderId === orderId : true;
          });
        },
        async upsert(input) {
          refunds.set(input.where.refundId, { ...input.create, ...input.update });
          return refunds.get(input.where.refundId);
        }
      },
      entitlement: {
        async findUnique(input) {
          const key = `${input.where.memberId_reportId.memberId}:${input.where.memberId_reportId.reportId}`;
          return entitlements.get(key) ?? null;
        },
        async findMany(input) {
          return [...entitlements.values()].filter((entitlement) => {
            const memberId = input?.where?.memberId;
            return memberId ? (entitlement as { memberId?: string }).memberId === memberId : true;
          });
        },
        async upsert(input) {
          const key = `${input.where.memberId_reportId.memberId}:${input.where.memberId_reportId.reportId}`;
          entitlements.set(key, { ...input.create, ...input.update });
          return entitlements.get(key);
        }
      },
      report: {
        async findUnique(input) {
          return reports.get(input.where.reportId) ?? null;
        },
        async findMany(input) {
          return [...reports.values()].filter((record) => {
            const report = record as { memberId?: string; chartId?: string; status?: string };
            const where = input?.where;
            return (!where?.memberId || report.memberId === where.memberId) && (!where?.chartId || report.chartId === where.chartId) && (!where?.status || report.status === where.status);
          });
        },
        async upsert(input) {
          reports.set(input.where.reportId, { ...input.create, ...input.update });
          return reports.get(input.where.reportId);
        }
      },
      reportVersion: {
        async findFirst(input) {
          return [...reportVersions.values()].find(
            (record) => (record as { reportId?: string }).reportId === input.where.reportId
          ) ?? null;
        },
        async upsert(input) {
          const key = `${input.where.reportId_version.reportId}:${input.where.reportId_version.version}`;
          reportVersions.set(key, { ...input.create, ...input.update });
          return reportVersions.get(key);
        }
      },
      reportGenerationJob: {
        async findUnique(input) {
          return reportGenerationJobs.get(input.where.jobId) ?? null;
        },
        async findMany(input) {
          return [...reportGenerationJobs.values()].filter((record) => {
            const job = record as { memberId?: string; visitorId?: string; status?: string };
            const where = input?.where;
            return (!where?.memberId || job.memberId === where.memberId) && (!where?.visitorId || job.visitorId === where.visitorId) && (!where?.status || job.status === where.status);
          });
        },
        async upsert(input) {
          reportGenerationJobs.set(input.where.jobId, { ...input.create, ...input.update });
          return reportGenerationJobs.get(input.where.jobId);
        }
      },
      exportPreview: {
        async findUnique(input) {
          return exportPreviews.get(input.where.exportPreviewId) ?? null;
        },
        async findMany() {
          return [...exportPreviews.values()];
        },
        async upsert(input) {
          exportPreviews.set(input.where.exportPreviewId, { ...input.create, ...input.update });
          return exportPreviews.get(input.where.exportPreviewId);
        }
      },
      aiGenerationLog: {
        async findUnique(input) {
          return aiGenerationLogs.get(input.where.generationId) ?? null;
        },
        async findMany(input) {
          return [...aiGenerationLogs.values()].filter((record) => {
            const reportId = input?.where?.reportId;
            const chartId = input?.where?.chartId;
            return (!reportId || (record as { reportId?: string }).reportId === reportId) && (!chartId || (record as { chartId?: string }).chartId === chartId);
          });
        },
        async upsert(input) {
          aiGenerationLogs.set(input.where.generationId, { ...input.create, ...input.update });
          return aiGenerationLogs.get(input.where.generationId);
        }
      },
      followUpQuota: {
        async findUnique(input) {
          return followUpQuotas.get(input.where.quotaKey) ?? null;
        },
        async upsert(input) {
          const existing = followUpQuotas.get(input.where.quotaKey) as Record<string, unknown> | undefined;
          const updateUsed = input.update.used;
          const nextUsed =
            typeof updateUsed === "object" && updateUsed !== null && "increment" in updateUsed
              ? Number(existing?.used ?? 0) + updateUsed.increment
              : Number(updateUsed ?? existing?.used ?? input.create.used);
          const next = existing
            ? { ...existing, ...input.update, used: nextUsed }
            : { ...input.create, used: nextUsed };
          followUpQuotas.set(input.where.quotaKey, next);
          return next;
        }
      },
      contentReviewRecord: {
        async findUnique(input) {
          return contentReviewRecords.get(input.where.reviewId) ?? null;
        },
        async findMany(input) {
          return [...contentReviewRecords.values()].filter((record) => {
            const status = input?.where?.status;
            const sourceType = input?.where?.sourceType;
            const sourceId = input?.where?.sourceId;
            return (
              (!status || (record as { status?: string }).status === status) &&
              (!sourceType || (record as { sourceType?: string }).sourceType === sourceType) &&
              (!sourceId || (record as { sourceId?: string }).sourceId === sourceId)
            );
          });
        },
        async upsert(input) {
          contentReviewRecords.set(input.where.reviewId, { ...input.create, ...input.update });
          return contentReviewRecords.get(input.where.reviewId);
        }
      },
      ruleVersion: {
        async findFirst(input) {
          return [...ruleVersions.values()].find((record) => {
            const ruleVersion = record as { activeDefault?: boolean; status?: string };
            return (
              (input?.where?.activeDefault === undefined || ruleVersion.activeDefault === input.where.activeDefault) &&
              (!input?.where?.status || ruleVersion.status === input.where.status)
            );
          }) ?? null;
        },
        async upsert(input) {
          ruleVersions.set(input.where.ruleVersionId, { ...input.create, ...input.update });
          return ruleVersions.get(input.where.ruleVersionId);
        }
      }
    });

    try {
      chartOwners.set("chart_db_owner", {
        chartId: "chart_db_owner",
        visitorId: "visitor_db_owner",
        memberId: "member_db_owner",
        createdAt: new Date("2026-06-01T00:00:00.000Z")
      });
      const owner = await repository.getChartOwnerAsync("chart_db_owner");
      await repository.saveProductEventAsync({
        product_event_id: "product_event_db",
        type: "chart_completed",
        created_at: "2026-06-01T00:00:01.000Z",
        visitor_id: "visitor_db_owner",
        member_id: "member_db_owner",
        chart_id: "chart_db_owner",
        metadata: {},
        privacy_note: "product analytics never store full birth date, birth time, location detail, or image payload."
      });
      await repository.saveAdminAuditLogAsync({
        audit_log_id: "audit_log_db",
        actor_id: "ops_admin_db",
        actor_role: "ops_admin",
        action: "ops_sensitive_record_revealed",
        target_type: "chart",
        target_id: "chart_db_owner",
        metadata: {
          reason: "review [birth_date_redacted] [birth_time_redacted] [location_redacted]",
          second_confirmed: true
        },
        created_at: "2026-06-01T00:00:01.100Z",
        privacy_note: "Admin audit logs store actor, action, target, and redacted metadata only."
      });
      const storedAuditLogs = await repository.listAdminAuditLogsAsync();
      await repository.saveSmsVerificationChallengeAsync({
        challenge_id: "sms_challenge_db",
        phone_hash: "sha256:phone_db",
        code_hash: "sha256:code_db",
        provider: "mock_sms",
        template_id: "SMS_LOGIN",
        purpose: "login",
        attempt_count: 0,
        max_attempts: 5,
        created_at: "2026-06-01T00:00:01.200Z",
        expires_at: "2026-06-01T00:05:01.200Z",
        delivery_status: "mock_sent",
        provider_message_id: "msg_db",
        privacy_note: "raw phone number and verification code are never stored; only sha256 hashes are persisted."
      });
      const storedSmsChallenge = await repository.getSmsVerificationChallengeAsync("sms_challenge_db");
      const activeSmsChallenge = await repository.findActiveSmsVerificationChallengeByPhoneHashAsync(
        "sha256:phone_db",
        "2026-06-01T00:01:00.000Z"
      );
      await repository.saveOrderAsync({
        order_id: "order_db",
        report_id: "report_db",
        member_id: "member_db_owner",
        package_id: "single_report",
        tier_id: "standard_49",
        report_type: "single_chart",
        amount_cents: 4900,
        currency: "cny",
        status: "created",
        payment_provider: "wechat_pay_reserved",
        created_at: "2026-06-01T00:00:02.000Z",
        updated_at: "2026-06-01T00:00:02.000Z",
        compliance: {
          service_terms_accepted: true,
          privacy_policy_accepted: true,
          refund_policy_accepted: true,
          cultural_entertainment_only: true
        },
        privacy: {
          stores_full_birth_date: false,
          stores_birth_time: false,
          stores_location_detail: false,
          stores_video_frame: false
        }
      });
      await repository.saveCheckoutSessionAsync({
        checkout_session_id: "cs_db",
        order_id: "order_db",
        provider: "wechat_pay_reserved",
        provider_mode: "sandbox",
        checkout_url: "/commercial/checkout-sandbox?session_id=cs_db",
        status: "open",
        created_at: "2026-06-01T00:00:03.000Z",
        expires_at: "2026-06-02T00:00:03.000Z",
        provider_requirements: {
          webhook_secret_env: "WECHAT_PAY_API_V3_KEY",
          signature_header: "wechatpay-signature",
          idempotency_key_source: "provider_event_id"
        }
      });
      const storedOrder = await repository.getOrderAsync("order_db");
      const storedSession = await repository.findCheckoutSessionByOrderAsync("order_db");
      await repository.savePaymentEventAsync({
        payment_event_id: "wechat_pay_reserved:wx_evt_db",
        provider: "wechat_pay_reserved",
        event_type: "checkout.session.completed",
        checkout_session_id: "cs_db",
        order_id: "order_db",
        received_at: "2026-06-01T00:00:04.000Z",
        signature_verified: true,
        is_duplicate: false,
        order: storedOrder!
      });
      await repository.saveProviderStatementAsync({
        statement_id: "provider_statement_db",
        provider: "wechat_pay_reserved",
        period_start: "2026-06-01",
        period_end: "2026-06-01",
        imported_at: "2026-06-01T00:00:04.500Z",
        imported_by: "ops_admin:finance",
        row_count: 1,
        rows: [
          {
            provider_transaction_id: "wx_bill_row_db",
            order_id: "order_db",
            type: "payment",
            amount_cents: 4900,
            occurred_at: "2026-06-01T00:00:04.000Z",
            raw_reference_digest: "b".repeat(64)
          }
        ],
        privacy_note: "Provider statement stores finance metadata and raw reference digest only."
      });
      await repository.saveMemberEntitlementAsync({
        entitlement_id: "ent_db",
        member_id: "member_db_owner",
        report_id: "report_db",
        source_order_id: "order_db",
        tier_id: "standard_49",
        access_level: "standard_report",
        benefits: ["full_report_read", "export_preview", "favorite_report"],
        has_access: true,
        can_read_report: true,
        export_preview_credits: 3,
        favorite_enabled: true,
        created_at: "2026-06-01T00:00:05.000Z",
        privacy_note: "full birth date, birth time, and location detail hidden by default."
      });
      await repository.saveRefundRecordAsync({
        refund_id: "refund_db_provider_request",
        order_id: "order_db",
        provider: "wechat_pay_reserved",
        amount_cents: 1900,
        status: "requested",
        reason: "provider refund request metadata only",
        requested_by: "ops_admin:finance",
        ticket_id: "ticket_db_refund",
        provider_refund_request: {
          provider: "wechat_pay_reserved",
          method: "POST",
          endpoint: "/v3/refund/domestic/refunds",
          idempotency_key: "refund:refund_db_provider_request",
          signature_algorithm: "WECHATPAY2-SHA256-RSA2048",
          signed_payload_digest: "a".repeat(64),
          submission_status: "external_configuration_required",
          requiredEnv: ["WECHAT_PAY_MCH_ID", "WECHAT_PAY_PRIVATE_KEY"],
          privacy_note: "Provider refund request stores endpoint, digest, idempotency key, and required env names only."
        },
        created_at: "2026-06-01T00:00:05.500Z",
        updated_at: "2026-06-01T00:00:05.500Z",
        privacy_note: "Refund record stores order/provider finance metadata only; raw birth data is not persisted."
      });
      await repository.saveReportDraftAsync({
        report_id: "report_db",
        report_type: "single_chart",
        mode: "professional",
        report_version: 1,
        rule_profile_id: "classic",
        rule_version: "rules_v2026",
        template_id: "single_chart_report_v0.1",
        template_version: "v0.1",
        title: "紫微斗数观察报告",
        created_at: "2026-06-01T00:00:06.000Z",
        access: {
          policy: "private_paid",
          free_summary_enabled: true,
          required_tier: "standard_49",
          owner_can_read: true,
          entitlement_required_for_private_sections: true
        },
        lineage: {
          report_version_id: "report_db_v1",
          template_id: "single_chart_report_v0.1",
          template_version: "v0.1",
          rule_profile_id: "classic",
          rule_version: "rules_v2026",
          prompt_version: "interpretation_rewrite_v2026_05_25",
          generated_at: "2026-06-01T00:00:06.000Z",
          ai_grounding_policy: "local_rules_trace_only"
        },
        share_summary: {
          visibility: "public_redacted",
          title: "紫微斗数观察报告 摘要",
          summary: "公开分享仅展示脱敏摘要，完整报告需本人权限或付费权益访问。",
          source_section_ids: [],
          safety_flags: ["avoid_absolute_prediction"],
          privacy_note: "full birth date, birth time, and location detail hidden by default."
        },
        export_options: [
          {
            format: "html",
            enabled: true,
            entitlement_required: true,
            storage_provider: "local_preview",
            readiness: "ready"
          },
          {
            format: "pdf",
            enabled: true,
            entitlement_required: true,
            storage_provider: "local_preview",
            readiness: "ready"
          }
        ],
        chart_ref: { chart_id: "chart_db_owner", snapshot_type: "chart" },
        sections: [],
        creator_assets: [],
        review: {
          review_id: "review_for_report_db",
          report_id: "report_db",
          source_type: "report",
          source_id: "report_db",
          status: "approved",
          blocked_terms: [],
          privacy_flags: [],
          safety_flags: [],
          checked_at: "2026-06-01T00:00:06.000Z",
          notes: []
        },
        privacy_note: "report stores redacted chart references and grounded sections.",
        safety_flags: ["avoid_absolute_prediction"],
        price_tier_hint: "standard_49"
      });
      await repository.saveReportGenerationJobAsync({
        job_id: "report_job_db",
        member_id: "member_db_owner",
        report_id: "report_db",
        status: "generated",
        attempt_count: 1,
        max_attempts: 3,
        request_digest: "sha256:report_request",
        request_summary: {
          report_type: "single_chart",
          mode: "professional",
          chart_id: "chart_db_owner"
        },
        created_at: "2026-06-01T00:00:06.500Z",
        updated_at: "2026-06-01T00:00:06.500Z",
        audit_trail: [
          {
            audit_id: "audit_report_job_db",
            action: "report_generation_generated",
            actor_role: "system",
            created_at: "2026-06-01T00:00:06.500Z"
          }
        ],
        privacy_note: "request digest only; raw birth data is not persisted."
      });
      await repository.saveExportPreviewAsync({
        export_preview_id: "export_preview_db",
        report_id: "report_db",
        format: "html",
        preview_url: "/report/report_db?format=html",
        storage: {
          provider: "local_preview",
          object_key: "local-preview/hash.html",
          content_type: "text/html; charset=utf-8",
          private_acl: false,
          signed_url_required: false
        },
        created_at: "2026-06-01T00:00:06.750Z",
        expires_at: "2026-06-02T00:00:06.750Z",
        review_status: "approved",
        order_created: false,
        payment_status: "preview_only",
        privacy_note: "preview only"
      });
      await repository.saveAiGenerationRecordAsync({
        generation_id: "ai_generation_db",
        provider: "local_followup",
        model: "local_trace_v1",
        prompt_version: "followup_prompt_v0.1",
        chart_id: "chart_db_owner",
        report_id: "report_db",
        input_digest: "sha256:input",
        output_digest: "sha256:output",
        status: "generated",
        safety_flags: ["ai_followup_trace_grounded"],
        created_at: "2026-06-01T00:00:06.000Z",
        privacy_note: "raw prompt, question, birth date, birth time, and location are not persisted."
      });
      await repository.saveContentReviewRecordAsync({
        review_id: "review_db",
        report_id: "report_db",
        source_type: "report",
        source_id: "report_db",
        status: "approved",
        blocked_terms: [],
        privacy_flags: ["no_full_birth_date"],
        safety_flags: ["cultural_entertainment_only"],
        checked_at: "2026-06-01T00:00:07.000Z",
        notes: ["metadata only"]
      });
      await repository.saveRuleVersionStateAsync({
        rule_version_id: "rules_v0.2",
        profile_id: "default_ziwei_v0_1",
        label: "Rule table v0.2",
        status: "confirmed",
        active_default: true,
        config: {
          school_id: "default_ziwei_v0_1",
          zi_hour_day_boundary: "civil_midnight",
          leap_month_policy: "same_month_number",
          true_solar_time_policy: "disabled",
          four_transform_policy: "default_stem",
          interpretation_style: "balanced_modern"
        },
        released_at: "2026-04-30T00:00:00.000Z",
        updated_at: "2026-06-01T00:00:08.000Z",
        privacy_note: "rule version state stores rule metadata only; no birth data, prompts, report bodies, or user identifiers."
      });
      const storedPaymentEvent = await repository.getPaymentEventAsync("wechat_pay_reserved:wx_evt_db");
      const storedProviderStatements = await repository.listProviderStatementsAsync();
      const storedEntitlement = await repository.getMemberEntitlementAsync("member_db_owner", "report_db");
      const storedRefund = (await repository.listRefundRecordsAsync("order_db"))[0];
      const storedReport = await repository.getReportDraftAsync("report_db");
      const storedReportJob = await repository.getReportGenerationJobAsync("report_job_db");
      const storedExportPreview = await repository.getExportPreviewAsync("export_preview_db");
      const storedAiRecord = await repository.getAiGenerationRecordAsync("ai_generation_db");
      const storedReviewRecords = await repository.listContentReviewRecordsAsync({ status: "approved", source_type: "report" });
      const storedRuleDefault = await repository.getActiveRuleVersionStateAsync();

      expect(owner).toEqual({
        chart_id: "chart_db_owner",
        visitor_id: "visitor_db_owner",
        member_id: "member_db_owner",
        created_at: "2026-06-01T00:00:00.000Z"
      });
      expect(analyticsEvents).toHaveLength(1);
      expect(storedAuditLogs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            audit_log_id: "audit_log_db",
            action: "ops_sensitive_record_revealed",
            target_type: "chart",
            target_id: "chart_db_owner"
          })
        ])
      );
      expect(JSON.stringify(storedAuditLogs)).not.toContain("2000-08-16");
      expect(storedSmsChallenge?.provider_message_id).toBe("msg_db");
      expect(activeSmsChallenge?.challenge_id).toBe("sms_challenge_db");
      expect(JSON.stringify(storedSmsChallenge)).not.toContain("13800138000");
      expect(storedOrder?.status).toBe("created");
      expect(storedSession?.checkout_session_id).toBe("cs_db");
      expect(storedPaymentEvent?.signature_verified).toBe(true);
      expect(storedProviderStatements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            statement_id: "provider_statement_db",
            provider: "wechat_pay_reserved",
            row_count: 1,
            rows: expect.arrayContaining([
              expect.objectContaining({
                provider_transaction_id: "wx_bill_row_db",
                raw_reference_digest: "b".repeat(64)
              })
            ])
          })
        ])
      );
      expect(JSON.stringify(storedProviderStatements)).not.toMatch(/2000-08-16|03:30|Shanghai|openid/);
      expect(storedEntitlement?.has_access).toBe(true);
      expect(storedEntitlement?.tier_id).toBe("standard_49");
      expect(storedEntitlement?.access_level).toBe("standard_report");
      expect(storedEntitlement?.benefits).toEqual(expect.arrayContaining(["full_report_read", "export_preview"]));
      expect(storedRefund?.provider_refund_request).toMatchObject({
        provider: "wechat_pay_reserved",
        endpoint: "/v3/refund/domestic/refunds",
        idempotency_key: "refund:refund_db_provider_request",
        signature_algorithm: "WECHATPAY2-SHA256-RSA2048",
        submission_status: "external_configuration_required"
      });
      expect(storedReport?.report_id).toBe("report_db");
      const storedPrismaReport = reports.get("report_db") as { memberId?: string; accessPolicy?: string; shareSummary?: string | null } | undefined;
      expect(storedPrismaReport?.memberId).toBe("member_db_owner");
      expect(storedPrismaReport?.accessPolicy).toBe("private_paid");
      expect(storedPrismaReport?.shareSummary).toContain("公开分享仅展示脱敏摘要");
      const storedPrismaReportVersion = reportVersions.get("report_db:1") as { promptVersion?: string | null; version?: number; generatedAt?: Date } | undefined;
      expect(storedPrismaReportVersion).toMatchObject({
        version: 1,
        promptVersion: "interpretation_rewrite_v2026_05_25"
      });
      expect(storedPrismaReportVersion?.generatedAt?.toISOString()).toBe("2026-06-01T00:00:06.000Z");
      expect(storedReportJob?.status).toBe("generated");
      expect(storedExportPreview?.report_id).toBe("report_db");
      expect(storedExportPreview?.order_created).toBe(false);
      expect(storedExportPreview?.storage?.provider).toBe("local_preview");
      expect(storedAiRecord?.privacy_note).toContain("raw prompt");
      expect(storedReviewRecords).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            review_id: "review_db",
            report_id: "report_db",
            status: "approved"
          })
        ])
      );
      expect(storedRuleDefault).toMatchObject({
        rule_version_id: "rules_v0.2",
        profile_id: "default_ziwei_v0_1",
        active_default: true,
        status: "confirmed"
      });
      expect(JSON.stringify(storedRuleDefault)).not.toMatch(/2000-08-16|03:30|Shanghai|raw_prompt_secret|full_report_body/i);
    } finally {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
  });

  test("Prisma product repository persists account, share, support, deletion, and WeChat identity records through the database adapter", async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://ziwei:secret@example.neon.tech/ziwei_prod?sslmode=require";
    const users = new Map<string, unknown>();
    const anonymousVisitors = new Map<string, unknown>();
    const anonymousLinks = new Map<string, unknown>();
    const smsVerificationChallenges = new Map<string, unknown>();
    const shares = new Map<string, unknown>();
    const supportTickets = new Map<string, unknown>();
    const dataDeletionRequests = new Map<string, unknown>();
    const wechatOpenIdBindings = new Map<string, unknown>();
    const exportPreviews = new Map<string, unknown>();
    const birthProfiles = new Map<string, unknown>();
    const charts = new Map<string, unknown>();
    const refunds = new Map<string, unknown>();
    const providerStatements = new Map<string, unknown>();
    const repository = createProductRepository({
      birthProfile: {
        async upsert(input) {
          birthProfiles.set(input.where.birthProfileId, { ...input.create, ...input.update });
          return birthProfiles.get(input.where.birthProfileId);
        }
      },
      chart: {
        async findUnique(input) {
          return charts.get(input.where.chartId) ?? null;
        },
        async upsert(input) {
          charts.set(input.where.chartId, { ...input.create, ...input.update });
          return charts.get(input.where.chartId);
        }
      },
      chartOwner: {
        async findUnique() {
          return null;
        },
        async upsert() {
          return {};
        }
      },
      analyticsEvent: {
        async create(input) {
          return input.data;
        },
        async findMany() {
          return [];
        }
      },
      auditLog: {
        async findMany() {
          return [];
        },
        async upsert(input) {
          return input.create;
        }
      },
      ruleVersion: {
        async findFirst() {
          return null;
        },
        async upsert(input) {
          return input.create;
        }
      },
      user: {
        async findUnique(input) {
          return users.get(input.where.memberId) ?? null;
        },
        async findMany() {
          return [...users.values()];
        },
        async upsert(input) {
          users.set(input.where.memberId, { ...input.create, ...input.update });
          return users.get(input.where.memberId);
        }
      },
      anonymousVisitor: {
        async findUnique(input) {
          return anonymousVisitors.get(input.where.visitorId) ?? null;
        },
        async findMany() {
          return [...anonymousVisitors.values()];
        },
        async upsert(input) {
          anonymousVisitors.set(input.where.visitorId, { ...input.create, ...input.update });
          return anonymousVisitors.get(input.where.visitorId);
        }
      },
      anonymousLink: {
        async findUnique(input) {
          return anonymousLinks.get(input.where.visitorId) ?? null;
        },
        async upsert(input) {
          anonymousLinks.set(input.where.visitorId, { ...input.create, ...input.update });
          return anonymousLinks.get(input.where.visitorId);
        }
      },
      smsVerificationChallenge: {
        async findUnique(input) {
          return smsVerificationChallenges.get(input.where.challengeId) ?? null;
        },
        async findMany(input) {
          return [...smsVerificationChallenges.values()].filter((record) => {
            const challenge = record as { phoneHash?: string; consumedAt?: Date | null; expiresAt?: Date };
            const where = input?.where;
            return (
              (!where?.phoneHash || challenge.phoneHash === where.phoneHash) &&
              (!("consumedAt" in (where ?? {})) || challenge.consumedAt === where?.consumedAt) &&
              (!where?.expiresAt?.gt || (challenge.expiresAt?.getTime() ?? 0) > where.expiresAt.gt.getTime())
            );
          });
        },
        async upsert(input) {
          smsVerificationChallenges.set(input.where.challengeId, { ...input.create, ...input.update });
          return smsVerificationChallenges.get(input.where.challengeId);
        }
      },
      share: {
        async findUnique(input) {
          return shares.get(input.where.shareId) ?? null;
        },
        async findMany(input) {
          return [...shares.values()].filter((record) => {
            const share = record as { sourceType?: string; sourceId?: string; memberId?: string };
            const where = input?.where;
            return (
              (!where?.sourceType || share.sourceType === where.sourceType) &&
              (!where?.sourceId || share.sourceId === where.sourceId) &&
              (!where?.memberId || share.memberId === where.memberId)
            );
          });
        },
        async upsert(input) {
          shares.set(input.where.shareId, { ...input.create, ...input.update });
          return shares.get(input.where.shareId);
        }
      },
      supportTicket: {
        async findUnique(input) {
          return supportTickets.get(input.where.ticketId) ?? null;
        },
        async findMany(input) {
          return [...supportTickets.values()].filter((record) => {
            const ticket = record as { memberId?: string; status?: string };
            const where = input?.where;
            return (!where?.memberId || ticket.memberId === where.memberId) && (!where?.status || ticket.status === where.status);
          });
        },
        async upsert(input) {
          supportTickets.set(input.where.ticketId, { ...input.create, ...input.update });
          return supportTickets.get(input.where.ticketId);
        }
      },
      dataDeletionRequest: {
        async findUnique(input) {
          return dataDeletionRequests.get(input.where.deletionRequestId) ?? null;
        },
        async findMany(input) {
          return [...dataDeletionRequests.values()].filter((record) => {
            const request = record as { memberId?: string; visitorId?: string; status?: string };
            const where = input?.where;
            return (
              (!where?.memberId || request.memberId === where.memberId) &&
              (!where?.visitorId || request.visitorId === where.visitorId) &&
              (!where?.status || request.status === where.status)
            );
          });
        },
        async upsert(input) {
          dataDeletionRequests.set(input.where.deletionRequestId, { ...input.create, ...input.update });
          return dataDeletionRequests.get(input.where.deletionRequestId);
        }
      },
      wechatOpenIdBinding: {
        async findUnique(input) {
          return wechatOpenIdBindings.get(input.where.openidHash) ?? null;
        },
        async upsert(input) {
          wechatOpenIdBindings.set(input.where.openidHash, { ...input.create, ...input.update });
          return wechatOpenIdBindings.get(input.where.openidHash);
        }
      },
      order: {
        async findUnique() {
          return null;
        },
        async findMany() {
          return [];
        },
        async upsert() {
          return {};
        }
      },
      checkoutSession: {
        async findUnique() {
          return null;
        },
        async findFirst() {
          return null;
        },
        async upsert() {
          return {};
        }
      },
      paymentEvent: {
        async findUnique() {
          return null;
        },
        async findMany() {
          return [];
        },
        async create() {
          return {};
        }
      },
      providerStatement: {
        async findMany() {
          return [...providerStatements.values()];
        },
        async upsert(input) {
          providerStatements.set(input.where.statementId, { ...input.create, ...input.update });
          return providerStatements.get(input.where.statementId);
        }
      },
      refund: {
        async findUnique(input) {
          return refunds.get(input.where.refundId) ?? null;
        },
        async findMany(input) {
          return [...refunds.values()].filter((refund) => {
            const orderId = input?.where?.orderId;
            return orderId ? (refund as { orderId?: string }).orderId === orderId : true;
          });
        },
        async upsert(input) {
          refunds.set(input.where.refundId, { ...input.create, ...input.update });
          return refunds.get(input.where.refundId);
        }
      },
      entitlement: {
        async findUnique() {
          return null;
        },
        async findMany() {
          return [];
        },
        async upsert() {
          return {};
        }
      },
      report: {
        async findUnique() {
          return null;
        },
        async findMany() {
          return [];
        },
        async upsert() {
          return {};
        }
      },
      reportVersion: {
        async findFirst() {
          return null;
        },
        async upsert() {
          return {};
        }
      },
      reportGenerationJob: {
        async findUnique() {
          return null;
        },
        async findMany() {
          return [];
        },
        async upsert() {
          return {};
        }
      },
      exportPreview: {
        async findUnique(input) {
          return exportPreviews.get(input.where.exportPreviewId) ?? null;
        },
        async findMany() {
          return [...exportPreviews.values()];
        },
        async upsert(input) {
          exportPreviews.set(input.where.exportPreviewId, { ...input.create, ...input.update });
          return exportPreviews.get(input.where.exportPreviewId);
        }
      },
      aiGenerationLog: {
        async findUnique() {
          return null;
        },
        async findMany() {
          return [];
        },
        async upsert() {
          return {};
        }
      },
      followUpQuota: {
        async findUnique() {
          return null;
        },
        async upsert() {
          return {};
        }
      },
      contentReviewRecord: {
        async findUnique() {
          return null;
        },
        async findMany() {
          return [];
        },
        async upsert() {
          return {};
        }
      }
    });

    try {
      await repository.saveUserAsync({
        member_id: "member_privacy_db",
        display_name: "已脱敏用户",
        phone_hash: "sha256:phone",
        email_hash: "sha256:email",
        created_at: "2026-06-01T01:00:00.000Z",
        upgraded_from_visitor_id: "visitor_privacy_db",
        privacy_note: "phone and email are stored as hashes only."
      });
      await repository.saveAnonymousVisitorAsync({
        visitor_id: "visitor_privacy_db",
        first_seen_at: "2026-06-01T00:59:00.000Z",
        upgraded_member_id: "member_privacy_db",
        upgraded_at: "2026-06-01T01:00:00.000Z",
        privacy_note: "anonymous visitor id only; no raw birth data stored."
      });
      await repository.saveAnonymousLinkAsync({
        link_id: "link_privacy_db",
        visitor_id: "visitor_privacy_db",
        member_id: "member_privacy_db",
        openid_placeholder: "wx_placeholder_hash",
        linked_at: "2026-06-01T01:00:01.000Z",
        privacy_note: "anonymous visitor, member id, and openid placeholder are linked without sensitive birth data."
      });
      await repository.saveShareLandingSnapshotAsync({
        share_id: "share_privacy_db",
        version: "v0.1",
        source_type: "report_summary",
        source_id: "report_privacy_db",
        title: "分享摘要",
        summary: "脱敏后的报告摘要",
        keywords: ["自我观察"],
        safety_flags: ["no_full_birth_date"],
        created_at: "2026-06-01T01:01:00.000Z",
        privacy_note: "share snapshot excludes full birth date, time, location, name, and paid content."
      });
      await repository.saveSupportTicketAsync({
        ticket_id: "ticket_privacy_db",
        member_id: "member_privacy_db",
        order_id: "order_privacy_db",
        report_id: "report_privacy_db",
        category: "privacy_deletion",
        priority: "high",
        status: "open",
        subject: "申请处理个人数据",
        message: "请协助处理我的数据删除申请。",
        created_at: "2026-06-01T01:02:00.000Z",
        updated_at: "2026-06-01T01:02:00.000Z",
        consent: {
          agreed: true,
          no_sensitive_birth_data: true
        },
        audit_trail: [
          {
            audit_id: "audit_ticket_privacy_db",
            action: "support_ticket_created",
            actor_role: "user",
            actor_id: "member_privacy_db",
            created_at: "2026-06-01T01:02:00.000Z"
          }
        ]
      });
      await repository.saveDataDeletionRequestAsync({
        deletion_request_id: "deletion_privacy_db",
        member_id: "member_privacy_db",
        visitor_id: "visitor_privacy_db",
        ticket_id: "ticket_privacy_db",
        status: "requested",
        scope: "all_personal_data",
        requested_at: "2026-06-01T01:03:00.000Z",
        updated_at: "2026-06-01T01:03:00.000Z",
        audit_trail: [
          {
            audit_id: "audit_deletion_privacy_db",
            action: "data_deletion_requested",
            actor_role: "user",
            actor_id: "member_privacy_db",
            created_at: "2026-06-01T01:03:00.000Z"
          }
        ],
        privacy_note: "deletion workflow stores identifiers and audit metadata only."
      });
      await repository.saveWechatOpenIdBindingAsync({
        binding_id: "wx_binding_privacy_db",
        openid_hash: "sha256:openid",
        visitor_id: "visitor_privacy_db",
        member_id: "member_privacy_db",
        linked_at: "2026-06-01T01:04:00.000Z",
        is_duplicate: false,
        privacy_note: "raw openid is never persisted."
      });

      const storedUser = await repository.getUserAsync("member_privacy_db");
      const storedVisitor = await repository.getAnonymousVisitorAsync("visitor_privacy_db");
      const storedAnonymousLink = await repository.getAnonymousLinkAsync("visitor_privacy_db");
      const storedShare = await repository.getShareLandingSnapshotAsync("share_privacy_db");
      const storedTickets = await repository.listSupportTicketsAsync({ member_id: "member_privacy_db", status: "open" });
      const storedDeletionRequests = await repository.listDataDeletionRequestsAsync({ member_id: "member_privacy_db", status: "requested" });
      const storedWechatBinding = await repository.getWechatOpenIdBindingAsync("sha256:openid");

      expect(storedUser?.phone_hash).toBe("sha256:phone");
      expect(storedVisitor?.upgraded_member_id).toBe("member_privacy_db");
      expect(storedAnonymousLink).toEqual(
        expect.objectContaining({
          link_id: "link_privacy_db",
          visitor_id: "visitor_privacy_db",
          member_id: "member_privacy_db",
          openid_placeholder: "wx_placeholder_hash"
        })
      );
      expect(storedShare?.privacy_note).toContain("excludes full birth date");
      expect(storedTickets[0]?.consent.no_sensitive_birth_data).toBe(true);
      expect(storedDeletionRequests[0]?.audit_trail[0]?.action).toBe("data_deletion_requested");
      expect(storedWechatBinding).toEqual(
        expect.objectContaining({
          binding_id: "wx_binding_privacy_db",
          openid_hash: "sha256:openid",
          member_id: "member_privacy_db",
          is_duplicate: false
        })
      );
    } finally {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
  });

  test("uses the generated Prisma client automatically when production DATABASE_URL is configured", async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    vi.stubEnv("DATABASE_URL", "postgresql://ziwei:secret@example.neon.tech/ziwei_prod?sslmode=require");
    vi.stubEnv("NODE_ENV", "production");

    try {
      const repository = createProductRepository();

      expect(repository.constructor.name).toBe("PrismaProductRepository");
    } finally {
      vi.unstubAllEnvs();
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
  });

  test("Prisma product repository persists chart bodies with encrypted birth profile fields", async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    const previousBirthKey = process.env.ZIWEI_BIRTH_DATA_ENCRYPTION_KEY;
    process.env.DATABASE_URL = "postgresql://ziwei:secret@example.neon.tech/ziwei_prod?sslmode=require";
    process.env.ZIWEI_BIRTH_DATA_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef";

    const birthProfiles = new Map<string, unknown>();
    const charts = new Map<string, unknown>();
    const repository = createProductRepository({
      birthProfile: {
        async upsert(input: { where: { birthProfileId: string }; create: Record<string, unknown>; update: Record<string, unknown> }) {
          birthProfiles.set(input.where.birthProfileId, { ...input.create, ...input.update });
          return birthProfiles.get(input.where.birthProfileId);
        }
      },
      chart: {
        async findUnique(input: { where: { chartId: string } }) {
          return charts.get(input.where.chartId) ?? null;
        },
        async upsert(input: { where: { chartId: string }; create: Record<string, unknown>; update: Record<string, unknown> }) {
          charts.set(input.where.chartId, { ...input.create, ...input.update });
          return charts.get(input.where.chartId);
        }
      }
    } as never);
    const birthProfile: BirthProfile = {
      display_name: "生产库用户",
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
      gender_rule: "traditional_female"
    };
    const chart: ChartCreateResponse = {
      chart_id: "chart_db_body",
      rule_profile_id: "default_ziwei_v0_1",
      rule_version: "rules_2026_05",
      rule_config_used: {
        school_id: "default_ziwei_v0_1",
        zi_hour_day_boundary: "civil_midnight",
        leap_month_policy: "same_month_number"
      },
      normalized_birth: {
        calendar_type: "gregorian",
        solar_date: "2000-08-16",
        lunar_date: null,
        local_time: "03:30",
        timezone: "Asia/Shanghai",
        time_index: 2,
        true_solar_time_applied: false,
        engine_gender: "女"
      },
      chart: {
        palaces: [],
        stars: [],
        transforms: [],
        major_periods: []
      },
      trace: [{ step: "normalize_birth", output: { time_index: 2 } }],
      warnings: [],
      privacy: {
        share_birth_date: false,
        share_birth_time: false,
        share_location: false
      }
    };

    try {
      await repository.saveChartAsync({
        chart,
        birth_profile: birthProfile,
        owner: { visitor_id: "visitor_chart_body", member_id: "member_chart_body" }
      });
      const storedBirthProfile = [...birthProfiles.values()][0] as {
        birthDateEncrypted: string;
        birthTimeEncrypted: string;
        locationEncrypted: string;
      };
      const storedChart = charts.get("chart_db_body") as { birthProfileId: string; chartJson: unknown };
      const loadedChart = await repository.getChartAsync("chart_db_body");

      expect(storedBirthProfile.birthDateEncrypted).not.toContain("2000-08-16");
      expect(storedBirthProfile.birthTimeEncrypted).not.toContain("03:30");
      expect(storedBirthProfile.locationEncrypted).not.toContain("上海");
      expect(storedBirthProfile.birthDateEncrypted.split(":")).toHaveLength(5);
      expect(storedBirthProfile.birthDateEncrypted).toMatch(/^v2:/);
      expect(storedChart.birthProfileId).toBe("birth_chart_db_body");
      expect(JSON.stringify(storedChart.chartJson)).toContain("chart_db_body");
      expect(loadedChart?.chart_id).toBe("chart_db_body");
      expect(loadedChart?.normalized_birth.local_time).toBe("03:30");
    } finally {
      process.env.DATABASE_URL = previousDatabaseUrl;
      process.env.ZIWEI_BIRTH_DATA_ENCRYPTION_KEY = previousBirthKey;
    }
  });

  test("Prisma product repository persists follow-up quota usage without raw question or birth data", async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://ziwei:secret@example.neon.tech/ziwei_prod?sslmode=require";
    const quotas = new Map<string, Record<string, unknown>>();
    const repository = createProductRepository({
      followUpQuota: {
        async findUnique(input: { where: { quotaKey: string } }) {
          return quotas.get(input.where.quotaKey) ?? null;
        },
        async upsert(input: {
          where: { quotaKey: string };
          create: Record<string, unknown>;
          update: Record<string, unknown> & { used?: { increment: number } | number };
        }) {
          const existing = quotas.get(input.where.quotaKey);
          if (!existing) {
            quotas.set(input.where.quotaKey, input.create);
            return input.create;
          }
          const { used: updateUsed, ...restUpdate } = input.update;
          const nextUsed =
            typeof updateUsed === "object" && updateUsed !== null && "increment" in updateUsed
              ? Number(existing.used ?? 0) + updateUsed.increment
              : typeof updateUsed === "number"
                ? updateUsed
                : Number(existing.used ?? 0);
          const next = {
            ...existing,
            ...restUpdate,
            used: nextUsed,
            updatedAt: new Date("2026-06-07T08:00:00.000Z")
          };
          quotas.set(input.where.quotaKey, next);
          return next;
        }
      }
    } as never);

    try {
      const quotaInput = {
        quota_key: "visitor_followup_db:2026-06-07",
        subject_id: "visitor_followup_db",
        plan: "free" as const,
        window_start: "2026-06-07",
        limit: 3
      };

      expect(await repository.getFollowUpQuotaUsageAsync(quotaInput.quota_key)).toBe(0);
      expect(await repository.incrementFollowUpQuotaAsync(quotaInput)).toBe(1);
      expect(await repository.incrementFollowUpQuotaAsync(quotaInput)).toBe(2);
      expect(await repository.getFollowUpQuotaUsageAsync(quotaInput.quota_key)).toBe(2);

      const stored = quotas.get(quotaInput.quota_key);
      expect(stored).toMatchObject({
        quotaKey: quotaInput.quota_key,
        subjectId: "visitor_followup_db",
        plan: "free",
        quotaLimit: 3,
        used: 2
      });
      expect(JSON.stringify(stored)).toContain("raw question, answer, and birth data are not stored");
      expect(JSON.stringify(stored)).not.toContain("2000-08-16");
      expect(JSON.stringify(stored)).not.toContain("03:30");
    } finally {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
  });
});
