import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createProductRepository } from "../src/repositories/productRepository.js";
import type { ChartOwnerRecord } from "../src/repositories/productRepository.js";
import type {
  AdminAuditLog,
  AiGenerationRecord,
  AnonymousLink,
  AnonymousVisitor,
  BirthProfile,
  ChartCreateResponse,
  CheckoutSession,
  ContentReviewQueueItem,
  DataDeletionRequestRecord,
  ExportPreview,
  MemberEntitlement,
  Order,
  PaymentEvent,
  ProductEventRecord,
  ReportDraft,
  ReportGenerationJob,
  RuleVersionStateRecord,
  ShareLandingSnapshot,
  SmsVerificationChallenge,
  SupportTicket,
  UserAccount,
  WechatOpenIdBinding
} from "../src/types.js";

const supportedBuckets = [
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
  "admin-audit-logs",
  "orders",
  "checkout-sessions",
  "payment-events",
  "entitlements",
  "reports",
  "report-generation-jobs",
  "export-previews",
  "ai-generation-logs",
  "content-review-records",
  "rule-versions"
] as const;

type SupportedBucket = (typeof supportedBuckets)[number];

type MigrationOptions = {
  sourceDir: string;
  dryRun: boolean;
  buckets: SupportedBucket[];
};

type BucketSummary = {
  bucket: SupportedBucket;
  records: number;
};

type MigrationSummary = {
  sourceDir: string;
  dryRun: boolean;
  buckets: BucketSummary[];
  totalRecords: number;
};

const options = parseArgs(process.argv.slice(2));

runPhaseStoreMigration(options)
  .then((summary) => {
    console.log(JSON.stringify(summary, null, 2));
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });

export async function runPhaseStoreMigration(options: MigrationOptions): Promise<MigrationSummary> {
  if (!options.dryRun && !process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required unless --dry-run is set.");
  }

  const repository = options.dryRun ? undefined : createProductRepository();
  const summaries: BucketSummary[] = [];

  for (const bucket of options.buckets) {
    const records = readBucketRecords(options.sourceDir, bucket);
    summaries.push({ bucket, records: records.length });
    if (!repository) continue;

    for (const record of records) {
      if (bucket === "users") await repository.saveUserAsync(record as UserAccount);
      if (bucket === "anonymous-visitors") await repository.saveAnonymousVisitorAsync(record as AnonymousVisitor);
      if (bucket === "anonymous-links") await repository.saveAnonymousLinkAsync(record as AnonymousLink);
      if (bucket === "sms-verification-challenges") await repository.saveSmsVerificationChallengeAsync(record as SmsVerificationChallenge);
      if (bucket === "share-landings") await repository.saveShareLandingSnapshotAsync(record as ShareLandingSnapshot);
      if (bucket === "support-tickets") await repository.saveSupportTicketAsync(record as SupportTicket);
      if (bucket === "data-deletion-requests") await repository.saveDataDeletionRequestAsync(record as DataDeletionRequestRecord);
      if (bucket === "wechat-openid-bindings") await repository.saveWechatOpenIdBindingAsync(record as WechatOpenIdBinding);
      if (bucket === "charts") {
        const chart = record as ChartCreateResponse;
        await repository.saveChartAsync({ chart, birth_profile: buildMigratedBirthProfile(chart) });
      }
      if (bucket === "chart-owners") await repository.saveChartOwnerAsync(record as ChartOwnerRecord);
      if (bucket === "product-events") await repository.saveProductEventAsync(record as ProductEventRecord);
      if (bucket === "admin-audit-logs") await repository.saveAdminAuditLogAsync(record as AdminAuditLog);
      if (bucket === "orders") await repository.saveOrderAsync(record as Order);
      if (bucket === "checkout-sessions") await repository.saveCheckoutSessionAsync(record as CheckoutSession);
      if (bucket === "payment-events") await repository.savePaymentEventAsync(record as PaymentEvent);
      if (bucket === "entitlements") await repository.saveMemberEntitlementAsync(record as MemberEntitlement);
      if (bucket === "reports") await repository.saveReportDraftAsync(record as ReportDraft);
      if (bucket === "report-generation-jobs") await repository.saveReportGenerationJobAsync(record as ReportGenerationJob);
      if (bucket === "export-previews") await repository.saveExportPreviewAsync(record as ExportPreview);
      if (bucket === "ai-generation-logs") await repository.saveAiGenerationRecordAsync(record as AiGenerationRecord);
      if (bucket === "content-review-records") await repository.saveContentReviewRecordAsync(record as ContentReviewQueueItem);
      if (bucket === "rule-versions") await repository.saveRuleVersionStateAsync(record as RuleVersionStateRecord);
    }
  }

  return {
    sourceDir: options.sourceDir,
    dryRun: options.dryRun,
    buckets: summaries,
    totalRecords: summaries.reduce((sum, item) => sum + item.records, 0)
  };
}

function parseArgs(args: string[]): MigrationOptions {
  const sourceDir = resolve(readArg(args, "--source") ?? "data/phase-store");
  const dryRun = args.includes("--dry-run");
  const requestedBuckets = readArg(args, "--buckets")
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const buckets = requestedBuckets?.length ? requestedBuckets.map(parseBucket) : [...supportedBuckets];

  return { sourceDir, dryRun, buckets };
}

function readArg(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
}

function parseBucket(value: string): SupportedBucket {
  if (supportedBuckets.includes(value as SupportedBucket)) return value as SupportedBucket;
  throw new Error(`Unsupported bucket "${value}". Supported buckets: ${supportedBuckets.join(", ")}`);
}

function readBucketRecords(sourceDir: string, bucket: SupportedBucket): unknown[] {
  const bucketDir = resolve(sourceDir, bucket);
  if (!existsSync(bucketDir)) return [];
  return readdirSync(bucketDir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => JSON.parse(readFileSync(resolve(bucketDir, name), "utf8")) as unknown);
}

function buildMigratedBirthProfile(chart: ChartCreateResponse): BirthProfile {
  const normalizedBirth = chart.normalized_birth;
  return {
    calendar_type: normalizedBirth.calendar_type,
    birth_date: normalizedBirth.solar_date ?? normalizedBirth.lunar_date ?? "1970-01-01",
    birth_time: normalizedBirth.local_time,
    timezone: normalizedBirth.timezone,
    is_leap_month: false,
    true_solar_time_enabled: normalizedBirth.true_solar_time_applied,
    gender_rule: normalizedBirth.engine_gender === "女" ? "traditional_female" : "traditional_male"
  };
}
