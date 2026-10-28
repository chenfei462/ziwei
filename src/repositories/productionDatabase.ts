export type ProductionDatabaseReadinessInput = {
  databaseUrl?: string;
  directUrl?: string;
  nodeEnv?: string;
};

export type ProductionDatabaseReadiness = {
  ready: boolean;
  mode: "postgresql" | "not_configured";
  safeDatabaseUrl?: string;
  safeDirectUrl?: string;
  requiredTables: string[];
  migrationPath: string;
  blockers: string[];
};

export type ProductRepositoryModeInput = {
  databaseUrl?: string;
  nodeEnv?: string;
  e2eStoreTestDouble?: string;
};

export type ProductRepositoryMode = {
  mode: "postgresql" | "file_store" | "not_configured";
  adapter: "prisma" | "store_test_double" | "none";
  productionReady: boolean;
  fallbackAllowed: boolean;
  safeDatabaseUrl?: string;
  blockers: string[];
};

export type BirthDataEncryptionReadinessInput = {
  encryptionKey?: string;
  nodeEnv?: string;
};

export type BirthDataEncryptionReadiness = {
  ready: boolean;
  algorithm: "aes-256-gcm";
  requiredEnv: ["ZIWEI_BIRTH_DATA_ENCRYPTION_KEY"];
  blockers: string[];
};

const requiredProductionDatabaseTables = [
  "users",
  "anonymous_visitors",
  "anonymous_links",
  "identities",
  "sms_verification_challenges",
  "birth_profiles",
  "charts",
  "chart_owners",
  "interpretations",
  "reports",
  "report_versions",
  "report_generation_jobs",
  "export_previews",
  "shares",
  "orders",
  "checkout_sessions",
  "payment_events",
  "entitlements",
  "refunds",
  "support_tickets",
  "analytics_events",
  "audit_logs",
  "ai_generation_logs",
  "follow_up_quotas",
  "content_review_records",
  "rule_versions",
  "admin_accounts",
  "ops_actions",
  "channel_attributions",
  "wechat_sessions",
  "wechat_openid_bindings",
  "data_deletion_requests"
] as const;

export function getRequiredProductionDatabaseTables(): readonly string[] {
  return requiredProductionDatabaseTables;
}

export function resolveProductionDatabaseReadiness(input: ProductionDatabaseReadinessInput = {}): ProductionDatabaseReadiness {
  const databaseUrl = input.databaseUrl ?? process.env.DATABASE_URL ?? "";
  const directUrl = input.directUrl ?? process.env.DIRECT_DATABASE_URL ?? "";
  const blockers: string[] = [];

  if (!isPostgresUrl(databaseUrl)) {
    blockers.push("DATABASE_URL must be a PostgreSQL connection string.");
  }

  if (input.nodeEnv === "production" && !directUrl) {
    blockers.push("DIRECT_DATABASE_URL should be configured for production migrations and break-glass maintenance.");
  } else if (directUrl && !isPostgresUrl(directUrl)) {
    blockers.push("DIRECT_DATABASE_URL must be a PostgreSQL connection string when provided.");
  }

  return {
    ready: blockers.length === 0,
    mode: blockers.length === 0 ? "postgresql" : "not_configured",
    safeDatabaseUrl: databaseUrl ? sanitizeDatabaseUrlForLogs(databaseUrl) : undefined,
    safeDirectUrl: directUrl ? sanitizeDatabaseUrlForLogs(directUrl) : undefined,
    requiredTables: [...requiredProductionDatabaseTables],
    migrationPath: "prisma/migrations/20260525000100_china_market_delivery/migration.sql",
    blockers
  };
}

export function sanitizeDatabaseUrlForLogs(value: string): string {
  try {
    const url = new URL(value);
    if (!isPostgresUrl(value)) return "[invalid_database_url]";
    const credentials = url.username
      ? `${decodeURIComponent(url.username)}${url.password ? ":[redacted]" : ""}@`
      : "";
    return `${url.protocol}//${credentials}${url.host}${url.pathname}${url.search}`;
  } catch {
    return "[invalid_database_url]";
  }
}

export function resolveProductRepositoryMode(input: ProductRepositoryModeInput = {}): ProductRepositoryMode {
  const databaseUrl = input.databaseUrl ?? process.env.DATABASE_URL ?? "";
  const nodeEnv = input.nodeEnv ?? process.env.NODE_ENV ?? "development";
  const e2eStoreTestDouble = input.e2eStoreTestDouble ?? process.env.ZIWEI_E2E_STORE_TEST_DOUBLE ?? "";

  if (isPostgresUrl(databaseUrl)) {
    return {
      mode: "postgresql",
      adapter: "prisma",
      productionReady: true,
      fallbackAllowed: false,
      safeDatabaseUrl: sanitizeDatabaseUrlForLogs(databaseUrl),
      blockers: []
    };
  }

  if (nodeEnv === "production" && e2eStoreTestDouble === "true") {
    return {
      mode: "file_store",
      adapter: "store_test_double",
      productionReady: false,
      fallbackAllowed: true,
      blockers: ["E2E store test double is enabled; this mode is not production ready."]
    };
  }

  if (nodeEnv === "production") {
    return {
      mode: "not_configured",
      adapter: "none",
      productionReady: false,
      fallbackAllowed: false,
      blockers: ["DATABASE_URL must be configured before product repositories can run in production."]
    };
  }

  return {
    mode: "file_store",
    adapter: "store_test_double",
    productionReady: false,
    fallbackAllowed: true,
    blockers: []
  };
}

export function resolveBirthDataEncryptionReadiness(input: BirthDataEncryptionReadinessInput = {}): BirthDataEncryptionReadiness {
  const key = input.encryptionKey ?? process.env.ZIWEI_BIRTH_DATA_ENCRYPTION_KEY ?? "";
  const blockers: string[] = [];
  if (key.trim().length < 24) {
    blockers.push("ZIWEI_BIRTH_DATA_ENCRYPTION_KEY must be configured with at least 24 characters before storing birth profiles.");
  }
  return {
    ready: blockers.length === 0,
    algorithm: "aes-256-gcm",
    requiredEnv: ["ZIWEI_BIRTH_DATA_ENCRYPTION_KEY"],
    blockers
  };
}

function isPostgresUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "postgresql:" || url.protocol === "postgres:";
  } catch {
    return false;
  }
}
