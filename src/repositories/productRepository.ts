import { createCipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import type { Prisma } from "@prisma/client";
import {
  findCheckoutSessionByOrder,
  getAnonymousLinkRecord,
  getAnonymousVisitorRecord,
  getChart,
  getChartOwnerRecord,
  getCheckoutSessionRecord,
  getDataDeletionRequestRecord,
  getExportPreviewRecord,
  getFollowUpQuotaUsage,
  getMemberEntitlementRecord,
  findActiveSmsVerificationChallengeByPhoneHash,
  getSmsVerificationChallengeRecord,
  getReportDraftRecord,
  getReportGenerationJobRecord,
  getShareLandingSnapshotRecord,
  getSupportTicketRecord,
  getUserRecord,
  getWechatOpenIdBindingRecord,
  listAdminAuditLogs,
  listAnonymousVisitorRecords,
  listChartOwnerRecords,
  listDataDeletionRequests,
  listMemberEntitlements,
  listOrderRecords,
  listPaymentEvents,
  listProviderStatementRecords,
  listRefundRecords,
  getOrderRecord,
  getPaymentEventRecord,
  getRefundRecord,
  getActiveRuleVersionState,
  listAiGenerationRecords,
  listContentReviewRecords,
  listExportPreviewRecords,
  listProductEvents,
  listReportDraftRecords,
  listReportGenerationJobs,
  listShareLandingSnapshotRecords,
  listSupportTickets,
  listUserRecords,
  saveAiGenerationRecord,
  saveAdminAuditLog,
  saveAnonymousLink,
  saveAnonymousVisitorRecord,
  saveChart as saveChartRecord,
  saveCheckoutSession,
  saveChartOwnerRecord,
  saveContentReviewRecord,
  saveDataDeletionRequest,
  saveExportPreview,
  incrementFollowUpQuota,
  saveMemberEntitlement,
  saveOrder,
  savePaymentEvent,
  saveProviderStatementRecord,
  saveRefundRecord,
  saveRuleVersionState,
  saveProductEvent,
  saveSmsVerificationChallengeRecord,
  saveReportDraft,
  saveReportGenerationJob,
  saveShareLandingSnapshot,
  saveSupportTicket,
  saveUserRecord,
  saveWechatOpenIdBinding
} from "../store.js";
import type {
  AdminAuditLog,
  AiGenerationRecord,
  AnonymousLink,
  AnonymousVisitor,
  BirthProfile,
  ChartCreateResponse,
  CheckoutSession,
  ContentReviewQueueItem,
  ContentReviewSourceType,
  ContentReviewStatus,
  DataDeletionRequestRecord,
  DataDeletionStatus,
  ExportPreview,
  FollowUpQuotaUsage,
  MemberEntitlement,
  Order,
  PaymentEvent,
  ProductEventRecord,
  ProviderStatement,
  RefundRecord,
  ReportDraft,
  ReportGenerationJob,
  RuleVersionStateRecord,
  ShareLandingSnapshot,
  ShareLandingSourceType,
  SupportTicket,
  SupportTicketAuditEntry,
  SupportTicketStatus,
  SmsVerificationChallenge,
  UserAccount,
  WechatOpenIdBinding
} from "../types.js";
import { getPrismaProductClient } from "./prismaClient.js";
import { resolveBirthDataEncryptionReadiness, resolveProductRepositoryMode } from "./productionDatabase.js";
import { emitStructuredLog } from "../observability.js";

export type ChartOwnerRecord = {
  chart_id: string;
  visitor_id?: string;
  member_id?: string;
  created_at: string;
};

export type ChartPersistenceInput = {
  chart: ChartCreateResponse;
  birth_profile: BirthProfile;
  owner?: {
    visitor_id?: string;
    member_id?: string;
  };
  created_at?: string;
};

export type AiGenerationRecordFilter = {
  chart_id?: string;
  report_id?: string;
  status?: AiGenerationRecord["status"];
};

export type ContentReviewRecordFilter = {
  report_id?: string;
  source_type?: ContentReviewSourceType;
  source_id?: string;
  status?: ContentReviewStatus;
};

export type ReportDraftFilter = {
  member_id?: string;
  chart_id?: string;
  status?: string;
};

export type ReportGenerationJobFilter = {
  member_id?: string;
  visitor_id?: string;
  report_id?: string;
  status?: ReportGenerationJob["status"];
};

export type ShareLandingSnapshotFilter = {
  source_type?: ShareLandingSourceType;
  source_id?: string;
};

export type SupportTicketFilter = {
  member_id?: string;
  status?: SupportTicketStatus;
};

export type DataDeletionRequestFilter = {
  member_id?: string;
  visitor_id?: string;
  status?: DataDeletionStatus;
};

export type ProductRepository = {
  getChart(chartId: string): ChartCreateResponse | undefined;
  getChartAsync(chartId: string): Promise<ChartCreateResponse | undefined>;
  saveChart(input: ChartPersistenceInput): void;
  saveChartAsync(input: ChartPersistenceInput): Promise<void>;
  getFollowUpQuotaUsage(quotaKey: string): number;
  getFollowUpQuotaUsageAsync(quotaKey: string): Promise<number>;
  incrementFollowUpQuota(input: Omit<FollowUpQuotaUsage, "used" | "updated_at" | "privacy_note">): number;
  incrementFollowUpQuotaAsync(input: Omit<FollowUpQuotaUsage, "used" | "updated_at" | "privacy_note">): Promise<number>;
  saveUser(user: UserAccount): void;
  saveUserAsync(user: UserAccount): Promise<void>;
  getUser(memberId: string): UserAccount | undefined;
  getUserAsync(memberId: string): Promise<UserAccount | undefined>;
  listUsers(): UserAccount[];
  listUsersAsync(): Promise<UserAccount[]>;
  saveAnonymousVisitor(visitor: AnonymousVisitor): void;
  saveAnonymousVisitorAsync(visitor: AnonymousVisitor): Promise<void>;
  getAnonymousVisitor(visitorId: string): AnonymousVisitor | undefined;
  getAnonymousVisitorAsync(visitorId: string): Promise<AnonymousVisitor | undefined>;
  listAnonymousVisitors(): AnonymousVisitor[];
  listAnonymousVisitorsAsync(): Promise<AnonymousVisitor[]>;
  saveAnonymousLink(link: AnonymousLink): void;
  saveAnonymousLinkAsync(link: AnonymousLink): Promise<void>;
  getAnonymousLink(visitorId: string): AnonymousLink | undefined;
  getAnonymousLinkAsync(visitorId: string): Promise<AnonymousLink | undefined>;
  saveSmsVerificationChallenge(challenge: SmsVerificationChallenge): void;
  saveSmsVerificationChallengeAsync(challenge: SmsVerificationChallenge): Promise<void>;
  getSmsVerificationChallenge(challengeId: string): SmsVerificationChallenge | undefined;
  getSmsVerificationChallengeAsync(challengeId: string): Promise<SmsVerificationChallenge | undefined>;
  findActiveSmsVerificationChallengeByPhoneHash(phoneHash: string, nowIso?: string): SmsVerificationChallenge | undefined;
  findActiveSmsVerificationChallengeByPhoneHashAsync(
    phoneHash: string,
    nowIso?: string
  ): Promise<SmsVerificationChallenge | undefined>;
  saveShareLandingSnapshot(snapshot: ShareLandingSnapshot): void;
  saveShareLandingSnapshotAsync(snapshot: ShareLandingSnapshot): Promise<void>;
  getShareLandingSnapshot(shareId: string): ShareLandingSnapshot | undefined;
  getShareLandingSnapshotAsync(shareId: string): Promise<ShareLandingSnapshot | undefined>;
  listShareLandingSnapshots(filter?: ShareLandingSnapshotFilter): ShareLandingSnapshot[];
  listShareLandingSnapshotsAsync(filter?: ShareLandingSnapshotFilter): Promise<ShareLandingSnapshot[]>;
  saveSupportTicket(ticket: SupportTicket): void;
  saveSupportTicketAsync(ticket: SupportTicket): Promise<void>;
  getSupportTicket(ticketId: string): SupportTicket | undefined;
  getSupportTicketAsync(ticketId: string): Promise<SupportTicket | undefined>;
  listSupportTickets(filter?: SupportTicketFilter): SupportTicket[];
  listSupportTicketsAsync(filter?: SupportTicketFilter): Promise<SupportTicket[]>;
  saveDataDeletionRequest(record: DataDeletionRequestRecord): void;
  saveDataDeletionRequestAsync(record: DataDeletionRequestRecord): Promise<void>;
  getDataDeletionRequest(deletionRequestId: string): DataDeletionRequestRecord | undefined;
  getDataDeletionRequestAsync(deletionRequestId: string): Promise<DataDeletionRequestRecord | undefined>;
  listDataDeletionRequests(filter?: DataDeletionRequestFilter): DataDeletionRequestRecord[];
  listDataDeletionRequestsAsync(filter?: DataDeletionRequestFilter): Promise<DataDeletionRequestRecord[]>;
  saveWechatOpenIdBinding(binding: WechatOpenIdBinding): void;
  saveWechatOpenIdBindingAsync(binding: WechatOpenIdBinding): Promise<void>;
  getWechatOpenIdBinding(openidHash: string): WechatOpenIdBinding | undefined;
  getWechatOpenIdBindingAsync(openidHash: string): Promise<WechatOpenIdBinding | undefined>;
  saveChartOwner(owner: ChartOwnerRecord): void;
  saveChartOwnerAsync(owner: ChartOwnerRecord): Promise<void>;
  getChartOwner(chartId: string): ChartOwnerRecord | undefined;
  getChartOwnerAsync(chartId: string): Promise<ChartOwnerRecord | undefined>;
  saveOrder(order: Order): void;
  saveOrderAsync(order: Order): Promise<void>;
  getOrder(orderId: string): Order | undefined;
  getOrderAsync(orderId: string): Promise<Order | undefined>;
  saveCheckoutSession(session: CheckoutSession): void;
  saveCheckoutSessionAsync(session: CheckoutSession): Promise<void>;
  getCheckoutSession(sessionId: string): CheckoutSession | undefined;
  getCheckoutSessionAsync(sessionId: string): Promise<CheckoutSession | undefined>;
  findCheckoutSessionByOrder(orderId: string): CheckoutSession | undefined;
  findCheckoutSessionByOrderAsync(orderId: string): Promise<CheckoutSession | undefined>;
  savePaymentEvent(event: PaymentEvent): void;
  savePaymentEventAsync(event: PaymentEvent): Promise<void>;
  getPaymentEvent(eventId: string): PaymentEvent | undefined;
  getPaymentEventAsync(eventId: string): Promise<PaymentEvent | undefined>;
  listPaymentEvents(): PaymentEvent[];
  listPaymentEventsAsync(): Promise<PaymentEvent[]>;
  saveProviderStatement(statement: ProviderStatement): void;
  saveProviderStatementAsync(statement: ProviderStatement): Promise<void>;
  listProviderStatements(): ProviderStatement[];
  listProviderStatementsAsync(): Promise<ProviderStatement[]>;
  saveRefundRecord(refund: RefundRecord): void;
  saveRefundRecordAsync(refund: RefundRecord): Promise<void>;
  getRefundRecord(refundId: string): RefundRecord | undefined;
  getRefundRecordAsync(refundId: string): Promise<RefundRecord | undefined>;
  listRefundRecords(orderId?: string): RefundRecord[];
  listRefundRecordsAsync(orderId?: string): Promise<RefundRecord[]>;
  saveMemberEntitlement(entitlement: MemberEntitlement): void;
  saveMemberEntitlementAsync(entitlement: MemberEntitlement): Promise<void>;
  getMemberEntitlement(memberId: string, reportId: string): MemberEntitlement | undefined;
  getMemberEntitlementAsync(memberId: string, reportId: string): Promise<MemberEntitlement | undefined>;
  listOrders(memberId?: string): Order[];
  listOrdersAsync(memberId?: string): Promise<Order[]>;
  listMemberEntitlements(memberId?: string): MemberEntitlement[];
  listMemberEntitlementsAsync(memberId?: string): Promise<MemberEntitlement[]>;
  saveProductEvent(event: ProductEventRecord): void;
  saveProductEventAsync(event: ProductEventRecord): Promise<void>;
  listProductEvents(): ProductEventRecord[];
  saveAdminAuditLog(record: AdminAuditLog): void;
  saveAdminAuditLogAsync(record: AdminAuditLog): Promise<void>;
  listAdminAuditLogs(): AdminAuditLog[];
  listAdminAuditLogsAsync(): Promise<AdminAuditLog[]>;
  saveRuleVersionState(record: RuleVersionStateRecord): void;
  saveRuleVersionStateAsync(record: RuleVersionStateRecord): Promise<void>;
  getActiveRuleVersionState(): RuleVersionStateRecord | undefined;
  getActiveRuleVersionStateAsync(): Promise<RuleVersionStateRecord | undefined>;
  saveReportDraft(draft: ReportDraft): void;
  saveReportDraftAsync(draft: ReportDraft): Promise<void>;
  getReportDraft(reportId: string): ReportDraft | undefined;
  getReportDraftAsync(reportId: string): Promise<ReportDraft | undefined>;
  listReportDrafts(filter?: ReportDraftFilter): ReportDraft[];
  listReportDraftsAsync(filter?: ReportDraftFilter): Promise<ReportDraft[]>;
  saveReportGenerationJob(job: ReportGenerationJob): void;
  saveReportGenerationJobAsync(job: ReportGenerationJob): Promise<void>;
  getReportGenerationJob(jobId: string): ReportGenerationJob | undefined;
  getReportGenerationJobAsync(jobId: string): Promise<ReportGenerationJob | undefined>;
  listReportGenerationJobs(filter?: ReportGenerationJobFilter): ReportGenerationJob[];
  listReportGenerationJobsAsync(filter?: ReportGenerationJobFilter): Promise<ReportGenerationJob[]>;
  saveExportPreview(preview: ExportPreview): void;
  saveExportPreviewAsync(preview: ExportPreview): Promise<void>;
  getExportPreview(exportPreviewId: string): ExportPreview | undefined;
  getExportPreviewAsync(exportPreviewId: string): Promise<ExportPreview | undefined>;
  listExportPreviews(): ExportPreview[];
  listExportPreviewsAsync(): Promise<ExportPreview[]>;
  saveAiGenerationRecord(record: AiGenerationRecord): void;
  saveAiGenerationRecordAsync(record: AiGenerationRecord): Promise<void>;
  getAiGenerationRecord(generationId: string): AiGenerationRecord | undefined;
  getAiGenerationRecordAsync(generationId: string): Promise<AiGenerationRecord | undefined>;
  listAiGenerationRecords(filter?: AiGenerationRecordFilter): AiGenerationRecord[];
  listAiGenerationRecordsAsync(filter?: AiGenerationRecordFilter): Promise<AiGenerationRecord[]>;
  saveContentReviewRecord(record: ContentReviewQueueItem): void;
  saveContentReviewRecordAsync(record: ContentReviewQueueItem): Promise<void>;
  getContentReviewRecord(reviewId: string): ContentReviewQueueItem | undefined;
  getContentReviewRecordAsync(reviewId: string): Promise<ContentReviewQueueItem | undefined>;
  listContentReviewRecords(filter?: ContentReviewRecordFilter): ContentReviewQueueItem[];
  listContentReviewRecordsAsync(filter?: ContentReviewRecordFilter): Promise<ContentReviewQueueItem[]>;
};

export type PrismaProductClient = {
  birthProfile: {
    upsert(input: {
      where: { birthProfileId: string };
      create: PrismaBirthProfileWrite;
      update: Partial<PrismaBirthProfileWrite>;
    }): Promise<unknown>;
  };
  chart: {
    findUnique(input: { where: { chartId: string } }): Promise<unknown | null>;
    upsert(input: {
      where: { chartId: string };
      create: PrismaChartWrite;
      update: Partial<PrismaChartWrite>;
    }): Promise<unknown>;
  };
  chartOwner: {
    findUnique(input: { where: { chartId: string } }): Promise<{ chartId: string; visitorId: string | null; memberId: string | null; createdAt: Date } | null>;
    upsert(input: {
      where: { chartId: string };
      create: { chartId: string; visitorId?: string | null; memberId?: string | null; createdAt?: Date };
      update: { visitorId?: string | null; memberId?: string | null };
    }): Promise<unknown>;
  };
  analyticsEvent: {
    create(input: {
      data: {
        analyticsEventId: string;
        type: string;
        visitorId?: string | null;
        memberId?: string | null;
        chartId?: string | null;
        reportId?: string | null;
        orderId?: string | null;
        metadataJson: Prisma.InputJsonObject;
        createdAt?: Date;
      };
    }): Promise<unknown>;
    findMany(input?: { orderBy?: { createdAt: "asc" | "desc" } }): Promise<
      Array<{
        analyticsEventId: string;
        type: string;
        visitorId: string | null;
        memberId: string | null;
        chartId: string | null;
        reportId: string | null;
        orderId: string | null;
        channelCode: string | null;
        metadataJson: unknown;
        createdAt: Date;
      }>
    >;
  };
  auditLog: {
    findMany(input?: { orderBy?: { createdAt: "asc" | "desc" } }): Promise<unknown[]>;
    upsert(input: {
      where: { auditLogId: string };
      create: PrismaAdminAuditLogWrite;
      update: Partial<PrismaAdminAuditLogWrite>;
    }): Promise<unknown>;
  };
  ruleVersion: {
    findFirst(input?: { where?: { activeDefault?: boolean; status?: string }; orderBy?: { updatedAt?: "asc" | "desc"; createdAt?: "asc" | "desc" } }): Promise<unknown | null>;
    upsert(input: {
      where: { ruleVersionId: string };
      create: PrismaRuleVersionWrite;
      update: Partial<PrismaRuleVersionWrite>;
    }): Promise<unknown>;
  };
  user: {
    findUnique(input: { where: { memberId: string } }): Promise<unknown | null>;
    findMany(input?: { orderBy?: { createdAt: "asc" | "desc" } }): Promise<unknown[]>;
    upsert(input: {
      where: { memberId: string };
      create: PrismaUserWrite;
      update: Partial<PrismaUserWrite>;
    }): Promise<unknown>;
  };
  anonymousVisitor: {
    findUnique(input: { where: { visitorId: string } }): Promise<unknown | null>;
    findMany(input?: { orderBy?: { firstSeenAt: "asc" | "desc" } }): Promise<unknown[]>;
    upsert(input: {
      where: { visitorId: string };
      create: PrismaAnonymousVisitorWrite;
      update: Partial<PrismaAnonymousVisitorWrite>;
    }): Promise<unknown>;
  };
  anonymousLink: {
    findUnique(input: { where: { visitorId: string } }): Promise<unknown | null>;
    upsert(input: {
      where: { visitorId: string };
      create: PrismaAnonymousLinkWrite;
      update: Partial<PrismaAnonymousLinkWrite>;
    }): Promise<unknown>;
  };
  smsVerificationChallenge: {
    findUnique(input: { where: { challengeId: string } }): Promise<unknown | null>;
    findMany(input?: {
      where?: { phoneHash?: string; consumedAt?: null; expiresAt?: { gt?: Date } };
      orderBy?: { createdAt: "asc" | "desc" };
      take?: number;
    }): Promise<unknown[]>;
    upsert(input: {
      where: { challengeId: string };
      create: PrismaSmsVerificationChallengeWrite;
      update: Partial<PrismaSmsVerificationChallengeWrite>;
    }): Promise<unknown>;
  };
  share: {
    findUnique(input: { where: { shareId: string } }): Promise<unknown | null>;
    findMany(input?: {
      where?: { sourceType?: string; sourceId?: string; memberId?: string };
      orderBy?: { createdAt: "asc" | "desc" };
    }): Promise<unknown[]>;
    upsert(input: {
      where: { shareId: string };
      create: PrismaShareWrite;
      update: Partial<PrismaShareWrite>;
    }): Promise<unknown>;
  };
  supportTicket: {
    findUnique(input: { where: { ticketId: string } }): Promise<unknown | null>;
    findMany(input?: { where?: { memberId?: string; status?: string }; orderBy?: { createdAt: "asc" | "desc" } }): Promise<unknown[]>;
    upsert(input: {
      where: { ticketId: string };
      create: PrismaSupportTicketWrite;
      update: Partial<PrismaSupportTicketWrite>;
    }): Promise<unknown>;
  };
  dataDeletionRequest: {
    findUnique(input: { where: { deletionRequestId: string } }): Promise<unknown | null>;
    findMany(input?: {
      where?: { memberId?: string; visitorId?: string; status?: string };
      orderBy?: { requestedAt: "asc" | "desc" };
    }): Promise<unknown[]>;
    upsert(input: {
      where: { deletionRequestId: string };
      create: PrismaDataDeletionRequestWrite;
      update: Partial<PrismaDataDeletionRequestWrite>;
    }): Promise<unknown>;
  };
  wechatOpenIdBinding: {
    findUnique(input: { where: { openidHash: string } }): Promise<unknown | null>;
    upsert(input: {
      where: { openidHash: string };
      create: PrismaWechatOpenIdBindingWrite;
      update: Partial<PrismaWechatOpenIdBindingWrite>;
    }): Promise<unknown>;
  };
  order: {
    findUnique(input: { where: { orderId: string } }): Promise<unknown | null>;
    findMany(input?: { where?: { memberId?: string }; orderBy?: { createdAt: "asc" | "desc" } }): Promise<unknown[]>;
    upsert(input: {
      where: { orderId: string };
      create: PrismaOrderWrite;
      update: Partial<PrismaOrderWrite>;
    }): Promise<unknown>;
  };
  checkoutSession: {
    findUnique(input: { where: { checkoutSessionId: string } }): Promise<unknown | null>;
    findFirst(input: { where: { orderId: string }; orderBy?: { createdAt: "asc" | "desc" } }): Promise<unknown | null>;
    upsert(input: {
      where: { checkoutSessionId: string };
      create: PrismaCheckoutSessionWrite;
      update: Partial<PrismaCheckoutSessionWrite>;
    }): Promise<unknown>;
  };
  paymentEvent: {
    findUnique(input: { where: { paymentEventId: string } }): Promise<unknown | null>;
    findMany(input?: { orderBy?: { receivedAt: "asc" | "desc" } }): Promise<unknown[]>;
    create(input: { data: PrismaPaymentEventWrite }): Promise<unknown>;
  };
  providerStatement: {
    findMany(input?: { orderBy?: { importedAt: "asc" | "desc" } }): Promise<unknown[]>;
    upsert(input: {
      where: { statementId: string };
      create: PrismaProviderStatementWrite;
      update: Partial<PrismaProviderStatementWrite>;
    }): Promise<unknown>;
  };
  refund: {
    findUnique(input: { where: { refundId: string } }): Promise<unknown | null>;
    findMany(input?: { where?: { orderId?: string }; orderBy?: { createdAt: "asc" | "desc" } }): Promise<unknown[]>;
    upsert(input: {
      where: { refundId: string };
      create: PrismaRefundWrite;
      update: Partial<PrismaRefundWrite>;
    }): Promise<unknown>;
  };
  entitlement: {
    findUnique(input: { where: { memberId_reportId: { memberId: string; reportId: string } } }): Promise<unknown | null>;
    findMany(input?: { where?: { memberId?: string }; orderBy?: { createdAt: "asc" | "desc" } }): Promise<unknown[]>;
    upsert(input: {
      where: { memberId_reportId: { memberId: string; reportId: string } };
      create: PrismaEntitlementWrite;
      update: Partial<PrismaEntitlementWrite>;
    }): Promise<unknown>;
  };
  report: {
    findUnique(input: { where: { reportId: string } }): Promise<unknown | null>;
    findMany(input?: { where?: { memberId?: string; chartId?: string; status?: string }; orderBy?: { createdAt: "asc" | "desc" } }): Promise<unknown[]>;
    upsert(input: {
      where: { reportId: string };
      create: PrismaReportWrite;
      update: Partial<PrismaReportWrite>;
    }): Promise<unknown>;
  };
  reportVersion: {
    findFirst(input: { where: { reportId: string }; orderBy?: { version: "asc" | "desc" } }): Promise<unknown | null>;
    upsert(input: {
      where: { reportId_version: { reportId: string; version: number } };
      create: PrismaReportVersionWrite;
      update: Partial<PrismaReportVersionWrite>;
    }): Promise<unknown>;
  };
  reportGenerationJob: {
    findUnique(input: { where: { jobId: string } }): Promise<unknown | null>;
    findMany(input?: {
      where?: { memberId?: string; visitorId?: string; reportId?: string; status?: string };
      orderBy?: { createdAt: "asc" | "desc" };
    }): Promise<unknown[]>;
    upsert(input: {
      where: { jobId: string };
      create: PrismaReportGenerationJobWrite;
      update: Partial<PrismaReportGenerationJobWrite>;
    }): Promise<unknown>;
  };
  exportPreview: {
    findUnique(input: { where: { exportPreviewId: string } }): Promise<unknown | null>;
    findMany(input?: { orderBy?: { createdAt: "asc" | "desc" } }): Promise<unknown[]>;
    upsert(input: {
      where: { exportPreviewId: string };
      create: PrismaExportPreviewWrite;
      update: Partial<PrismaExportPreviewWrite>;
    }): Promise<unknown>;
  };
  aiGenerationLog: {
    findUnique(input: { where: { generationId: string } }): Promise<unknown | null>;
    findMany(input?: {
      where?: { chartId?: string; reportId?: string; status?: string };
      orderBy?: { createdAt: "asc" | "desc" };
    }): Promise<unknown[]>;
    upsert(input: {
      where: { generationId: string };
      create: PrismaAiGenerationLogWrite;
      update: Partial<PrismaAiGenerationLogWrite>;
    }): Promise<unknown>;
  };
  followUpQuota: {
    findUnique(input: { where: { quotaKey: string } }): Promise<unknown | null>;
    upsert(input: {
      where: { quotaKey: string };
      create: PrismaFollowUpQuotaWrite;
      update: Partial<Omit<PrismaFollowUpQuotaWrite, "used">> & { used?: number | { increment: number } };
    }): Promise<unknown>;
  };
  contentReviewRecord: {
    findUnique(input: { where: { reviewId: string } }): Promise<unknown | null>;
    findMany(input?: {
      where?: { reportId?: string; sourceType?: string; sourceId?: string; status?: string };
      orderBy?: { checkedAt: "asc" | "desc" };
    }): Promise<unknown[]>;
    upsert(input: {
      where: { reviewId: string };
      create: PrismaContentReviewRecordWrite;
      update: Partial<PrismaContentReviewRecordWrite>;
    }): Promise<unknown>;
  };
};

type PrismaBirthProfileWrite = {
  birthProfileId: string;
  memberId?: string | null;
  visitorId?: string | null;
  calendarType: string;
  birthDateEncrypted: string;
  birthTimeEncrypted: string;
  locationEncrypted?: string | null;
  timezone: string;
  isLeapMonth: boolean;
  trueSolarTimeEnabled: boolean;
  genderRule: string;
  accuracyNote?: string | null;
  createdAt?: Date;
};

type PrismaChartWrite = {
  chartId: string;
  birthProfileId: string;
  ruleVersionId: string;
  chartJson: Prisma.InputJsonObject;
  normalizedBirth: Prisma.InputJsonObject;
  traceJson: Prisma.InputJsonObject;
  createdAt?: Date;
};

type PrismaChartRecord = Omit<PrismaChartWrite, "chartJson" | "normalizedBirth" | "traceJson" | "createdAt"> & {
  chartJson: unknown;
  normalizedBirth: unknown;
  traceJson: unknown;
  createdAt: Date;
};

type PrismaUserWrite = {
  memberId: string;
  displayName: string;
  phoneHash?: string | null;
  emailHash?: string | null;
  status: string;
  privacyVersion: string;
  privacyNote: string;
  upgradedFromVisitorId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

type PrismaUserRecord = Omit<PrismaUserWrite, "createdAt" | "updatedAt"> & {
  createdAt: Date;
  updatedAt: Date;
};

type PrismaAnonymousVisitorWrite = {
  visitorId: string;
  upgradedMemberId?: string | null;
  privacyNote: string;
  firstSeenAt?: Date;
  upgradedAt?: Date | null;
  lastSeenAt?: Date;
};

type PrismaAnonymousVisitorRecord = Omit<PrismaAnonymousVisitorWrite, "firstSeenAt" | "upgradedAt" | "lastSeenAt"> & {
  firstSeenAt: Date;
  upgradedAt: Date | null;
  lastSeenAt: Date;
};

type PrismaAnonymousLinkWrite = {
  linkId: string;
  visitorId: string;
  memberId: string;
  openidPlaceholder?: string | null;
  linkedAt?: Date;
  privacyNote: string;
};

type PrismaAnonymousLinkRecord = Omit<PrismaAnonymousLinkWrite, "linkedAt"> & {
  linkedAt: Date;
};

type PrismaSmsVerificationChallengeWrite = {
  challengeId: string;
  phoneHash: string;
  codeHash: string;
  provider: string;
  templateId: string;
  purpose: string;
  attemptCount: number;
  maxAttempts: number;
  deliveryStatus: string;
  providerMessageId?: string | null;
  privacyNote: string;
  createdAt?: Date;
  expiresAt: Date;
  consumedAt?: Date | null;
};

type PrismaSmsVerificationChallengeRecord = Omit<PrismaSmsVerificationChallengeWrite, "createdAt" | "expiresAt" | "consumedAt"> & {
  createdAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
};

type PrismaShareWrite = {
  shareId: string;
  sourceType: string;
  sourceId: string;
  memberId?: string | null;
  visitorId?: string | null;
  snapshotJson: Prisma.InputJsonObject;
  expiresAt?: Date | null;
  createdAt?: Date;
};

type PrismaShareRecord = Omit<PrismaShareWrite, "snapshotJson" | "expiresAt" | "createdAt"> & {
  snapshotJson: unknown;
  expiresAt: Date | null;
  createdAt: Date;
};

type PrismaSupportTicketWrite = {
  ticketId: string;
  memberId: string;
  orderId?: string | null;
  reportId?: string | null;
  category: string;
  priority: string;
  status: string;
  subject: string;
  message: string;
  assignee?: string | null;
  consentJson: Prisma.InputJsonObject;
  auditTrailJson: Prisma.InputJsonObject;
  createdAt?: Date;
  updatedAt?: Date;
  resolvedAt?: Date | null;
};

type PrismaSupportTicketRecord = Omit<PrismaSupportTicketWrite, "consentJson" | "auditTrailJson" | "createdAt" | "updatedAt" | "resolvedAt"> & {
  consentJson: unknown;
  auditTrailJson: unknown;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
};

type PrismaDataDeletionRequestWrite = {
  deletionRequestId: string;
  memberId?: string | null;
  visitorId?: string | null;
  ticketId?: string | null;
  status: string;
  scope: string;
  requestedAt?: Date;
  updatedAt?: Date;
  completedAt?: Date | null;
  auditLogId?: string | null;
  auditTrailJson: Prisma.InputJsonObject;
  privacyNote: string;
};

type PrismaDataDeletionRequestRecord = Omit<
  PrismaDataDeletionRequestWrite,
  "requestedAt" | "updatedAt" | "completedAt" | "auditTrailJson"
> & {
  requestedAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  auditTrailJson: unknown;
};

type PrismaWechatOpenIdBindingWrite = {
  bindingId: string;
  openidHash: string;
  visitorId: string;
  memberId: string;
  linkedAt?: Date;
  isDuplicate: boolean;
  privacyNote: string;
};

type PrismaWechatOpenIdBindingRecord = Omit<PrismaWechatOpenIdBindingWrite, "linkedAt"> & {
  linkedAt: Date;
};

type PrismaOrderWrite = {
  orderId: string;
  reportId: string;
  memberId: string;
  packageId: string;
  tierId: string;
  reportType: string;
  amountCents: number;
  currency: string;
  status: string;
  paymentProvider: string;
  checkoutSessionId?: string | null;
  refundedAmountCents?: number | null;
  refundReason?: string | null;
  complianceJson: Prisma.InputJsonObject;
  privacyJson: Prisma.InputJsonObject;
  attributionJson?: Prisma.InputJsonObject;
  createdAt?: Date;
  updatedAt?: Date;
  fulfilledAt?: Date | null;
  refundedAt?: Date | null;
};

type PrismaOrderRecord = Omit<PrismaOrderWrite, "complianceJson" | "privacyJson" | "attributionJson" | "createdAt" | "updatedAt" | "fulfilledAt" | "refundedAt"> & {
  complianceJson: unknown;
  privacyJson: unknown;
  attributionJson?: unknown;
  createdAt: Date;
  updatedAt: Date;
  fulfilledAt: Date | null;
  refundedAt: Date | null;
};

type PrismaCheckoutSessionWrite = {
  checkoutSessionId: string;
  orderId: string;
  provider: string;
  providerMode: string;
  checkoutUrl: string;
  status: string;
  sandboxWebhookJson?: Prisma.InputJsonObject;
  providerRequirementsJson: Prisma.InputJsonObject;
  createdAt?: Date;
  expiresAt: Date;
};

type PrismaCheckoutSessionRecord = Omit<PrismaCheckoutSessionWrite, "sandboxWebhookJson" | "providerRequirementsJson" | "createdAt" | "expiresAt"> & {
  sandboxWebhookJson?: unknown;
  providerRequirementsJson: unknown;
  createdAt: Date;
  expiresAt: Date;
};

type PrismaPaymentEventWrite = {
  paymentEventId: string;
  provider: string;
  providerEventId: string;
  eventType: string;
  orderId?: string | null;
  checkoutSessionId?: string | null;
  signatureVerified: boolean;
  isDuplicate: boolean;
  rawPayloadDigest: string;
  orderSnapshotJson?: Prisma.InputJsonObject;
  receivedAt?: Date;
};

type PrismaPaymentEventRecord = Omit<PrismaPaymentEventWrite, "orderSnapshotJson" | "receivedAt"> & {
  orderSnapshotJson?: unknown;
  receivedAt: Date;
};

type PrismaProviderStatementWrite = {
  statementId: string;
  provider: string;
  periodStart: string;
  periodEnd: string;
  importedBy: string;
  rowCount: number;
  rowsJson: Prisma.InputJsonValue;
  privacyNote: string;
  importedAt?: Date;
};

type PrismaProviderStatementRecord = Omit<PrismaProviderStatementWrite, "rowsJson" | "importedAt"> & {
  rowsJson: unknown;
  importedAt: Date;
};

type PrismaRefundWrite = {
  refundId: string;
  orderId: string;
  provider: string;
  providerRefundId?: string | null;
  amountCents: number;
  status: string;
  reason: string;
  requestedBy: string;
  ticketId?: string | null;
  providerRefundRequestJson?: unknown;
  privacyNote: string;
  createdAt?: Date;
  updatedAt?: Date;
};

type PrismaRefundRecord = Omit<PrismaRefundWrite, "createdAt" | "updatedAt"> & {
  createdAt: Date;
  updatedAt: Date;
};

type PrismaEntitlementWrite = {
  entitlementId: string;
  memberId: string;
  reportId: string;
  sourceOrderId: string;
  tierId?: string | null;
  accessLevel?: string | null;
  benefits: string[];
  status: string;
  credits: number;
  hasAccess: boolean;
  canReadReport: boolean;
  favoriteEnabled: boolean;
  privacyNote: string;
  reportSnapshotJson?: Prisma.InputJsonObject;
  createdAt?: Date;
};

type PrismaEntitlementRecord = Omit<PrismaEntitlementWrite, "reportSnapshotJson" | "createdAt"> & {
  reportSnapshotJson?: unknown;
  createdAt: Date;
};

type PrismaReportWrite = {
  reportId: string;
  chartId?: string | null;
  memberId?: string | null;
  tier: string;
  status: string;
  currentVersion: number;
  accessPolicy: string;
  shareSummary?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

type PrismaReportRecord = Omit<PrismaReportWrite, "createdAt" | "updatedAt"> & {
  createdAt: Date;
  updatedAt: Date;
};

type PrismaReportVersionWrite = {
  reportVersionId: string;
  reportId: string;
  version: number;
  ruleVersionId: string;
  promptVersion?: string | null;
  generatedAt?: Date;
  contentJson: Prisma.InputJsonObject;
  traceJson: Prisma.InputJsonObject;
  reviewStatus: string;
};

type PrismaReportVersionRecord = Omit<PrismaReportVersionWrite, "contentJson" | "traceJson" | "generatedAt"> & {
  contentJson: unknown;
  traceJson: unknown;
  generatedAt: Date;
};

type PrismaReportGenerationJobWrite = {
  jobId: string;
  memberId?: string | null;
  visitorId?: string | null;
  reportId?: string | null;
  status: string;
  attemptCount: number;
  maxAttempts: number;
  requestDigest: string;
  requestSummaryJson: Prisma.InputJsonObject;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  supportTicketId?: string | null;
  auditTrailJson: Prisma.InputJsonObject;
  privacyNote: string;
  createdAt?: Date;
  updatedAt?: Date;
};

type PrismaReportGenerationJobRecord = Omit<PrismaReportGenerationJobWrite, "requestSummaryJson" | "auditTrailJson" | "createdAt" | "updatedAt"> & {
  requestSummaryJson: unknown;
  auditTrailJson: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaExportPreviewWrite = {
  exportPreviewId: string;
  reportId: string;
  format: string;
  previewUrl: string;
  storageJson: Prisma.InputJsonObject;
  reviewStatus: string;
  orderCreated: boolean;
  paymentStatus: string;
  privacyNote: string;
  createdAt?: Date;
  expiresAt: Date;
};

type PrismaExportPreviewRecord = Omit<PrismaExportPreviewWrite, "storageJson" | "createdAt" | "expiresAt"> & {
  storageJson: unknown;
  createdAt: Date;
  expiresAt: Date;
};

type PrismaAiGenerationLogWrite = {
  generationId: string;
  provider: string;
  model: string;
  promptVersion: string;
  chartId?: string | null;
  reportId?: string | null;
  inputDigest: string;
  outputDigest?: string | null;
  status: string;
  fallbackReason?: string | null;
  safetyFlags: string[];
  privacyNote: string;
  createdAt?: Date;
};

type PrismaAiGenerationLogRecord = Omit<PrismaAiGenerationLogWrite, "createdAt"> & {
  createdAt: Date;
};

type PrismaFollowUpQuotaWrite = {
  quotaKey: string;
  subjectId: string;
  plan: string;
  windowStart: Date;
  quotaLimit: number;
  used: number;
  privacyNote: string;
  updatedAt?: Date;
};

type PrismaFollowUpQuotaRecord = Omit<PrismaFollowUpQuotaWrite, "updatedAt"> & {
  updatedAt: Date;
};

type PrismaContentReviewRecordWrite = {
  reviewId: string;
  reportId: string;
  sourceType: string;
  sourceId: string;
  status: string;
  blockedTerms: string[];
  privacyFlags: string[];
  safetyFlags: string[];
  reviewerId?: string | null;
  notes: string[];
  checkedAt?: Date;
};

type PrismaContentReviewRecordRecord = Omit<PrismaContentReviewRecordWrite, "checkedAt"> & {
  checkedAt: Date;
};

type PrismaAdminAuditLogWrite = {
  auditLogId: string;
  actorId: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadataJson: Prisma.InputJsonObject;
  ipHash?: string | null;
  createdAt?: Date;
};

type PrismaAdminAuditLogRecord = Omit<PrismaAdminAuditLogWrite, "metadataJson" | "createdAt"> & {
  metadataJson: unknown;
  createdAt: Date;
};

type PrismaRuleVersionWrite = {
  ruleVersionId: string;
  profileId: string;
  label: string;
  status: string;
  activeDefault: boolean;
  configJson: Prisma.InputJsonObject;
  releasedAt?: Date | null;
  updatedAt?: Date;
  createdAt?: Date;
};

type PrismaRuleVersionRecord = Omit<PrismaRuleVersionWrite, "configJson" | "releasedAt" | "updatedAt" | "createdAt"> & {
  configJson: unknown;
  releasedAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
};

type RepositoryRuntimeOptions = {
  allowStoreFallback?: boolean;
};

class StoreProductRepository implements ProductRepository {
  getChart(chartId: string): ChartCreateResponse | undefined {
    return getChart(chartId);
  }

  async getChartAsync(chartId: string): Promise<ChartCreateResponse | undefined> {
    return this.getChart(chartId);
  }

  saveChart(input: ChartPersistenceInput): void {
    saveChartRecord(input.chart);
  }

  async saveChartAsync(input: ChartPersistenceInput): Promise<void> {
    this.saveChart(input);
  }

  getFollowUpQuotaUsage(quotaKey: string): number {
    return getFollowUpQuotaUsage(quotaKey);
  }

  async getFollowUpQuotaUsageAsync(quotaKey: string): Promise<number> {
    return this.getFollowUpQuotaUsage(quotaKey);
  }

  incrementFollowUpQuota(input: Omit<FollowUpQuotaUsage, "used" | "updated_at" | "privacy_note">): number {
    return incrementFollowUpQuota(input);
  }

  async incrementFollowUpQuotaAsync(input: Omit<FollowUpQuotaUsage, "used" | "updated_at" | "privacy_note">): Promise<number> {
    return this.incrementFollowUpQuota(input);
  }

  saveUser(user: UserAccount): void {
    saveUserRecord(user);
  }

  async saveUserAsync(user: UserAccount): Promise<void> {
    this.saveUser(user);
  }

  getUser(memberId: string): UserAccount | undefined {
    return getUserRecord(memberId);
  }

  async getUserAsync(memberId: string): Promise<UserAccount | undefined> {
    return this.getUser(memberId);
  }

  listUsers(): UserAccount[] {
    return listUserRecords();
  }

  async listUsersAsync(): Promise<UserAccount[]> {
    return this.listUsers();
  }

  saveAnonymousVisitor(visitor: AnonymousVisitor): void {
    saveAnonymousVisitorRecord(visitor);
  }

  async saveAnonymousVisitorAsync(visitor: AnonymousVisitor): Promise<void> {
    this.saveAnonymousVisitor(visitor);
  }

  getAnonymousVisitor(visitorId: string): AnonymousVisitor | undefined {
    return getAnonymousVisitorRecord(visitorId);
  }

  async getAnonymousVisitorAsync(visitorId: string): Promise<AnonymousVisitor | undefined> {
    return this.getAnonymousVisitor(visitorId);
  }

  listAnonymousVisitors(): AnonymousVisitor[] {
    return listAnonymousVisitorRecords();
  }

  async listAnonymousVisitorsAsync(): Promise<AnonymousVisitor[]> {
    return this.listAnonymousVisitors();
  }

  saveAnonymousLink(link: AnonymousLink): void {
    saveAnonymousLink(link);
  }

  async saveAnonymousLinkAsync(link: AnonymousLink): Promise<void> {
    this.saveAnonymousLink(link);
  }

  getAnonymousLink(visitorId: string): AnonymousLink | undefined {
    return getAnonymousLinkRecord(visitorId);
  }

  async getAnonymousLinkAsync(visitorId: string): Promise<AnonymousLink | undefined> {
    return this.getAnonymousLink(visitorId);
  }

  saveSmsVerificationChallenge(challenge: SmsVerificationChallenge): void {
    saveSmsVerificationChallengeRecord(challenge);
  }

  async saveSmsVerificationChallengeAsync(challenge: SmsVerificationChallenge): Promise<void> {
    this.saveSmsVerificationChallenge(challenge);
  }

  getSmsVerificationChallenge(challengeId: string): SmsVerificationChallenge | undefined {
    return getSmsVerificationChallengeRecord(challengeId);
  }

  async getSmsVerificationChallengeAsync(challengeId: string): Promise<SmsVerificationChallenge | undefined> {
    return this.getSmsVerificationChallenge(challengeId);
  }

  findActiveSmsVerificationChallengeByPhoneHash(phoneHash: string, nowIso = new Date().toISOString()): SmsVerificationChallenge | undefined {
    return findActiveSmsVerificationChallengeByPhoneHash(phoneHash, nowIso);
  }

  async findActiveSmsVerificationChallengeByPhoneHashAsync(
    phoneHash: string,
    nowIso = new Date().toISOString()
  ): Promise<SmsVerificationChallenge | undefined> {
    return this.findActiveSmsVerificationChallengeByPhoneHash(phoneHash, nowIso);
  }

  saveShareLandingSnapshot(snapshot: ShareLandingSnapshot): void {
    saveShareLandingSnapshot(snapshot);
  }

  async saveShareLandingSnapshotAsync(snapshot: ShareLandingSnapshot): Promise<void> {
    this.saveShareLandingSnapshot(snapshot);
  }

  getShareLandingSnapshot(shareId: string): ShareLandingSnapshot | undefined {
    return getShareLandingSnapshotRecord(shareId);
  }

  async getShareLandingSnapshotAsync(shareId: string): Promise<ShareLandingSnapshot | undefined> {
    return this.getShareLandingSnapshot(shareId);
  }

  listShareLandingSnapshots(filter: ShareLandingSnapshotFilter = {}): ShareLandingSnapshot[] {
    return filterShareLandingSnapshots(listShareLandingSnapshotRecords(), filter);
  }

  async listShareLandingSnapshotsAsync(filter: ShareLandingSnapshotFilter = {}): Promise<ShareLandingSnapshot[]> {
    return this.listShareLandingSnapshots(filter);
  }

  saveSupportTicket(ticket: SupportTicket): void {
    saveSupportTicket(ticket);
  }

  async saveSupportTicketAsync(ticket: SupportTicket): Promise<void> {
    this.saveSupportTicket(ticket);
  }

  getSupportTicket(ticketId: string): SupportTicket | undefined {
    return getSupportTicketRecord(ticketId);
  }

  async getSupportTicketAsync(ticketId: string): Promise<SupportTicket | undefined> {
    return this.getSupportTicket(ticketId);
  }

  listSupportTickets(filter: SupportTicketFilter = {}): SupportTicket[] {
    return filterSupportTickets(listSupportTickets(), filter);
  }

  async listSupportTicketsAsync(filter: SupportTicketFilter = {}): Promise<SupportTicket[]> {
    return this.listSupportTickets(filter);
  }

  saveDataDeletionRequest(record: DataDeletionRequestRecord): void {
    saveDataDeletionRequest(record);
  }

  async saveDataDeletionRequestAsync(record: DataDeletionRequestRecord): Promise<void> {
    this.saveDataDeletionRequest(record);
  }

  getDataDeletionRequest(deletionRequestId: string): DataDeletionRequestRecord | undefined {
    return getDataDeletionRequestRecord(deletionRequestId);
  }

  async getDataDeletionRequestAsync(deletionRequestId: string): Promise<DataDeletionRequestRecord | undefined> {
    return this.getDataDeletionRequest(deletionRequestId);
  }

  listDataDeletionRequests(filter: DataDeletionRequestFilter = {}): DataDeletionRequestRecord[] {
    return filterDataDeletionRequests(listDataDeletionRequests(), filter);
  }

  async listDataDeletionRequestsAsync(filter: DataDeletionRequestFilter = {}): Promise<DataDeletionRequestRecord[]> {
    return this.listDataDeletionRequests(filter);
  }

  saveWechatOpenIdBinding(binding: WechatOpenIdBinding): void {
    saveWechatOpenIdBinding(binding);
  }

  async saveWechatOpenIdBindingAsync(binding: WechatOpenIdBinding): Promise<void> {
    this.saveWechatOpenIdBinding(binding);
  }

  getWechatOpenIdBinding(openidHash: string): WechatOpenIdBinding | undefined {
    return getWechatOpenIdBindingRecord(openidHash);
  }

  async getWechatOpenIdBindingAsync(openidHash: string): Promise<WechatOpenIdBinding | undefined> {
    return this.getWechatOpenIdBinding(openidHash);
  }

  saveChartOwner(owner: ChartOwnerRecord): void {
    saveChartOwnerRecord(owner);
  }

  async saveChartOwnerAsync(owner: ChartOwnerRecord): Promise<void> {
    this.saveChartOwner(owner);
  }

  getChartOwner(chartId: string): ChartOwnerRecord | undefined {
    return getChartOwnerRecord(chartId);
  }

  async getChartOwnerAsync(chartId: string): Promise<ChartOwnerRecord | undefined> {
    return this.getChartOwner(chartId);
  }

  saveOrder(order: Order): void {
    saveOrder(order);
  }

  async saveOrderAsync(order: Order): Promise<void> {
    this.saveOrder(order);
  }

  getOrder(orderId: string): Order | undefined {
    return getOrderRecord(orderId);
  }

  async getOrderAsync(orderId: string): Promise<Order | undefined> {
    return this.getOrder(orderId);
  }

  saveCheckoutSession(session: CheckoutSession): void {
    saveCheckoutSession(session);
  }

  async saveCheckoutSessionAsync(session: CheckoutSession): Promise<void> {
    this.saveCheckoutSession(session);
  }

  getCheckoutSession(sessionId: string): CheckoutSession | undefined {
    return getCheckoutSessionRecord(sessionId);
  }

  async getCheckoutSessionAsync(sessionId: string): Promise<CheckoutSession | undefined> {
    return this.getCheckoutSession(sessionId);
  }

  findCheckoutSessionByOrder(orderId: string): CheckoutSession | undefined {
    return findCheckoutSessionByOrder(orderId);
  }

  async findCheckoutSessionByOrderAsync(orderId: string): Promise<CheckoutSession | undefined> {
    return this.findCheckoutSessionByOrder(orderId);
  }

  savePaymentEvent(event: PaymentEvent): void {
    savePaymentEvent(event);
  }

  async savePaymentEventAsync(event: PaymentEvent): Promise<void> {
    this.savePaymentEvent(event);
  }

  getPaymentEvent(eventId: string): PaymentEvent | undefined {
    return getPaymentEventRecord(eventId);
  }

  async getPaymentEventAsync(eventId: string): Promise<PaymentEvent | undefined> {
    return this.getPaymentEvent(eventId);
  }

  listPaymentEvents(): PaymentEvent[] {
    return listPaymentEvents();
  }

  async listPaymentEventsAsync(): Promise<PaymentEvent[]> {
    return this.listPaymentEvents();
  }

  saveProviderStatement(statement: ProviderStatement): void {
    saveProviderStatementRecord(statement);
  }

  async saveProviderStatementAsync(statement: ProviderStatement): Promise<void> {
    this.saveProviderStatement(statement);
  }

  listProviderStatements(): ProviderStatement[] {
    return listProviderStatementRecords();
  }

  async listProviderStatementsAsync(): Promise<ProviderStatement[]> {
    return this.listProviderStatements();
  }

  saveRefundRecord(refund: RefundRecord): void {
    saveRefundRecord(refund);
  }

  async saveRefundRecordAsync(refund: RefundRecord): Promise<void> {
    this.saveRefundRecord(refund);
  }

  getRefundRecord(refundId: string): RefundRecord | undefined {
    return getRefundRecord(refundId);
  }

  async getRefundRecordAsync(refundId: string): Promise<RefundRecord | undefined> {
    return this.getRefundRecord(refundId);
  }

  listRefundRecords(orderId?: string): RefundRecord[] {
    return listRefundRecords(orderId);
  }

  async listRefundRecordsAsync(orderId?: string): Promise<RefundRecord[]> {
    return this.listRefundRecords(orderId);
  }

  saveMemberEntitlement(entitlement: MemberEntitlement): void {
    saveMemberEntitlement(entitlement);
  }

  async saveMemberEntitlementAsync(entitlement: MemberEntitlement): Promise<void> {
    this.saveMemberEntitlement(entitlement);
  }

  getMemberEntitlement(memberId: string, reportId: string): MemberEntitlement | undefined {
    return getMemberEntitlementRecord(memberId, reportId);
  }

  async getMemberEntitlementAsync(memberId: string, reportId: string): Promise<MemberEntitlement | undefined> {
    return this.getMemberEntitlement(memberId, reportId);
  }

  listOrders(memberId?: string): Order[] {
    return listOrderRecords(memberId);
  }

  async listOrdersAsync(memberId?: string): Promise<Order[]> {
    return this.listOrders(memberId);
  }

  listMemberEntitlements(memberId?: string): MemberEntitlement[] {
    return listMemberEntitlements(memberId);
  }

  async listMemberEntitlementsAsync(memberId?: string): Promise<MemberEntitlement[]> {
    return this.listMemberEntitlements(memberId);
  }

  saveProductEvent(event: ProductEventRecord): void {
    saveProductEvent(event);
  }

  async saveProductEventAsync(event: ProductEventRecord): Promise<void> {
    this.saveProductEvent(event);
  }

  listProductEvents(): ProductEventRecord[] {
    return listProductEvents();
  }

  saveAdminAuditLog(record: AdminAuditLog): void {
    saveAdminAuditLog(record);
  }

  async saveAdminAuditLogAsync(record: AdminAuditLog): Promise<void> {
    this.saveAdminAuditLog(record);
  }

  listAdminAuditLogs(): AdminAuditLog[] {
    return listAdminAuditLogs();
  }

  async listAdminAuditLogsAsync(): Promise<AdminAuditLog[]> {
    return this.listAdminAuditLogs();
  }

  saveRuleVersionState(record: RuleVersionStateRecord): void {
    saveRuleVersionState(record);
  }

  async saveRuleVersionStateAsync(record: RuleVersionStateRecord): Promise<void> {
    this.saveRuleVersionState(record);
  }

  getActiveRuleVersionState(): RuleVersionStateRecord | undefined {
    return getActiveRuleVersionState();
  }

  async getActiveRuleVersionStateAsync(): Promise<RuleVersionStateRecord | undefined> {
    return this.getActiveRuleVersionState();
  }

  saveReportDraft(draft: ReportDraft): void {
    saveReportDraft(draft);
  }

  async saveReportDraftAsync(draft: ReportDraft): Promise<void> {
    this.saveReportDraft(draft);
  }

  getReportDraft(reportId: string): ReportDraft | undefined {
    return getReportDraftRecord(reportId);
  }

  async getReportDraftAsync(reportId: string): Promise<ReportDraft | undefined> {
    return this.getReportDraft(reportId);
  }

  listReportDrafts(filter: ReportDraftFilter = {}): ReportDraft[] {
    return filterReportDrafts(listReportDraftRecords(), filter);
  }

  async listReportDraftsAsync(filter: ReportDraftFilter = {}): Promise<ReportDraft[]> {
    return this.listReportDrafts(filter);
  }

  saveReportGenerationJob(job: ReportGenerationJob): void {
    saveReportGenerationJob(job);
  }

  async saveReportGenerationJobAsync(job: ReportGenerationJob): Promise<void> {
    this.saveReportGenerationJob(job);
  }

  getReportGenerationJob(jobId: string): ReportGenerationJob | undefined {
    return getReportGenerationJobRecord(jobId);
  }

  async getReportGenerationJobAsync(jobId: string): Promise<ReportGenerationJob | undefined> {
    return this.getReportGenerationJob(jobId);
  }

  listReportGenerationJobs(filter: ReportGenerationJobFilter = {}): ReportGenerationJob[] {
    return filterReportGenerationJobs(listReportGenerationJobs(), filter);
  }

  async listReportGenerationJobsAsync(filter: ReportGenerationJobFilter = {}): Promise<ReportGenerationJob[]> {
    return this.listReportGenerationJobs(filter);
  }

  saveExportPreview(preview: ExportPreview): void {
    saveExportPreview(preview);
  }

  async saveExportPreviewAsync(preview: ExportPreview): Promise<void> {
    this.saveExportPreview(preview);
  }

  getExportPreview(exportPreviewId: string): ExportPreview | undefined {
    return getExportPreviewRecord(exportPreviewId);
  }

  async getExportPreviewAsync(exportPreviewId: string): Promise<ExportPreview | undefined> {
    return this.getExportPreview(exportPreviewId);
  }

  listExportPreviews(): ExportPreview[] {
    return listExportPreviewRecords();
  }

  async listExportPreviewsAsync(): Promise<ExportPreview[]> {
    return this.listExportPreviews();
  }

  saveAiGenerationRecord(record: AiGenerationRecord): void {
    saveAiGenerationRecord(record);
  }

  async saveAiGenerationRecordAsync(record: AiGenerationRecord): Promise<void> {
    this.saveAiGenerationRecord(record);
  }

  getAiGenerationRecord(generationId: string): AiGenerationRecord | undefined {
    return this.listAiGenerationRecords().find((record) => record.generation_id === generationId);
  }

  async getAiGenerationRecordAsync(generationId: string): Promise<AiGenerationRecord | undefined> {
    return this.getAiGenerationRecord(generationId);
  }

  listAiGenerationRecords(filter: AiGenerationRecordFilter = {}): AiGenerationRecord[] {
    return filterAiGenerationRecords(listAiGenerationRecords(), filter);
  }

  async listAiGenerationRecordsAsync(filter: AiGenerationRecordFilter = {}): Promise<AiGenerationRecord[]> {
    return this.listAiGenerationRecords(filter);
  }

  saveContentReviewRecord(record: ContentReviewQueueItem): void {
    saveContentReviewRecord(record);
  }

  async saveContentReviewRecordAsync(record: ContentReviewQueueItem): Promise<void> {
    this.saveContentReviewRecord(record);
  }

  getContentReviewRecord(reviewId: string): ContentReviewQueueItem | undefined {
    return this.listContentReviewRecords().find((record) => record.review_id === reviewId);
  }

  async getContentReviewRecordAsync(reviewId: string): Promise<ContentReviewQueueItem | undefined> {
    return this.getContentReviewRecord(reviewId);
  }

  listContentReviewRecords(filter: ContentReviewRecordFilter = {}): ContentReviewQueueItem[] {
    return filterContentReviewRecords(listContentReviewRecords(), filter);
  }

  async listContentReviewRecordsAsync(filter: ContentReviewRecordFilter = {}): Promise<ContentReviewQueueItem[]> {
    return this.listContentReviewRecords(filter);
  }
}

function persistToPrisma(operation: Promise<unknown>, operationName: string): void {
  void operation.catch(async (error: unknown) => {
    await emitStructuredLog({
      request_id: `prisma-${Date.now()}`,
      route: "prisma/product-repository",
      status: 500,
      error_code: "PRISMA_DUAL_WRITE_FAILED",
      message: `${operationName}: ${error instanceof Error ? error.message : "unknown persistence error"}`
    }).catch(() => undefined);
  });
}

class PrismaProductRepository implements ProductRepository {
  constructor(private readonly client: PrismaProductClient, private readonly fallback = new StoreProductRepository()) {}

  getChart(chartId: string): ChartCreateResponse | undefined {
    return this.fallback.getChart(chartId);
  }

  async getChartAsync(chartId: string): Promise<ChartCreateResponse | undefined> {
    const record = await this.client.chart.findUnique({ where: { chartId } });
    if (!record) return this.fallback.getChart(chartId);
    const chart = parseChartRecord(asPrismaChartRecord(record));
    if (!chart) return this.fallback.getChart(chartId);
    saveChartRecord(chart);
    return chart;
  }

  saveChart(input: ChartPersistenceInput): void {
    this.fallback.saveChart(input);
    persistToPrisma(this.saveChartAsync(input), "saveChart");
  }

  async saveChartAsync(input: ChartPersistenceInput): Promise<void> {
    const birthProfileWrite = buildBirthProfileWrite(input);
    const chartWrite = buildChartWrite(input.chart);
    await this.client.birthProfile.upsert({
      where: { birthProfileId: birthProfileWrite.birthProfileId },
      create: birthProfileWrite,
      update: birthProfileWrite
    });
    await this.client.chart.upsert({
      where: { chartId: input.chart.chart_id },
      create: chartWrite,
      update: chartWrite
    });
    this.fallback.saveChart(input);
  }

  getFollowUpQuotaUsage(quotaKey: string): number {
    return this.fallback.getFollowUpQuotaUsage(quotaKey);
  }

  async getFollowUpQuotaUsageAsync(quotaKey: string): Promise<number> {
    const record = await this.client.followUpQuota.findUnique({ where: { quotaKey } });
    const parsed = record ? parseFollowUpQuotaRecord(asPrismaFollowUpQuotaRecord(record)) : undefined;
    return parsed?.used ?? this.fallback.getFollowUpQuotaUsage(quotaKey);
  }

  incrementFollowUpQuota(input: Omit<FollowUpQuotaUsage, "used" | "updated_at" | "privacy_note">): number {
    const used = this.fallback.incrementFollowUpQuota(input);
    persistToPrisma(this.incrementFollowUpQuotaAsync(input), "incrementFollowUpQuota");
    return used;
  }

  async incrementFollowUpQuotaAsync(input: Omit<FollowUpQuotaUsage, "used" | "updated_at" | "privacy_note">): Promise<number> {
    const created = buildFollowUpQuotaWrite(input, 1);
    const updatedAt = new Date();
    const record = await this.client.followUpQuota.upsert({
      where: { quotaKey: input.quota_key },
      create: created,
      update: {
        subjectId: input.subject_id,
        plan: input.plan,
        windowStart: new Date(input.window_start),
        quotaLimit: input.limit,
        used: { increment: 1 },
        privacyNote: followUpQuotaPrivacyNote,
        updatedAt
      }
    });
    const parsed = parseFollowUpQuotaRecord(asPrismaFollowUpQuotaRecord(record));
    if (parsed) {
      return parsed.used;
    }
    return this.fallback.incrementFollowUpQuota(input);
  }

  saveUser(user: UserAccount): void {
    this.fallback.saveUser(user);
    persistToPrisma(this.saveUserAsync(user), "saveUser");
  }

  async saveUserAsync(user: UserAccount): Promise<void> {
    await this.client.user.upsert({
      where: { memberId: user.member_id },
      create: buildUserWrite(user),
      update: buildUserWrite(user)
    });
    this.fallback.saveUser(user);
  }

  getUser(memberId: string): UserAccount | undefined {
    return this.fallback.getUser(memberId);
  }

  async getUserAsync(memberId: string): Promise<UserAccount | undefined> {
    const record = await this.client.user.findUnique({ where: { memberId } });
    if (!record) return this.fallback.getUser(memberId);
    return parseUserRecord(asPrismaUserRecord(record));
  }

  listUsers(): UserAccount[] {
    return this.fallback.listUsers();
  }

  async listUsersAsync(): Promise<UserAccount[]> {
    const records = await this.client.user.findMany({ orderBy: { createdAt: "asc" } });
    if (!records.length) return this.fallback.listUsers();
    return records.map((record) => parseUserRecord(asPrismaUserRecord(record)));
  }

  saveAnonymousVisitor(visitor: AnonymousVisitor): void {
    this.fallback.saveAnonymousVisitor(visitor);
    persistToPrisma(this.saveAnonymousVisitorAsync(visitor), "saveAnonymousVisitor");
  }

  async saveAnonymousVisitorAsync(visitor: AnonymousVisitor): Promise<void> {
    await this.client.anonymousVisitor.upsert({
      where: { visitorId: visitor.visitor_id },
      create: buildAnonymousVisitorWrite(visitor),
      update: buildAnonymousVisitorWrite(visitor)
    });
    this.fallback.saveAnonymousVisitor(visitor);
  }

  getAnonymousVisitor(visitorId: string): AnonymousVisitor | undefined {
    return this.fallback.getAnonymousVisitor(visitorId);
  }

  async getAnonymousVisitorAsync(visitorId: string): Promise<AnonymousVisitor | undefined> {
    const record = await this.client.anonymousVisitor.findUnique({ where: { visitorId } });
    if (!record) return this.fallback.getAnonymousVisitor(visitorId);
    return parseAnonymousVisitorRecord(asPrismaAnonymousVisitorRecord(record));
  }

  listAnonymousVisitors(): AnonymousVisitor[] {
    return this.fallback.listAnonymousVisitors();
  }

  async listAnonymousVisitorsAsync(): Promise<AnonymousVisitor[]> {
    const records = await this.client.anonymousVisitor.findMany({ orderBy: { firstSeenAt: "asc" } });
    if (!records.length) return this.fallback.listAnonymousVisitors();
    return records.map((record) => parseAnonymousVisitorRecord(asPrismaAnonymousVisitorRecord(record)));
  }

  saveAnonymousLink(link: AnonymousLink): void {
    this.fallback.saveAnonymousLink(link);
    persistToPrisma(this.saveAnonymousLinkAsync(link), "saveAnonymousLink");
  }

  async saveAnonymousLinkAsync(link: AnonymousLink): Promise<void> {
    await this.client.anonymousLink.upsert({
      where: { visitorId: link.visitor_id },
      create: buildAnonymousLinkWrite(link),
      update: buildAnonymousLinkWrite(link)
    });
    this.fallback.saveAnonymousLink(link);
  }

  getAnonymousLink(visitorId: string): AnonymousLink | undefined {
    return this.fallback.getAnonymousLink(visitorId);
  }

  async getAnonymousLinkAsync(visitorId: string): Promise<AnonymousLink | undefined> {
    const record = await this.client.anonymousLink.findUnique({ where: { visitorId } });
    if (!record) return this.fallback.getAnonymousLink(visitorId);
    return parseAnonymousLinkRecord(asPrismaAnonymousLinkRecord(record));
  }

  saveSmsVerificationChallenge(challenge: SmsVerificationChallenge): void {
    this.fallback.saveSmsVerificationChallenge(challenge);
    persistToPrisma(this.saveSmsVerificationChallengeAsync(challenge), "saveSmsVerificationChallenge");
  }

  async saveSmsVerificationChallengeAsync(challenge: SmsVerificationChallenge): Promise<void> {
    await this.client.smsVerificationChallenge.upsert({
      where: { challengeId: challenge.challenge_id },
      create: buildSmsVerificationChallengeWrite(challenge),
      update: buildSmsVerificationChallengeWrite(challenge)
    });
    this.fallback.saveSmsVerificationChallenge(challenge);
  }

  getSmsVerificationChallenge(challengeId: string): SmsVerificationChallenge | undefined {
    return this.fallback.getSmsVerificationChallenge(challengeId);
  }

  async getSmsVerificationChallengeAsync(challengeId: string): Promise<SmsVerificationChallenge | undefined> {
    const record = await this.client.smsVerificationChallenge.findUnique({ where: { challengeId } });
    if (!record) return this.fallback.getSmsVerificationChallenge(challengeId);
    return parseSmsVerificationChallengeRecord(asPrismaSmsVerificationChallengeRecord(record));
  }

  findActiveSmsVerificationChallengeByPhoneHash(
    phoneHash: string,
    nowIso = new Date().toISOString()
  ): SmsVerificationChallenge | undefined {
    return this.fallback.findActiveSmsVerificationChallengeByPhoneHash(phoneHash, nowIso);
  }

  async findActiveSmsVerificationChallengeByPhoneHashAsync(
    phoneHash: string,
    nowIso = new Date().toISOString()
  ): Promise<SmsVerificationChallenge | undefined> {
    const records = await this.client.smsVerificationChallenge.findMany({
      where: { phoneHash, consumedAt: null, expiresAt: { gt: new Date(nowIso) } },
      orderBy: { createdAt: "desc" },
      take: 1
    });
    if (!records.length) return this.fallback.findActiveSmsVerificationChallengeByPhoneHash(phoneHash, nowIso);
    const parsed = records.map((record) => parseSmsVerificationChallengeRecord(asPrismaSmsVerificationChallengeRecord(record)));
    return parsed.sort((left, right) => right.created_at.localeCompare(left.created_at))[0];
  }

  saveShareLandingSnapshot(snapshot: ShareLandingSnapshot): void {
    this.fallback.saveShareLandingSnapshot(snapshot);
    persistToPrisma(this.saveShareLandingSnapshotAsync(snapshot), "saveShareLandingSnapshot");
  }

  async saveShareLandingSnapshotAsync(snapshot: ShareLandingSnapshot): Promise<void> {
    await this.client.share.upsert({
      where: { shareId: snapshot.share_id },
      create: buildShareWrite(snapshot),
      update: buildShareWrite(snapshot)
    });
    this.fallback.saveShareLandingSnapshot(snapshot);
  }

  getShareLandingSnapshot(shareId: string): ShareLandingSnapshot | undefined {
    return this.fallback.getShareLandingSnapshot(shareId);
  }

  async getShareLandingSnapshotAsync(shareId: string): Promise<ShareLandingSnapshot | undefined> {
    const record = await this.client.share.findUnique({ where: { shareId } });
    if (!record) return this.fallback.getShareLandingSnapshot(shareId);
    return parseShareRecord(asPrismaShareRecord(record));
  }

  listShareLandingSnapshots(filter: ShareLandingSnapshotFilter = {}): ShareLandingSnapshot[] {
    return this.fallback.listShareLandingSnapshots(filter);
  }

  async listShareLandingSnapshotsAsync(filter: ShareLandingSnapshotFilter = {}): Promise<ShareLandingSnapshot[]> {
    const records = await this.client.share.findMany({
      where: buildShareWhere(filter),
      orderBy: { createdAt: "asc" }
    });
    if (!records.length) return this.fallback.listShareLandingSnapshots(filter);
    return records.map((record) => parseShareRecord(asPrismaShareRecord(record)));
  }

  saveSupportTicket(ticket: SupportTicket): void {
    this.fallback.saveSupportTicket(ticket);
    persistToPrisma(this.saveSupportTicketAsync(ticket), "saveSupportTicket");
  }

  async saveSupportTicketAsync(ticket: SupportTicket): Promise<void> {
    await this.client.supportTicket.upsert({
      where: { ticketId: ticket.ticket_id },
      create: buildSupportTicketWrite(ticket),
      update: buildSupportTicketWrite(ticket)
    });
    this.fallback.saveSupportTicket(ticket);
  }

  getSupportTicket(ticketId: string): SupportTicket | undefined {
    return this.fallback.getSupportTicket(ticketId);
  }

  async getSupportTicketAsync(ticketId: string): Promise<SupportTicket | undefined> {
    const record = await this.client.supportTicket.findUnique({ where: { ticketId } });
    if (!record) return this.fallback.getSupportTicket(ticketId);
    return parseSupportTicketRecord(asPrismaSupportTicketRecord(record));
  }

  listSupportTickets(filter: SupportTicketFilter = {}): SupportTicket[] {
    return this.fallback.listSupportTickets(filter);
  }

  async listSupportTicketsAsync(filter: SupportTicketFilter = {}): Promise<SupportTicket[]> {
    const records = await this.client.supportTicket.findMany({
      where: buildSupportTicketWhere(filter),
      orderBy: { createdAt: "asc" }
    });
    if (!records.length) return this.fallback.listSupportTickets(filter);
    return records.map((record) => parseSupportTicketRecord(asPrismaSupportTicketRecord(record)));
  }

  saveDataDeletionRequest(record: DataDeletionRequestRecord): void {
    this.fallback.saveDataDeletionRequest(record);
    persistToPrisma(this.saveDataDeletionRequestAsync(record), "saveDataDeletionRequest");
  }

  async saveDataDeletionRequestAsync(record: DataDeletionRequestRecord): Promise<void> {
    await this.client.dataDeletionRequest.upsert({
      where: { deletionRequestId: record.deletion_request_id },
      create: buildDataDeletionRequestWrite(record),
      update: buildDataDeletionRequestWrite(record)
    });
    this.fallback.saveDataDeletionRequest(record);
  }

  getDataDeletionRequest(deletionRequestId: string): DataDeletionRequestRecord | undefined {
    return this.fallback.getDataDeletionRequest(deletionRequestId);
  }

  async getDataDeletionRequestAsync(deletionRequestId: string): Promise<DataDeletionRequestRecord | undefined> {
    const record = await this.client.dataDeletionRequest.findUnique({ where: { deletionRequestId } });
    if (!record) return this.fallback.getDataDeletionRequest(deletionRequestId);
    return parseDataDeletionRequestRecord(asPrismaDataDeletionRequestRecord(record));
  }

  listDataDeletionRequests(filter: DataDeletionRequestFilter = {}): DataDeletionRequestRecord[] {
    return this.fallback.listDataDeletionRequests(filter);
  }

  async listDataDeletionRequestsAsync(filter: DataDeletionRequestFilter = {}): Promise<DataDeletionRequestRecord[]> {
    const records = await this.client.dataDeletionRequest.findMany({
      where: buildDataDeletionRequestWhere(filter),
      orderBy: { requestedAt: "asc" }
    });
    if (!records.length) return this.fallback.listDataDeletionRequests(filter);
    return records.map((record) => parseDataDeletionRequestRecord(asPrismaDataDeletionRequestRecord(record)));
  }

  saveWechatOpenIdBinding(binding: WechatOpenIdBinding): void {
    this.fallback.saveWechatOpenIdBinding(binding);
    persistToPrisma(this.saveWechatOpenIdBindingAsync(binding), "saveWechatOpenIdBinding");
  }

  async saveWechatOpenIdBindingAsync(binding: WechatOpenIdBinding): Promise<void> {
    await this.client.wechatOpenIdBinding.upsert({
      where: { openidHash: binding.openid_hash },
      create: buildWechatOpenIdBindingWrite(binding),
      update: buildWechatOpenIdBindingWrite(binding)
    });
    this.fallback.saveWechatOpenIdBinding(binding);
  }

  getWechatOpenIdBinding(openidHash: string): WechatOpenIdBinding | undefined {
    return this.fallback.getWechatOpenIdBinding(openidHash);
  }

  async getWechatOpenIdBindingAsync(openidHash: string): Promise<WechatOpenIdBinding | undefined> {
    const record = await this.client.wechatOpenIdBinding.findUnique({ where: { openidHash } });
    if (!record) return this.fallback.getWechatOpenIdBinding(openidHash);
    return parseWechatOpenIdBindingRecord(asPrismaWechatOpenIdBindingRecord(record));
  }

  saveChartOwner(owner: ChartOwnerRecord): void {
    this.fallback.saveChartOwner(owner);
    persistToPrisma(this.saveChartOwnerAsync(owner), "saveChartOwner");
  }

  async saveChartOwnerAsync(owner: ChartOwnerRecord): Promise<void> {
    await this.client.chartOwner.upsert({
      where: { chartId: owner.chart_id },
      create: {
        chartId: owner.chart_id,
        visitorId: owner.visitor_id ?? null,
        memberId: owner.member_id ?? null,
        createdAt: new Date(owner.created_at)
      },
      update: {
        visitorId: owner.visitor_id ?? null,
        memberId: owner.member_id ?? null
      }
    });
    this.fallback.saveChartOwner(owner);
  }

  getChartOwner(chartId: string): ChartOwnerRecord | undefined {
    return this.fallback.getChartOwner(chartId);
  }

  async getChartOwnerAsync(chartId: string): Promise<ChartOwnerRecord | undefined> {
    const record = await this.client.chartOwner.findUnique({ where: { chartId } });
    if (!record) return this.fallback.getChartOwner(chartId);
    return {
      chart_id: record.chartId,
      visitor_id: record.visitorId ?? undefined,
      member_id: record.memberId ?? undefined,
      created_at: record.createdAt.toISOString()
    };
  }

  saveOrder(order: Order): void {
    this.fallback.saveOrder(order);
    persistToPrisma(this.saveOrderAsync(order), "saveOrder");
  }

  async saveOrderAsync(order: Order): Promise<void> {
    await this.client.order.upsert({
      where: { orderId: order.order_id },
      create: buildOrderWrite(order),
      update: buildOrderWrite(order)
    });
    this.fallback.saveOrder(order);
  }

  getOrder(orderId: string): Order | undefined {
    return this.fallback.getOrder(orderId);
  }

  async getOrderAsync(orderId: string): Promise<Order | undefined> {
    const record = await this.client.order.findUnique({ where: { orderId } });
    if (!record) return this.fallback.getOrder(orderId);
    return parseOrderRecord(asPrismaOrderRecord(record));
  }

  saveCheckoutSession(session: CheckoutSession): void {
    this.fallback.saveCheckoutSession(session);
    persistToPrisma(this.saveCheckoutSessionAsync(session), "saveCheckoutSession");
  }

  async saveCheckoutSessionAsync(session: CheckoutSession): Promise<void> {
    await this.client.checkoutSession.upsert({
      where: { checkoutSessionId: session.checkout_session_id },
      create: buildCheckoutSessionWrite(session),
      update: buildCheckoutSessionWrite(session)
    });
    this.fallback.saveCheckoutSession(session);
  }

  getCheckoutSession(sessionId: string): CheckoutSession | undefined {
    return this.fallback.getCheckoutSession(sessionId);
  }

  async getCheckoutSessionAsync(sessionId: string): Promise<CheckoutSession | undefined> {
    const record = await this.client.checkoutSession.findUnique({ where: { checkoutSessionId: sessionId } });
    if (!record) return this.fallback.getCheckoutSession(sessionId);
    return parseCheckoutSessionRecord(asPrismaCheckoutSessionRecord(record));
  }

  findCheckoutSessionByOrder(orderId: string): CheckoutSession | undefined {
    return this.fallback.findCheckoutSessionByOrder(orderId);
  }

  async findCheckoutSessionByOrderAsync(orderId: string): Promise<CheckoutSession | undefined> {
    const record = await this.client.checkoutSession.findFirst({ where: { orderId }, orderBy: { createdAt: "desc" } });
    if (!record) return this.fallback.findCheckoutSessionByOrder(orderId);
    return parseCheckoutSessionRecord(asPrismaCheckoutSessionRecord(record));
  }

  savePaymentEvent(event: PaymentEvent): void {
    this.fallback.savePaymentEvent(event);
    persistToPrisma(this.savePaymentEventAsync(event), "savePaymentEvent");
  }

  async savePaymentEventAsync(event: PaymentEvent): Promise<void> {
    await this.client.paymentEvent.create({ data: buildPaymentEventWrite(event) });
    this.fallback.savePaymentEvent(event);
  }

  getPaymentEvent(eventId: string): PaymentEvent | undefined {
    return this.fallback.getPaymentEvent(eventId);
  }

  async getPaymentEventAsync(eventId: string): Promise<PaymentEvent | undefined> {
    const record = await this.client.paymentEvent.findUnique({ where: { paymentEventId: eventId } });
    const parsedRecord = record ? asPrismaPaymentEventRecord(record) : undefined;
    if (!parsedRecord) return this.fallback.getPaymentEvent(eventId);
    return parsePaymentEventRecord(parsedRecord, this.fallback.getOrder(parsedRecord.orderId ?? ""));
  }

  listPaymentEvents(): PaymentEvent[] {
    return this.fallback.listPaymentEvents();
  }

  async listPaymentEventsAsync(): Promise<PaymentEvent[]> {
    const records = await this.client.paymentEvent.findMany({ orderBy: { receivedAt: "asc" } });
    if (!records.length) return this.fallback.listPaymentEvents();
    return records.map((record) => {
      const parsedRecord = asPrismaPaymentEventRecord(record);
      return parsePaymentEventRecord(parsedRecord, this.fallback.getOrder(parsedRecord.orderId ?? ""));
    });
  }

  saveProviderStatement(statement: ProviderStatement): void {
    this.fallback.saveProviderStatement(statement);
    persistToPrisma(this.saveProviderStatementAsync(statement), "saveProviderStatement");
  }

  async saveProviderStatementAsync(statement: ProviderStatement): Promise<void> {
    await this.client.providerStatement.upsert({
      where: { statementId: statement.statement_id },
      create: buildProviderStatementWrite(statement),
      update: buildProviderStatementWrite(statement)
    });
    this.fallback.saveProviderStatement(statement);
  }

  listProviderStatements(): ProviderStatement[] {
    return this.fallback.listProviderStatements();
  }

  async listProviderStatementsAsync(): Promise<ProviderStatement[]> {
    const records = await this.client.providerStatement.findMany({ orderBy: { importedAt: "asc" } });
    if (!records.length) return this.fallback.listProviderStatements();
    return records.map((record) => parseProviderStatementRecord(asPrismaProviderStatementRecord(record)));
  }

  saveRefundRecord(refund: RefundRecord): void {
    this.fallback.saveRefundRecord(refund);
    persistToPrisma(this.saveRefundRecordAsync(refund), "saveRefundRecord");
  }

  async saveRefundRecordAsync(refund: RefundRecord): Promise<void> {
    await this.client.refund.upsert({
      where: { refundId: refund.refund_id },
      create: buildRefundWrite(refund),
      update: buildRefundWrite(refund)
    });
    this.fallback.saveRefundRecord(refund);
  }

  getRefundRecord(refundId: string): RefundRecord | undefined {
    return this.fallback.getRefundRecord(refundId);
  }

  async getRefundRecordAsync(refundId: string): Promise<RefundRecord | undefined> {
    const record = await this.client.refund.findUnique({ where: { refundId } });
    if (!record) return this.fallback.getRefundRecord(refundId);
    return parseRefundRecord(asPrismaRefundRecord(record));
  }

  listRefundRecords(orderId?: string): RefundRecord[] {
    return this.fallback.listRefundRecords(orderId);
  }

  async listRefundRecordsAsync(orderId?: string): Promise<RefundRecord[]> {
    const records = await this.client.refund.findMany({
      where: orderId ? { orderId } : undefined,
      orderBy: { createdAt: "asc" }
    });
    if (!records.length) return this.fallback.listRefundRecords(orderId);
    return records.map((record) => parseRefundRecord(asPrismaRefundRecord(record)));
  }

  saveMemberEntitlement(entitlement: MemberEntitlement): void {
    this.fallback.saveMemberEntitlement(entitlement);
    persistToPrisma(this.saveMemberEntitlementAsync(entitlement), "saveMemberEntitlement");
  }

  async saveMemberEntitlementAsync(entitlement: MemberEntitlement): Promise<void> {
    await this.client.entitlement.upsert({
      where: { memberId_reportId: { memberId: entitlement.member_id, reportId: entitlement.report_id } },
      create: buildEntitlementWrite(entitlement),
      update: buildEntitlementWrite(entitlement)
    });
    this.fallback.saveMemberEntitlement(entitlement);
  }

  getMemberEntitlement(memberId: string, reportId: string): MemberEntitlement | undefined {
    return this.fallback.getMemberEntitlement(memberId, reportId);
  }

  async getMemberEntitlementAsync(memberId: string, reportId: string): Promise<MemberEntitlement | undefined> {
    const record = await this.client.entitlement.findUnique({ where: { memberId_reportId: { memberId, reportId } } });
    if (!record) return this.fallback.getMemberEntitlement(memberId, reportId);
    return parseEntitlementRecord(asPrismaEntitlementRecord(record));
  }

  listOrders(memberId?: string): Order[] {
    return this.fallback.listOrders(memberId);
  }

  async listOrdersAsync(memberId?: string): Promise<Order[]> {
    const records = await this.client.order.findMany({
      where: memberId ? { memberId } : undefined,
      orderBy: { createdAt: "asc" }
    });
    if (!records.length) return this.fallback.listOrders(memberId);
    return records.map((record) => parseOrderRecord(asPrismaOrderRecord(record)));
  }

  listMemberEntitlements(memberId?: string): MemberEntitlement[] {
    return this.fallback.listMemberEntitlements(memberId);
  }

  async listMemberEntitlementsAsync(memberId?: string): Promise<MemberEntitlement[]> {
    const records = await this.client.entitlement.findMany({
      where: memberId ? { memberId } : undefined,
      orderBy: { createdAt: "asc" }
    });
    if (!records.length) return this.fallback.listMemberEntitlements(memberId);
    return records.map((record) => parseEntitlementRecord(asPrismaEntitlementRecord(record)));
  }

  saveProductEvent(event: ProductEventRecord): void {
    this.fallback.saveProductEvent(event);
    persistToPrisma(this.saveProductEventAsync(event), "saveProductEvent");
  }

  async saveProductEventAsync(event: ProductEventRecord): Promise<void> {
    await this.client.analyticsEvent.create({
      data: {
        analyticsEventId: event.product_event_id,
        type: event.type,
        visitorId: event.visitor_id ?? null,
        memberId: event.member_id ?? null,
        chartId: event.chart_id ?? null,
        reportId: event.report_id ?? null,
        orderId: event.order_id ?? null,
        metadataJson: buildAnalyticsMetadataJson(event),
        createdAt: new Date(event.created_at)
      }
    });
    this.fallback.saveProductEvent(event);
  }

  listProductEvents(): ProductEventRecord[] {
    return this.fallback.listProductEvents();
  }

  saveAdminAuditLog(record: AdminAuditLog): void {
    this.fallback.saveAdminAuditLog(record);
    persistToPrisma(this.saveAdminAuditLogAsync(record), "saveAdminAuditLog");
  }

  async saveAdminAuditLogAsync(record: AdminAuditLog): Promise<void> {
    await this.client.auditLog.upsert({
      where: { auditLogId: record.audit_log_id },
      create: buildAdminAuditLogWrite(record),
      update: buildAdminAuditLogWrite(record)
    });
    this.fallback.saveAdminAuditLog(record);
  }

  listAdminAuditLogs(): AdminAuditLog[] {
    return this.fallback.listAdminAuditLogs();
  }

  async listAdminAuditLogsAsync(): Promise<AdminAuditLog[]> {
    const records = await this.client.auditLog.findMany({ orderBy: { createdAt: "asc" } });
    if (!records.length) return this.fallback.listAdminAuditLogs();
    return records.map((record) => parseAdminAuditLogRecord(asPrismaAdminAuditLogRecord(record)));
  }

  saveRuleVersionState(record: RuleVersionStateRecord): void {
    this.fallback.saveRuleVersionState(record);
    persistToPrisma(this.saveRuleVersionStateAsync(record), "saveRuleVersionState");
  }

  async saveRuleVersionStateAsync(record: RuleVersionStateRecord): Promise<void> {
    await this.client.ruleVersion.upsert({
      where: { ruleVersionId: record.rule_version_id },
      create: buildRuleVersionWrite(record),
      update: buildRuleVersionWrite(record)
    });
    this.fallback.saveRuleVersionState(record);
  }

  getActiveRuleVersionState(): RuleVersionStateRecord | undefined {
    return this.fallback.getActiveRuleVersionState();
  }

  async getActiveRuleVersionStateAsync(): Promise<RuleVersionStateRecord | undefined> {
    const record = await this.client.ruleVersion.findFirst({
      where: { activeDefault: true },
      orderBy: { updatedAt: "desc" }
    });
    if (!record) return this.fallback.getActiveRuleVersionState();
    const parsed = parseRuleVersionRecord(asPrismaRuleVersionRecord(record));
    this.fallback.saveRuleVersionState(parsed);
    return parsed;
  }

  saveReportDraft(draft: ReportDraft): void {
    this.fallback.saveReportDraft(draft);
    persistToPrisma(this.saveReportDraftAsync(draft), "saveReportDraft");
  }

  async saveReportDraftAsync(draft: ReportDraft): Promise<void> {
    const chartOwner = draft.chart_ref?.chart_id ? await this.getChartOwnerAsync(draft.chart_ref.chart_id) : undefined;
    await this.client.report.upsert({
      where: { reportId: draft.report_id },
      create: buildReportWrite(draft, chartOwner),
      update: buildReportWrite(draft, chartOwner)
    });
    await this.client.reportVersion.upsert({
      where: { reportId_version: { reportId: draft.report_id, version: 1 } },
      create: buildReportVersionWrite(draft),
      update: buildReportVersionWrite(draft)
    });
    this.fallback.saveReportDraft(draft);
  }

  getReportDraft(reportId: string): ReportDraft | undefined {
    return this.fallback.getReportDraft(reportId);
  }

  async getReportDraftAsync(reportId: string): Promise<ReportDraft | undefined> {
    const version = await this.client.reportVersion.findFirst({ where: { reportId }, orderBy: { version: "desc" } });
    if (!version) return this.fallback.getReportDraft(reportId);
    return parseReportVersionRecord(asPrismaReportVersionRecord(version));
  }

  listReportDrafts(filter: ReportDraftFilter = {}): ReportDraft[] {
    return this.fallback.listReportDrafts(filter);
  }

  async listReportDraftsAsync(filter: ReportDraftFilter = {}): Promise<ReportDraft[]> {
    const records = await this.client.report.findMany({
      where: buildReportWhere(filter),
      orderBy: { createdAt: "asc" }
    });
    if (!records.length) return this.fallback.listReportDrafts(filter);
    const drafts: ReportDraft[] = [];
    for (const record of records) {
      const report = asPrismaReportRecord(record);
      const draft = await this.getReportDraftAsync(report.reportId);
      if (draft) drafts.push(draft);
    }
    return drafts;
  }

  saveReportGenerationJob(job: ReportGenerationJob): void {
    this.fallback.saveReportGenerationJob(job);
    persistToPrisma(this.saveReportGenerationJobAsync(job), "saveReportGenerationJob");
  }

  async saveReportGenerationJobAsync(job: ReportGenerationJob): Promise<void> {
    await this.client.reportGenerationJob.upsert({
      where: { jobId: job.job_id },
      create: buildReportGenerationJobWrite(job),
      update: buildReportGenerationJobWrite(job)
    });
    this.fallback.saveReportGenerationJob(job);
  }

  getReportGenerationJob(jobId: string): ReportGenerationJob | undefined {
    return this.fallback.getReportGenerationJob(jobId);
  }

  async getReportGenerationJobAsync(jobId: string): Promise<ReportGenerationJob | undefined> {
    const record = await this.client.reportGenerationJob.findUnique({ where: { jobId } });
    if (!record) return this.fallback.getReportGenerationJob(jobId);
    return parseReportGenerationJobRecord(asPrismaReportGenerationJobRecord(record));
  }

  listReportGenerationJobs(filter: ReportGenerationJobFilter = {}): ReportGenerationJob[] {
    return this.fallback.listReportGenerationJobs(filter);
  }

  async listReportGenerationJobsAsync(filter: ReportGenerationJobFilter = {}): Promise<ReportGenerationJob[]> {
    const records = await this.client.reportGenerationJob.findMany({
      where: buildReportGenerationJobWhere(filter),
      orderBy: { createdAt: "asc" }
    });
    if (!records.length) return this.fallback.listReportGenerationJobs(filter);
    return records.map((record) => parseReportGenerationJobRecord(asPrismaReportGenerationJobRecord(record)));
  }

  saveExportPreview(preview: ExportPreview): void {
    this.fallback.saveExportPreview(preview);
    persistToPrisma(this.saveExportPreviewAsync(preview), "saveExportPreview");
  }

  async saveExportPreviewAsync(preview: ExportPreview): Promise<void> {
    await this.client.exportPreview.upsert({
      where: { exportPreviewId: preview.export_preview_id },
      create: buildExportPreviewWrite(preview),
      update: buildExportPreviewWrite(preview)
    });
    this.fallback.saveExportPreview(preview);
  }

  getExportPreview(exportPreviewId: string): ExportPreview | undefined {
    return this.fallback.getExportPreview(exportPreviewId);
  }

  async getExportPreviewAsync(exportPreviewId: string): Promise<ExportPreview | undefined> {
    const record = await this.client.exportPreview.findUnique({ where: { exportPreviewId } });
    if (!record) return this.fallback.getExportPreview(exportPreviewId);
    return parseExportPreviewRecord(asPrismaExportPreviewRecord(record));
  }

  listExportPreviews(): ExportPreview[] {
    return this.fallback.listExportPreviews();
  }

  async listExportPreviewsAsync(): Promise<ExportPreview[]> {
    const records = await this.client.exportPreview.findMany({ orderBy: { createdAt: "asc" } });
    if (!records.length) return this.fallback.listExportPreviews();
    return records.map((record) => parseExportPreviewRecord(asPrismaExportPreviewRecord(record)));
  }

  saveAiGenerationRecord(record: AiGenerationRecord): void {
    this.fallback.saveAiGenerationRecord(record);
    persistToPrisma(this.saveAiGenerationRecordAsync(record), "saveAiGenerationRecord");
  }

  async saveAiGenerationRecordAsync(record: AiGenerationRecord): Promise<void> {
    await this.client.aiGenerationLog.upsert({
      where: { generationId: record.generation_id },
      create: buildAiGenerationLogWrite(record),
      update: buildAiGenerationLogWrite(record)
    });
    this.fallback.saveAiGenerationRecord(record);
  }

  getAiGenerationRecord(generationId: string): AiGenerationRecord | undefined {
    return this.fallback.getAiGenerationRecord(generationId);
  }

  async getAiGenerationRecordAsync(generationId: string): Promise<AiGenerationRecord | undefined> {
    const record = await this.client.aiGenerationLog.findUnique({ where: { generationId } });
    if (!record) return this.fallback.getAiGenerationRecord(generationId);
    return parseAiGenerationLogRecord(asPrismaAiGenerationLogRecord(record));
  }

  listAiGenerationRecords(filter: AiGenerationRecordFilter = {}): AiGenerationRecord[] {
    return this.fallback.listAiGenerationRecords(filter);
  }

  async listAiGenerationRecordsAsync(filter: AiGenerationRecordFilter = {}): Promise<AiGenerationRecord[]> {
    const records = await this.client.aiGenerationLog.findMany({
      where: buildAiGenerationLogWhere(filter),
      orderBy: { createdAt: "asc" }
    });
    if (!records.length) return this.fallback.listAiGenerationRecords(filter);
    return records.map((record) => parseAiGenerationLogRecord(asPrismaAiGenerationLogRecord(record)));
  }

  saveContentReviewRecord(record: ContentReviewQueueItem): void {
    this.fallback.saveContentReviewRecord(record);
    persistToPrisma(this.saveContentReviewRecordAsync(record), "saveContentReviewRecord");
  }

  async saveContentReviewRecordAsync(record: ContentReviewQueueItem): Promise<void> {
    await this.client.contentReviewRecord.upsert({
      where: { reviewId: record.review_id },
      create: buildContentReviewRecordWrite(record),
      update: buildContentReviewRecordWrite(record)
    });
    this.fallback.saveContentReviewRecord(record);
  }

  getContentReviewRecord(reviewId: string): ContentReviewQueueItem | undefined {
    return this.fallback.getContentReviewRecord(reviewId);
  }

  async getContentReviewRecordAsync(reviewId: string): Promise<ContentReviewQueueItem | undefined> {
    const record = await this.client.contentReviewRecord.findUnique({ where: { reviewId } });
    if (!record) return this.fallback.getContentReviewRecord(reviewId);
    return parseContentReviewRecord(asPrismaContentReviewRecord(record));
  }

  listContentReviewRecords(filter: ContentReviewRecordFilter = {}): ContentReviewQueueItem[] {
    return this.fallback.listContentReviewRecords(filter);
  }

  async listContentReviewRecordsAsync(filter: ContentReviewRecordFilter = {}): Promise<ContentReviewQueueItem[]> {
    const records = await this.client.contentReviewRecord.findMany({
      where: buildContentReviewWhere(filter),
      orderBy: { checkedAt: "asc" }
    });
    if (!records.length) return this.fallback.listContentReviewRecords(filter);
    return records.map((record) => parseContentReviewRecord(asPrismaContentReviewRecord(record)));
  }
}

class LazyProductRepository implements ProductRepository {
  private resolved?: ProductRepository;

  getChart(chartId: string): ChartCreateResponse | undefined {
    return this.getResolvedRepository().getChart(chartId);
  }

  async getChartAsync(chartId: string): Promise<ChartCreateResponse | undefined> {
    return this.getResolvedRepository().getChartAsync(chartId);
  }

  saveChart(input: ChartPersistenceInput): void {
    this.getResolvedRepository().saveChart(input);
  }

  async saveChartAsync(input: ChartPersistenceInput): Promise<void> {
    await this.getResolvedRepository().saveChartAsync(input);
  }

  getFollowUpQuotaUsage(quotaKey: string): number {
    return this.getResolvedRepository().getFollowUpQuotaUsage(quotaKey);
  }

  async getFollowUpQuotaUsageAsync(quotaKey: string): Promise<number> {
    return this.getResolvedRepository().getFollowUpQuotaUsageAsync(quotaKey);
  }

  incrementFollowUpQuota(input: Omit<FollowUpQuotaUsage, "used" | "updated_at" | "privacy_note">): number {
    return this.getResolvedRepository().incrementFollowUpQuota(input);
  }

  async incrementFollowUpQuotaAsync(input: Omit<FollowUpQuotaUsage, "used" | "updated_at" | "privacy_note">): Promise<number> {
    return this.getResolvedRepository().incrementFollowUpQuotaAsync(input);
  }

  saveUser(user: UserAccount): void {
    this.getResolvedRepository().saveUser(user);
  }

  async saveUserAsync(user: UserAccount): Promise<void> {
    await this.getResolvedRepository().saveUserAsync(user);
  }

  getUser(memberId: string): UserAccount | undefined {
    return this.getResolvedRepository().getUser(memberId);
  }

  async getUserAsync(memberId: string): Promise<UserAccount | undefined> {
    return this.getResolvedRepository().getUserAsync(memberId);
  }

  listUsers(): UserAccount[] {
    return this.getResolvedRepository().listUsers();
  }

  async listUsersAsync(): Promise<UserAccount[]> {
    return this.getResolvedRepository().listUsersAsync();
  }

  saveAnonymousVisitor(visitor: AnonymousVisitor): void {
    this.getResolvedRepository().saveAnonymousVisitor(visitor);
  }

  async saveAnonymousVisitorAsync(visitor: AnonymousVisitor): Promise<void> {
    await this.getResolvedRepository().saveAnonymousVisitorAsync(visitor);
  }

  getAnonymousVisitor(visitorId: string): AnonymousVisitor | undefined {
    return this.getResolvedRepository().getAnonymousVisitor(visitorId);
  }

  async getAnonymousVisitorAsync(visitorId: string): Promise<AnonymousVisitor | undefined> {
    return this.getResolvedRepository().getAnonymousVisitorAsync(visitorId);
  }

  listAnonymousVisitors(): AnonymousVisitor[] {
    return this.getResolvedRepository().listAnonymousVisitors();
  }

  async listAnonymousVisitorsAsync(): Promise<AnonymousVisitor[]> {
    return this.getResolvedRepository().listAnonymousVisitorsAsync();
  }

  saveAnonymousLink(link: AnonymousLink): void {
    this.getResolvedRepository().saveAnonymousLink(link);
  }

  async saveAnonymousLinkAsync(link: AnonymousLink): Promise<void> {
    await this.getResolvedRepository().saveAnonymousLinkAsync(link);
  }

  getAnonymousLink(visitorId: string): AnonymousLink | undefined {
    return this.getResolvedRepository().getAnonymousLink(visitorId);
  }

  async getAnonymousLinkAsync(visitorId: string): Promise<AnonymousLink | undefined> {
    return this.getResolvedRepository().getAnonymousLinkAsync(visitorId);
  }

  saveSmsVerificationChallenge(challenge: SmsVerificationChallenge): void {
    this.getResolvedRepository().saveSmsVerificationChallenge(challenge);
  }

  async saveSmsVerificationChallengeAsync(challenge: SmsVerificationChallenge): Promise<void> {
    await this.getResolvedRepository().saveSmsVerificationChallengeAsync(challenge);
  }

  getSmsVerificationChallenge(challengeId: string): SmsVerificationChallenge | undefined {
    return this.getResolvedRepository().getSmsVerificationChallenge(challengeId);
  }

  async getSmsVerificationChallengeAsync(challengeId: string): Promise<SmsVerificationChallenge | undefined> {
    return this.getResolvedRepository().getSmsVerificationChallengeAsync(challengeId);
  }

  findActiveSmsVerificationChallengeByPhoneHash(
    phoneHash: string,
    nowIso = new Date().toISOString()
  ): SmsVerificationChallenge | undefined {
    return this.getResolvedRepository().findActiveSmsVerificationChallengeByPhoneHash(phoneHash, nowIso);
  }

  async findActiveSmsVerificationChallengeByPhoneHashAsync(
    phoneHash: string,
    nowIso = new Date().toISOString()
  ): Promise<SmsVerificationChallenge | undefined> {
    return this.getResolvedRepository().findActiveSmsVerificationChallengeByPhoneHashAsync(phoneHash, nowIso);
  }

  saveShareLandingSnapshot(snapshot: ShareLandingSnapshot): void {
    this.getResolvedRepository().saveShareLandingSnapshot(snapshot);
  }

  async saveShareLandingSnapshotAsync(snapshot: ShareLandingSnapshot): Promise<void> {
    await this.getResolvedRepository().saveShareLandingSnapshotAsync(snapshot);
  }

  getShareLandingSnapshot(shareId: string): ShareLandingSnapshot | undefined {
    return this.getResolvedRepository().getShareLandingSnapshot(shareId);
  }

  async getShareLandingSnapshotAsync(shareId: string): Promise<ShareLandingSnapshot | undefined> {
    return this.getResolvedRepository().getShareLandingSnapshotAsync(shareId);
  }

  listShareLandingSnapshots(filter: ShareLandingSnapshotFilter = {}): ShareLandingSnapshot[] {
    return this.getResolvedRepository().listShareLandingSnapshots(filter);
  }

  async listShareLandingSnapshotsAsync(filter: ShareLandingSnapshotFilter = {}): Promise<ShareLandingSnapshot[]> {
    return this.getResolvedRepository().listShareLandingSnapshotsAsync(filter);
  }

  saveSupportTicket(ticket: SupportTicket): void {
    this.getResolvedRepository().saveSupportTicket(ticket);
  }

  async saveSupportTicketAsync(ticket: SupportTicket): Promise<void> {
    await this.getResolvedRepository().saveSupportTicketAsync(ticket);
  }

  getSupportTicket(ticketId: string): SupportTicket | undefined {
    return this.getResolvedRepository().getSupportTicket(ticketId);
  }

  async getSupportTicketAsync(ticketId: string): Promise<SupportTicket | undefined> {
    return this.getResolvedRepository().getSupportTicketAsync(ticketId);
  }

  listSupportTickets(filter: SupportTicketFilter = {}): SupportTicket[] {
    return this.getResolvedRepository().listSupportTickets(filter);
  }

  async listSupportTicketsAsync(filter: SupportTicketFilter = {}): Promise<SupportTicket[]> {
    return this.getResolvedRepository().listSupportTicketsAsync(filter);
  }

  saveDataDeletionRequest(record: DataDeletionRequestRecord): void {
    this.getResolvedRepository().saveDataDeletionRequest(record);
  }

  async saveDataDeletionRequestAsync(record: DataDeletionRequestRecord): Promise<void> {
    await this.getResolvedRepository().saveDataDeletionRequestAsync(record);
  }

  getDataDeletionRequest(deletionRequestId: string): DataDeletionRequestRecord | undefined {
    return this.getResolvedRepository().getDataDeletionRequest(deletionRequestId);
  }

  async getDataDeletionRequestAsync(deletionRequestId: string): Promise<DataDeletionRequestRecord | undefined> {
    return this.getResolvedRepository().getDataDeletionRequestAsync(deletionRequestId);
  }

  listDataDeletionRequests(filter: DataDeletionRequestFilter = {}): DataDeletionRequestRecord[] {
    return this.getResolvedRepository().listDataDeletionRequests(filter);
  }

  async listDataDeletionRequestsAsync(filter: DataDeletionRequestFilter = {}): Promise<DataDeletionRequestRecord[]> {
    return this.getResolvedRepository().listDataDeletionRequestsAsync(filter);
  }

  saveWechatOpenIdBinding(binding: WechatOpenIdBinding): void {
    this.getResolvedRepository().saveWechatOpenIdBinding(binding);
  }

  async saveWechatOpenIdBindingAsync(binding: WechatOpenIdBinding): Promise<void> {
    await this.getResolvedRepository().saveWechatOpenIdBindingAsync(binding);
  }

  getWechatOpenIdBinding(openidHash: string): WechatOpenIdBinding | undefined {
    return this.getResolvedRepository().getWechatOpenIdBinding(openidHash);
  }

  async getWechatOpenIdBindingAsync(openidHash: string): Promise<WechatOpenIdBinding | undefined> {
    return this.getResolvedRepository().getWechatOpenIdBindingAsync(openidHash);
  }

  saveChartOwner(owner: ChartOwnerRecord): void {
    this.getResolvedRepository().saveChartOwner(owner);
  }

  async saveChartOwnerAsync(owner: ChartOwnerRecord): Promise<void> {
    await this.getResolvedRepository().saveChartOwnerAsync(owner);
  }

  getChartOwner(chartId: string): ChartOwnerRecord | undefined {
    return this.getResolvedRepository().getChartOwner(chartId);
  }

  async getChartOwnerAsync(chartId: string): Promise<ChartOwnerRecord | undefined> {
    return this.getResolvedRepository().getChartOwnerAsync(chartId);
  }

  saveOrder(order: Order): void {
    this.getResolvedRepository().saveOrder(order);
  }

  async saveOrderAsync(order: Order): Promise<void> {
    await this.getResolvedRepository().saveOrderAsync(order);
  }

  getOrder(orderId: string): Order | undefined {
    return this.getResolvedRepository().getOrder(orderId);
  }

  async getOrderAsync(orderId: string): Promise<Order | undefined> {
    return this.getResolvedRepository().getOrderAsync(orderId);
  }

  saveCheckoutSession(session: CheckoutSession): void {
    this.getResolvedRepository().saveCheckoutSession(session);
  }

  async saveCheckoutSessionAsync(session: CheckoutSession): Promise<void> {
    await this.getResolvedRepository().saveCheckoutSessionAsync(session);
  }

  getCheckoutSession(sessionId: string): CheckoutSession | undefined {
    return this.getResolvedRepository().getCheckoutSession(sessionId);
  }

  async getCheckoutSessionAsync(sessionId: string): Promise<CheckoutSession | undefined> {
    return this.getResolvedRepository().getCheckoutSessionAsync(sessionId);
  }

  findCheckoutSessionByOrder(orderId: string): CheckoutSession | undefined {
    return this.getResolvedRepository().findCheckoutSessionByOrder(orderId);
  }

  async findCheckoutSessionByOrderAsync(orderId: string): Promise<CheckoutSession | undefined> {
    return this.getResolvedRepository().findCheckoutSessionByOrderAsync(orderId);
  }

  savePaymentEvent(event: PaymentEvent): void {
    this.getResolvedRepository().savePaymentEvent(event);
  }

  async savePaymentEventAsync(event: PaymentEvent): Promise<void> {
    await this.getResolvedRepository().savePaymentEventAsync(event);
  }

  getPaymentEvent(eventId: string): PaymentEvent | undefined {
    return this.getResolvedRepository().getPaymentEvent(eventId);
  }

  async getPaymentEventAsync(eventId: string): Promise<PaymentEvent | undefined> {
    return this.getResolvedRepository().getPaymentEventAsync(eventId);
  }

  listPaymentEvents(): PaymentEvent[] {
    return this.getResolvedRepository().listPaymentEvents();
  }

  async listPaymentEventsAsync(): Promise<PaymentEvent[]> {
    return this.getResolvedRepository().listPaymentEventsAsync();
  }

  saveProviderStatement(statement: ProviderStatement): void {
    this.getResolvedRepository().saveProviderStatement(statement);
  }

  async saveProviderStatementAsync(statement: ProviderStatement): Promise<void> {
    await this.getResolvedRepository().saveProviderStatementAsync(statement);
  }

  listProviderStatements(): ProviderStatement[] {
    return this.getResolvedRepository().listProviderStatements();
  }

  async listProviderStatementsAsync(): Promise<ProviderStatement[]> {
    return this.getResolvedRepository().listProviderStatementsAsync();
  }

  saveRefundRecord(refund: RefundRecord): void {
    this.getResolvedRepository().saveRefundRecord(refund);
  }

  async saveRefundRecordAsync(refund: RefundRecord): Promise<void> {
    await this.getResolvedRepository().saveRefundRecordAsync(refund);
  }

  getRefundRecord(refundId: string): RefundRecord | undefined {
    return this.getResolvedRepository().getRefundRecord(refundId);
  }

  async getRefundRecordAsync(refundId: string): Promise<RefundRecord | undefined> {
    return this.getResolvedRepository().getRefundRecordAsync(refundId);
  }

  listRefundRecords(orderId?: string): RefundRecord[] {
    return this.getResolvedRepository().listRefundRecords(orderId);
  }

  async listRefundRecordsAsync(orderId?: string): Promise<RefundRecord[]> {
    return this.getResolvedRepository().listRefundRecordsAsync(orderId);
  }

  saveMemberEntitlement(entitlement: MemberEntitlement): void {
    this.getResolvedRepository().saveMemberEntitlement(entitlement);
  }

  async saveMemberEntitlementAsync(entitlement: MemberEntitlement): Promise<void> {
    await this.getResolvedRepository().saveMemberEntitlementAsync(entitlement);
  }

  getMemberEntitlement(memberId: string, reportId: string): MemberEntitlement | undefined {
    return this.getResolvedRepository().getMemberEntitlement(memberId, reportId);
  }

  async getMemberEntitlementAsync(memberId: string, reportId: string): Promise<MemberEntitlement | undefined> {
    return this.getResolvedRepository().getMemberEntitlementAsync(memberId, reportId);
  }

  listOrders(memberId?: string): Order[] {
    return this.getResolvedRepository().listOrders(memberId);
  }

  async listOrdersAsync(memberId?: string): Promise<Order[]> {
    return this.getResolvedRepository().listOrdersAsync(memberId);
  }

  listMemberEntitlements(memberId?: string): MemberEntitlement[] {
    return this.getResolvedRepository().listMemberEntitlements(memberId);
  }

  async listMemberEntitlementsAsync(memberId?: string): Promise<MemberEntitlement[]> {
    return this.getResolvedRepository().listMemberEntitlementsAsync(memberId);
  }

  saveProductEvent(event: ProductEventRecord): void {
    this.getResolvedRepository().saveProductEvent(event);
  }

  async saveProductEventAsync(event: ProductEventRecord): Promise<void> {
    await this.getResolvedRepository().saveProductEventAsync(event);
  }

  listProductEvents(): ProductEventRecord[] {
    return this.getResolvedRepository().listProductEvents();
  }

  saveAdminAuditLog(record: AdminAuditLog): void {
    this.getResolvedRepository().saveAdminAuditLog(record);
  }

  async saveAdminAuditLogAsync(record: AdminAuditLog): Promise<void> {
    await this.getResolvedRepository().saveAdminAuditLogAsync(record);
  }

  listAdminAuditLogs(): AdminAuditLog[] {
    return this.getResolvedRepository().listAdminAuditLogs();
  }

  async listAdminAuditLogsAsync(): Promise<AdminAuditLog[]> {
    return this.getResolvedRepository().listAdminAuditLogsAsync();
  }

  saveRuleVersionState(record: RuleVersionStateRecord): void {
    this.getResolvedRepository().saveRuleVersionState(record);
  }

  async saveRuleVersionStateAsync(record: RuleVersionStateRecord): Promise<void> {
    await this.getResolvedRepository().saveRuleVersionStateAsync(record);
  }

  getActiveRuleVersionState(): RuleVersionStateRecord | undefined {
    return this.getResolvedRepository().getActiveRuleVersionState();
  }

  async getActiveRuleVersionStateAsync(): Promise<RuleVersionStateRecord | undefined> {
    return this.getResolvedRepository().getActiveRuleVersionStateAsync();
  }

  saveReportDraft(draft: ReportDraft): void {
    this.getResolvedRepository().saveReportDraft(draft);
  }

  async saveReportDraftAsync(draft: ReportDraft): Promise<void> {
    await this.getResolvedRepository().saveReportDraftAsync(draft);
  }

  getReportDraft(reportId: string): ReportDraft | undefined {
    return this.getResolvedRepository().getReportDraft(reportId);
  }

  async getReportDraftAsync(reportId: string): Promise<ReportDraft | undefined> {
    return this.getResolvedRepository().getReportDraftAsync(reportId);
  }

  listReportDrafts(filter: ReportDraftFilter = {}): ReportDraft[] {
    return this.getResolvedRepository().listReportDrafts(filter);
  }

  async listReportDraftsAsync(filter: ReportDraftFilter = {}): Promise<ReportDraft[]> {
    return this.getResolvedRepository().listReportDraftsAsync(filter);
  }

  saveReportGenerationJob(job: ReportGenerationJob): void {
    this.getResolvedRepository().saveReportGenerationJob(job);
  }

  async saveReportGenerationJobAsync(job: ReportGenerationJob): Promise<void> {
    await this.getResolvedRepository().saveReportGenerationJobAsync(job);
  }

  getReportGenerationJob(jobId: string): ReportGenerationJob | undefined {
    return this.getResolvedRepository().getReportGenerationJob(jobId);
  }

  async getReportGenerationJobAsync(jobId: string): Promise<ReportGenerationJob | undefined> {
    return this.getResolvedRepository().getReportGenerationJobAsync(jobId);
  }

  listReportGenerationJobs(filter: ReportGenerationJobFilter = {}): ReportGenerationJob[] {
    return this.getResolvedRepository().listReportGenerationJobs(filter);
  }

  async listReportGenerationJobsAsync(filter: ReportGenerationJobFilter = {}): Promise<ReportGenerationJob[]> {
    return this.getResolvedRepository().listReportGenerationJobsAsync(filter);
  }

  saveExportPreview(preview: ExportPreview): void {
    this.getResolvedRepository().saveExportPreview(preview);
  }

  async saveExportPreviewAsync(preview: ExportPreview): Promise<void> {
    await this.getResolvedRepository().saveExportPreviewAsync(preview);
  }

  getExportPreview(exportPreviewId: string): ExportPreview | undefined {
    return this.getResolvedRepository().getExportPreview(exportPreviewId);
  }

  async getExportPreviewAsync(exportPreviewId: string): Promise<ExportPreview | undefined> {
    return this.getResolvedRepository().getExportPreviewAsync(exportPreviewId);
  }

  listExportPreviews(): ExportPreview[] {
    return this.getResolvedRepository().listExportPreviews();
  }

  async listExportPreviewsAsync(): Promise<ExportPreview[]> {
    return this.getResolvedRepository().listExportPreviewsAsync();
  }

  saveAiGenerationRecord(record: AiGenerationRecord): void {
    this.getResolvedRepository().saveAiGenerationRecord(record);
  }

  async saveAiGenerationRecordAsync(record: AiGenerationRecord): Promise<void> {
    await this.getResolvedRepository().saveAiGenerationRecordAsync(record);
  }

  getAiGenerationRecord(generationId: string): AiGenerationRecord | undefined {
    return this.getResolvedRepository().getAiGenerationRecord(generationId);
  }

  async getAiGenerationRecordAsync(generationId: string): Promise<AiGenerationRecord | undefined> {
    return this.getResolvedRepository().getAiGenerationRecordAsync(generationId);
  }

  listAiGenerationRecords(filter: AiGenerationRecordFilter = {}): AiGenerationRecord[] {
    return this.getResolvedRepository().listAiGenerationRecords(filter);
  }

  async listAiGenerationRecordsAsync(filter: AiGenerationRecordFilter = {}): Promise<AiGenerationRecord[]> {
    return this.getResolvedRepository().listAiGenerationRecordsAsync(filter);
  }

  saveContentReviewRecord(record: ContentReviewQueueItem): void {
    this.getResolvedRepository().saveContentReviewRecord(record);
  }

  async saveContentReviewRecordAsync(record: ContentReviewQueueItem): Promise<void> {
    await this.getResolvedRepository().saveContentReviewRecordAsync(record);
  }

  getContentReviewRecord(reviewId: string): ContentReviewQueueItem | undefined {
    return this.getResolvedRepository().getContentReviewRecord(reviewId);
  }

  async getContentReviewRecordAsync(reviewId: string): Promise<ContentReviewQueueItem | undefined> {
    return this.getResolvedRepository().getContentReviewRecordAsync(reviewId);
  }

  listContentReviewRecords(filter: ContentReviewRecordFilter = {}): ContentReviewQueueItem[] {
    return this.getResolvedRepository().listContentReviewRecords(filter);
  }

  async listContentReviewRecordsAsync(filter: ContentReviewRecordFilter = {}): Promise<ContentReviewQueueItem[]> {
    return this.getResolvedRepository().listContentReviewRecordsAsync(filter);
  }

  private getResolvedRepository(): ProductRepository {
    this.resolved ??= createProductRepository();
    return this.resolved;
  }
}

function buildAnalyticsMetadataJson(event: ProductEventRecord): Prisma.InputJsonObject {
  const metadata: Record<string, string | number | boolean | undefined> = {
    ...event.metadata,
    share_id: event.share_id,
    result: event.result,
    privacy_note: event.privacy_note
  };

  return Object.fromEntries(
    Object.entries(metadata).filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)
  );
}

function buildAdminAuditLogWrite(record: AdminAuditLog): PrismaAdminAuditLogWrite {
  return {
    auditLogId: record.audit_log_id,
    actorId: record.actor_id,
    actorRole: record.actor_role,
    action: record.action,
    targetType: record.target_type,
    targetId: record.target_id ?? null,
    metadataJson: toJsonObject({
      ...record.metadata,
      privacy_note: record.privacy_note
    }),
    ipHash: record.ip_hash ?? null,
    createdAt: new Date(record.created_at)
  };
}

function parseAdminAuditLogRecord(record: PrismaAdminAuditLogRecord): AdminAuditLog {
  const metadata = objectFromUnknown(record.metadataJson) as AdminAuditLog["metadata"];
  return {
    audit_log_id: record.auditLogId,
    actor_id: record.actorId,
    actor_role: record.actorRole as AdminAuditLog["actor_role"],
    action: record.action,
    target_type: record.targetType,
    target_id: record.targetId ?? undefined,
    metadata,
    ip_hash: record.ipHash ?? undefined,
    created_at: record.createdAt.toISOString(),
    privacy_note:
      typeof metadata.privacy_note === "string"
        ? metadata.privacy_note
        : "Admin audit logs store actor, action, target, and redacted metadata only."
  };
}

function buildRuleVersionWrite(record: RuleVersionStateRecord): PrismaRuleVersionWrite {
  return {
    ruleVersionId: record.rule_version_id,
    profileId: record.profile_id,
    label: record.label,
    status: record.status,
    activeDefault: record.active_default,
    configJson: toJsonObject({
      ...record.config,
      privacy_note: record.privacy_note
    }),
    releasedAt: record.released_at ? new Date(record.released_at) : null,
    updatedAt: new Date(record.updated_at)
  };
}

function parseRuleVersionRecord(record: PrismaRuleVersionRecord): RuleVersionStateRecord {
  const config = objectFromUnknown(record.configJson);
  return {
    rule_version_id: record.ruleVersionId,
    profile_id: record.profileId,
    label: record.label,
    status: record.status as RuleVersionStateRecord["status"],
    active_default: record.activeDefault,
    config: {
      school_id: config.school_id === "experimental_sanhe_v0_1" ? "experimental_sanhe_v0_1" : "default_ziwei_v0_1",
      zi_hour_day_boundary: config.zi_hour_day_boundary === "late_zi_next_day" ? "late_zi_next_day" : "civil_midnight",
      leap_month_policy: config.leap_month_policy === "split_leap_month" ? "split_leap_month" : "same_month_number",
      true_solar_time_policy: config.true_solar_time_policy === "optional" ? "optional" : "disabled",
      four_transform_policy: config.four_transform_policy === "experimental_stem_variant" ? "experimental_stem_variant" : "default_stem",
      interpretation_style: config.interpretation_style === "classical_source_first" ? "classical_source_first" : "balanced_modern"
    },
    released_at: record.releasedAt?.toISOString(),
    updated_at: record.updatedAt.toISOString(),
    privacy_note:
      typeof config.privacy_note === "string"
        ? config.privacy_note
        : "rule version state stores rule metadata only; no birth data, prompts, report bodies, or user identifiers."
  };
}

function buildUserWrite(user: UserAccount): PrismaUserWrite {
  return {
    memberId: user.member_id,
    displayName: user.display_name,
    phoneHash: user.phone_hash ?? null,
    emailHash: user.email_hash ?? null,
    status: "active",
    privacyVersion: "2026-05-25",
    privacyNote: user.privacy_note,
    upgradedFromVisitorId: user.upgraded_from_visitor_id ?? null,
    createdAt: new Date(user.created_at),
    updatedAt: new Date(user.created_at)
  };
}

function parseUserRecord(record: PrismaUserRecord): UserAccount {
  return {
    member_id: record.memberId,
    display_name: record.displayName,
    phone_hash: record.phoneHash ?? undefined,
    email_hash: record.emailHash ?? undefined,
    created_at: record.createdAt.toISOString(),
    upgraded_from_visitor_id: record.upgradedFromVisitorId ?? undefined,
    privacy_note: record.privacyNote
  };
}

function buildAnonymousVisitorWrite(visitor: AnonymousVisitor): PrismaAnonymousVisitorWrite {
  return {
    visitorId: visitor.visitor_id,
    upgradedMemberId: visitor.upgraded_member_id ?? null,
    privacyNote: visitor.privacy_note,
    firstSeenAt: new Date(visitor.first_seen_at),
    upgradedAt: visitor.upgraded_at ? new Date(visitor.upgraded_at) : null,
    lastSeenAt: new Date(visitor.upgraded_at ?? visitor.first_seen_at)
  };
}

function parseAnonymousVisitorRecord(record: PrismaAnonymousVisitorRecord): AnonymousVisitor {
  return {
    visitor_id: record.visitorId,
    first_seen_at: record.firstSeenAt.toISOString(),
    upgraded_member_id: record.upgradedMemberId ?? undefined,
    upgraded_at: record.upgradedAt?.toISOString(),
    privacy_note: record.privacyNote
  };
}

function buildAnonymousLinkWrite(link: AnonymousLink): PrismaAnonymousLinkWrite {
  return {
    linkId: link.link_id,
    visitorId: link.visitor_id,
    memberId: link.member_id,
    openidPlaceholder: link.openid_placeholder ?? null,
    linkedAt: new Date(link.linked_at),
    privacyNote: link.privacy_note
  };
}

function parseAnonymousLinkRecord(record: PrismaAnonymousLinkRecord): AnonymousLink {
  return {
    link_id: record.linkId,
    visitor_id: record.visitorId,
    member_id: record.memberId,
    openid_placeholder: record.openidPlaceholder ?? undefined,
    linked_at: record.linkedAt.toISOString(),
    privacy_note: record.privacyNote
  };
}

function buildSmsVerificationChallengeWrite(challenge: SmsVerificationChallenge): PrismaSmsVerificationChallengeWrite {
  return {
    challengeId: challenge.challenge_id,
    phoneHash: challenge.phone_hash,
    codeHash: challenge.code_hash,
    provider: challenge.provider,
    templateId: challenge.template_id,
    purpose: challenge.purpose,
    attemptCount: challenge.attempt_count,
    maxAttempts: challenge.max_attempts,
    deliveryStatus: challenge.delivery_status,
    providerMessageId: challenge.provider_message_id ?? null,
    privacyNote: challenge.privacy_note,
    createdAt: new Date(challenge.created_at),
    expiresAt: new Date(challenge.expires_at),
    consumedAt: challenge.consumed_at ? new Date(challenge.consumed_at) : null
  };
}

function parseSmsVerificationChallengeRecord(record: PrismaSmsVerificationChallengeRecord): SmsVerificationChallenge {
  return {
    challenge_id: record.challengeId,
    phone_hash: record.phoneHash,
    code_hash: record.codeHash,
    provider: record.provider,
    template_id: record.templateId,
    purpose: "login",
    attempt_count: record.attemptCount,
    max_attempts: record.maxAttempts,
    created_at: record.createdAt.toISOString(),
    expires_at: record.expiresAt.toISOString(),
    consumed_at: record.consumedAt?.toISOString(),
    delivery_status: record.deliveryStatus as SmsVerificationChallenge["delivery_status"],
    provider_message_id: record.providerMessageId ?? undefined,
    privacy_note: record.privacyNote
  };
}

function buildShareWrite(snapshot: ShareLandingSnapshot): PrismaShareWrite {
  return {
    shareId: snapshot.share_id,
    sourceType: snapshot.source_type,
    sourceId: snapshot.source_id,
    memberId: null,
    visitorId: null,
    snapshotJson: toJsonObject(snapshot),
    expiresAt: null,
    createdAt: new Date(snapshot.created_at)
  };
}

function parseShareRecord(record: PrismaShareRecord): ShareLandingSnapshot {
  const parsed = objectFromUnknown(record.snapshotJson);
  return {
    share_id: typeof parsed.share_id === "string" ? parsed.share_id : record.shareId,
    version: parsed.version === "v0.1" ? "v0.1" : "v0.1",
    source_type: (typeof parsed.source_type === "string" ? parsed.source_type : record.sourceType) as ShareLandingSnapshot["source_type"],
    source_id: typeof parsed.source_id === "string" ? parsed.source_id : record.sourceId,
    title: typeof parsed.title === "string" ? parsed.title : "",
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    keywords: parseStringArray(parsed.keywords),
    safety_flags: parseStringArray(parsed.safety_flags),
    created_at: typeof parsed.created_at === "string" ? parsed.created_at : record.createdAt.toISOString(),
    privacy_note: typeof parsed.privacy_note === "string" ? parsed.privacy_note : "share snapshot is redacted for public access."
  };
}

function buildSupportTicketWrite(ticket: SupportTicket): PrismaSupportTicketWrite {
  return {
    ticketId: ticket.ticket_id,
    memberId: ticket.member_id,
    orderId: ticket.order_id ?? null,
    reportId: ticket.report_id ?? null,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    subject: ticket.subject,
    message: ticket.message,
    assignee: ticket.assignee ?? null,
    consentJson: toJsonObject(ticket.consent),
    auditTrailJson: toJsonObject(ticket.audit_trail),
    createdAt: new Date(ticket.created_at),
    updatedAt: new Date(ticket.updated_at),
    resolvedAt: ticket.resolved_at ? new Date(ticket.resolved_at) : null
  };
}

function parseSupportTicketRecord(record: PrismaSupportTicketRecord): SupportTicket {
  return {
    ticket_id: record.ticketId,
    member_id: record.memberId,
    order_id: record.orderId ?? undefined,
    report_id: record.reportId ?? undefined,
    category: record.category as SupportTicket["category"],
    priority: record.priority as SupportTicket["priority"],
    status: record.status as SupportTicket["status"],
    subject: record.subject,
    message: record.message,
    assignee: record.assignee ?? undefined,
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString(),
    resolved_at: record.resolvedAt?.toISOString(),
    consent: parseSupportTicketConsent(record.consentJson),
    audit_trail: parseSupportTicketAuditTrail(record.auditTrailJson)
  };
}

function buildDataDeletionRequestWrite(record: DataDeletionRequestRecord): PrismaDataDeletionRequestWrite {
  return {
    deletionRequestId: record.deletion_request_id,
    memberId: record.member_id ?? null,
    visitorId: record.visitor_id ?? null,
    ticketId: record.ticket_id ?? null,
    status: record.status,
    scope: record.scope,
    requestedAt: new Date(record.requested_at),
    updatedAt: new Date(record.updated_at),
    completedAt: record.completed_at ? new Date(record.completed_at) : null,
    auditLogId: record.audit_log_id ?? null,
    auditTrailJson: toJsonObject(record.audit_trail),
    privacyNote: record.privacy_note
  };
}

function parseDataDeletionRequestRecord(record: PrismaDataDeletionRequestRecord): DataDeletionRequestRecord {
  return {
    deletion_request_id: record.deletionRequestId,
    member_id: record.memberId ?? undefined,
    visitor_id: record.visitorId ?? undefined,
    ticket_id: record.ticketId ?? undefined,
    status: record.status as DataDeletionRequestRecord["status"],
    scope: record.scope as DataDeletionRequestRecord["scope"],
    requested_at: record.requestedAt.toISOString(),
    updated_at: record.updatedAt.toISOString(),
    completed_at: record.completedAt?.toISOString(),
    audit_log_id: record.auditLogId ?? undefined,
    audit_trail: parseSupportTicketAuditTrail(record.auditTrailJson),
    privacy_note: record.privacyNote
  };
}

function buildWechatOpenIdBindingWrite(binding: WechatOpenIdBinding): PrismaWechatOpenIdBindingWrite {
  return {
    bindingId: binding.binding_id,
    openidHash: binding.openid_hash,
    visitorId: binding.visitor_id,
    memberId: binding.member_id,
    linkedAt: new Date(binding.linked_at),
    isDuplicate: binding.is_duplicate,
    privacyNote: binding.privacy_note
  };
}

function parseWechatOpenIdBindingRecord(record: PrismaWechatOpenIdBindingRecord): WechatOpenIdBinding {
  return {
    binding_id: record.bindingId,
    openid_hash: record.openidHash,
    visitor_id: record.visitorId,
    member_id: record.memberId,
    linked_at: record.linkedAt.toISOString(),
    is_duplicate: record.isDuplicate,
    privacy_note: record.privacyNote
  };
}

function buildOrderWrite(order: Order): PrismaOrderWrite {
  return {
    orderId: order.order_id,
    reportId: order.report_id,
    memberId: order.member_id,
    packageId: order.package_id,
    tierId: order.tier_id,
    reportType: order.report_type,
    amountCents: order.amount_cents,
    currency: order.currency,
    status: order.status,
    paymentProvider: order.payment_provider,
    checkoutSessionId: order.checkout_session_id ?? null,
    refundedAmountCents: order.refunded_amount_cents ?? null,
    refundReason: order.refund_reason ?? null,
    complianceJson: toJsonObject(order.compliance),
    privacyJson: toJsonObject(order.privacy),
    createdAt: new Date(order.created_at),
    updatedAt: new Date(order.updated_at),
    fulfilledAt: order.fulfilled_at ? new Date(order.fulfilled_at) : null,
    refundedAt: order.refunded_at ? new Date(order.refunded_at) : null
  };
}

function parseOrderRecord(record: PrismaOrderRecord): Order {
  const compliance = objectFromUnknown(record.complianceJson);
  const privacy = objectFromUnknown(record.privacyJson);
  return {
    order_id: record.orderId,
    report_id: record.reportId,
    member_id: record.memberId,
    package_id: record.packageId as Order["package_id"],
    tier_id: record.tierId as Order["tier_id"],
    report_type: record.reportType as Order["report_type"],
    amount_cents: record.amountCents,
    currency: "cny",
    status: record.status as Order["status"],
    payment_provider: record.paymentProvider as Order["payment_provider"],
    checkout_session_id: record.checkoutSessionId ?? undefined,
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString(),
    fulfilled_at: record.fulfilledAt?.toISOString(),
    refunded_at: record.refundedAt?.toISOString(),
    refunded_amount_cents: record.refundedAmountCents ?? undefined,
    refund_reason: record.refundReason ?? undefined,
    compliance: {
      service_terms_accepted: Boolean(compliance.service_terms_accepted),
      privacy_policy_accepted: Boolean(compliance.privacy_policy_accepted),
      refund_policy_accepted: Boolean(compliance.refund_policy_accepted),
      cultural_entertainment_only: Boolean(compliance.cultural_entertainment_only)
    },
    privacy: {
      stores_full_birth_date: false,
      stores_birth_time: false,
      stores_location_detail: false,
      stores_video_frame: false,
      ...privacy
    } as Order["privacy"]
  };
}

function buildCheckoutSessionWrite(session: CheckoutSession): PrismaCheckoutSessionWrite {
  return {
    checkoutSessionId: session.checkout_session_id,
    orderId: session.order_id,
    provider: session.provider,
    providerMode: session.provider_mode,
    checkoutUrl: session.checkout_url,
    status: session.status,
    sandboxWebhookJson: session.sandbox_webhook ? toJsonObject(session.sandbox_webhook) : undefined,
    providerRequirementsJson: toJsonObject(session.provider_requirements),
    createdAt: new Date(session.created_at),
    expiresAt: new Date(session.expires_at)
  };
}

function parseCheckoutSessionRecord(record: PrismaCheckoutSessionRecord): CheckoutSession {
  return {
    checkout_session_id: record.checkoutSessionId,
    order_id: record.orderId,
    provider: record.provider as CheckoutSession["provider"],
    provider_mode: record.providerMode as CheckoutSession["provider_mode"],
    checkout_url: record.checkoutUrl,
    status: record.status as CheckoutSession["status"],
    created_at: record.createdAt.toISOString(),
    expires_at: record.expiresAt.toISOString(),
    sandbox_webhook: optionalObjectFromUnknown(record.sandboxWebhookJson) as CheckoutSession["sandbox_webhook"],
    provider_requirements: objectFromUnknown(record.providerRequirementsJson) as CheckoutSession["provider_requirements"]
  };
}

function buildPaymentEventWrite(event: PaymentEvent): PrismaPaymentEventWrite {
  const providerEventId = event.payment_event_id.startsWith(`${event.provider}:`)
    ? event.payment_event_id.slice(event.provider.length + 1)
    : event.payment_event_id;
  return {
    paymentEventId: event.payment_event_id,
    provider: event.provider,
    providerEventId,
    eventType: event.event_type,
    orderId: event.order_id,
    checkoutSessionId: event.checkout_session_id,
    signatureVerified: event.signature_verified,
    isDuplicate: event.is_duplicate,
    rawPayloadDigest: digestObject({
      payment_event_id: event.payment_event_id,
      provider: event.provider,
      event_type: event.event_type,
      order_id: event.order_id,
      checkout_session_id: event.checkout_session_id
    }),
    orderSnapshotJson: toJsonObject(event.order),
    receivedAt: new Date(event.received_at)
  };
}

function parsePaymentEventRecord(record: PrismaPaymentEventRecord, fallbackOrder: Order | undefined): PaymentEvent {
  const orderSnapshot = optionalObjectFromUnknown(record.orderSnapshotJson);
  return {
    payment_event_id: record.paymentEventId,
    provider: record.provider as PaymentEvent["provider"],
    event_type: record.eventType,
    checkout_session_id: record.checkoutSessionId ?? "",
    order_id: record.orderId ?? "",
    received_at: record.receivedAt.toISOString(),
    signature_verified: record.signatureVerified,
    is_duplicate: record.isDuplicate,
    order: (orderSnapshot as Order | undefined) ?? fallbackOrder ?? createEmptyOrderSnapshot(record)
  };
}

function buildProviderStatementWrite(statement: ProviderStatement): PrismaProviderStatementWrite {
  return {
    statementId: statement.statement_id,
    provider: statement.provider,
    periodStart: statement.period_start,
    periodEnd: statement.period_end,
    importedBy: statement.imported_by,
    rowCount: statement.row_count,
    rowsJson: statement.rows as unknown as Prisma.InputJsonValue,
    privacyNote: statement.privacy_note,
    importedAt: new Date(statement.imported_at)
  };
}

function parseProviderStatementRecord(record: PrismaProviderStatementRecord): ProviderStatement {
  return {
    statement_id: record.statementId,
    provider: record.provider as ProviderStatement["provider"],
    period_start: record.periodStart,
    period_end: record.periodEnd,
    imported_at: record.importedAt.toISOString(),
    imported_by: record.importedBy,
    row_count: record.rowCount,
    rows: Array.isArray(record.rowsJson) ? (record.rowsJson as ProviderStatement["rows"]) : [],
    privacy_note: record.privacyNote
  };
}

function buildRefundWrite(refund: RefundRecord): PrismaRefundWrite {
  return {
    refundId: refund.refund_id,
    orderId: refund.order_id,
    provider: refund.provider,
    providerRefundId: refund.provider_refund_id ?? null,
    amountCents: refund.amount_cents,
    status: refund.status,
    reason: refund.reason,
    requestedBy: refund.requested_by,
    ticketId: refund.ticket_id ?? null,
    providerRefundRequestJson: refund.provider_refund_request ?? null,
    privacyNote: refund.privacy_note,
    createdAt: new Date(refund.created_at),
    updatedAt: new Date(refund.updated_at)
  };
}

function parseRefundRecord(record: PrismaRefundRecord): RefundRecord {
  return {
    refund_id: record.refundId,
    order_id: record.orderId,
    provider: record.provider as RefundRecord["provider"],
    provider_refund_id: record.providerRefundId ?? undefined,
    amount_cents: record.amountCents,
    status: record.status as RefundRecord["status"],
    reason: record.reason,
    requested_by: record.requestedBy,
    ticket_id: record.ticketId ?? undefined,
    provider_refund_request: (record.providerRefundRequestJson as RefundRecord["provider_refund_request"] | null) ?? undefined,
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString(),
    privacy_note: record.privacyNote
  };
}

function buildEntitlementWrite(entitlement: MemberEntitlement): PrismaEntitlementWrite {
  return {
    entitlementId: entitlement.entitlement_id,
    memberId: entitlement.member_id,
    reportId: entitlement.report_id,
    sourceOrderId: entitlement.source_order_id,
    tierId: entitlement.tier_id ?? null,
    accessLevel: entitlement.access_level ?? null,
    benefits: entitlement.benefits ?? [],
    status: entitlement.has_access ? "active" : "revoked",
    credits: entitlement.export_preview_credits,
    hasAccess: entitlement.has_access,
    canReadReport: entitlement.can_read_report,
    favoriteEnabled: entitlement.favorite_enabled,
    privacyNote: entitlement.privacy_note,
    reportSnapshotJson: entitlement.report_snapshot ? toJsonObject(entitlement.report_snapshot) : undefined,
    createdAt: new Date(entitlement.created_at)
  };
}

function parseEntitlementRecord(record: PrismaEntitlementRecord): MemberEntitlement {
  return {
    entitlement_id: record.entitlementId,
    member_id: record.memberId,
    report_id: record.reportId,
    source_order_id: record.sourceOrderId,
    tier_id: record.tierId as MemberEntitlement["tier_id"],
    access_level: record.accessLevel as MemberEntitlement["access_level"],
    benefits: record.benefits,
    has_access: record.hasAccess,
    can_read_report: record.canReadReport,
    export_preview_credits: record.credits,
    favorite_enabled: record.favoriteEnabled,
    created_at: record.createdAt.toISOString(),
    privacy_note: record.privacyNote,
    report_snapshot: optionalObjectFromUnknown(record.reportSnapshotJson) as MemberEntitlement["report_snapshot"]
  };
}

function buildAiGenerationLogWrite(record: AiGenerationRecord): PrismaAiGenerationLogWrite {
  return {
    generationId: record.generation_id,
    provider: record.provider,
    model: record.model,
    promptVersion: record.prompt_version,
    chartId: record.chart_id ?? null,
    reportId: record.report_id ?? null,
    inputDigest: record.input_digest,
    outputDigest: record.output_digest ?? null,
    status: record.status,
    fallbackReason: record.fallback_reason ?? null,
    safetyFlags: record.safety_flags,
    privacyNote: record.privacy_note,
    createdAt: new Date(record.created_at)
  };
}

function parseAiGenerationLogRecord(record: PrismaAiGenerationLogRecord): AiGenerationRecord {
  return {
    generation_id: record.generationId,
    provider: record.provider as AiGenerationRecord["provider"],
    model: record.model as AiGenerationRecord["model"],
    prompt_version: record.promptVersion,
    chart_id: record.chartId ?? undefined,
    report_id: record.reportId ?? undefined,
    input_digest: record.inputDigest,
    output_digest: record.outputDigest ?? undefined,
    status: record.status as AiGenerationRecord["status"],
    fallback_reason: record.fallbackReason ?? undefined,
    safety_flags: record.safetyFlags,
    created_at: record.createdAt.toISOString(),
    privacy_note: record.privacyNote
  };
}

const followUpQuotaPrivacyNote =
  "Follow-up quotas persist subject id, plan, window, and counters only; raw question, answer, and birth data are not stored.";

function buildFollowUpQuotaWrite(
  record: Omit<FollowUpQuotaUsage, "used" | "updated_at" | "privacy_note">,
  used: number
): PrismaFollowUpQuotaWrite {
  return {
    quotaKey: record.quota_key,
    subjectId: record.subject_id,
    plan: record.plan,
    windowStart: new Date(record.window_start),
    quotaLimit: record.limit,
    used,
    privacyNote: followUpQuotaPrivacyNote,
    updatedAt: new Date()
  };
}

function parseFollowUpQuotaRecord(record: PrismaFollowUpQuotaRecord): FollowUpQuotaUsage | undefined {
  if (!record.quotaKey || typeof record.used !== "number") return undefined;
  return {
    quota_key: record.quotaKey,
    subject_id: record.subjectId,
    plan: record.plan === "member" ? "member" : "free",
    window_start: record.windowStart.toISOString().slice(0, 10),
    limit: record.quotaLimit,
    used: record.used,
    updated_at: record.updatedAt.toISOString(),
    privacy_note: record.privacyNote
  };
}

function buildContentReviewRecordWrite(record: ContentReviewQueueItem): PrismaContentReviewRecordWrite {
  return {
    reviewId: record.review_id,
    reportId: record.report_id,
    sourceType: record.source_type,
    sourceId: record.source_id,
    status: record.status,
    blockedTerms: record.blocked_terms,
    privacyFlags: record.privacy_flags,
    safetyFlags: record.safety_flags,
    reviewerId: record.reviewer_id ?? null,
    notes: record.notes,
    checkedAt: new Date(record.checked_at)
  };
}

function parseContentReviewRecord(record: PrismaContentReviewRecordRecord): ContentReviewQueueItem {
  return {
    review_id: record.reviewId,
    report_id: record.reportId,
    source_type: record.sourceType as ContentReviewQueueItem["source_type"],
    source_id: record.sourceId,
    status: record.status as ContentReviewQueueItem["status"],
    blocked_terms: record.blockedTerms,
    privacy_flags: record.privacyFlags,
    safety_flags: record.safetyFlags,
    reviewer_id: record.reviewerId ?? undefined,
    checked_at: record.checkedAt.toISOString(),
    notes: record.notes
  };
}

function buildAiGenerationLogWhere(filter: AiGenerationRecordFilter): { chartId?: string; reportId?: string; status?: string } | undefined {
  const where = {
    chartId: filter.chart_id,
    reportId: filter.report_id,
    status: filter.status
  };
  return Object.values(where).some((value) => value !== undefined) ? where : undefined;
}

function buildContentReviewWhere(filter: ContentReviewRecordFilter): { reportId?: string; sourceType?: string; sourceId?: string; status?: string } | undefined {
  const where = {
    reportId: filter.report_id,
    sourceType: filter.source_type,
    sourceId: filter.source_id,
    status: filter.status
  };
  return Object.values(where).some((value) => value !== undefined) ? where : undefined;
}

function filterAiGenerationRecords(records: AiGenerationRecord[], filter: AiGenerationRecordFilter): AiGenerationRecord[] {
  return records.filter((record) => {
    if (filter.chart_id && record.chart_id !== filter.chart_id) return false;
    if (filter.report_id && record.report_id !== filter.report_id) return false;
    if (filter.status && record.status !== filter.status) return false;
    return true;
  });
}

function filterContentReviewRecords(records: ContentReviewQueueItem[], filter: ContentReviewRecordFilter): ContentReviewQueueItem[] {
  return records.filter((record) => {
    if (filter.report_id && record.report_id !== filter.report_id) return false;
    if (filter.source_type && record.source_type !== filter.source_type) return false;
    if (filter.source_id && record.source_id !== filter.source_id) return false;
    if (filter.status && record.status !== filter.status) return false;
    return true;
  });
}

function createEmptyOrderSnapshot(record: PrismaPaymentEventRecord): Order {
  return {
    order_id: record.orderId ?? "",
    report_id: "",
    member_id: "",
    package_id: "single_report",
    tier_id: "starter_19",
    report_type: "single_chart",
    amount_cents: 0,
    currency: "cny",
    status: "created",
    payment_provider: record.provider as Order["payment_provider"],
    checkout_session_id: record.checkoutSessionId ?? undefined,
    created_at: record.receivedAt.toISOString(),
    updated_at: record.receivedAt.toISOString(),
    compliance: {
      service_terms_accepted: false,
      privacy_policy_accepted: false,
      refund_policy_accepted: false,
      cultural_entertainment_only: false
    },
    privacy: {
      stores_full_birth_date: false,
      stores_birth_time: false,
      stores_location_detail: false,
      stores_video_frame: false
    }
  };
}

function toJsonObject(value: unknown): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonObject;
}

function objectFromUnknown(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function optionalObjectFromUnknown(value: unknown): Record<string, unknown> | undefined {
  const parsed = objectFromUnknown(value);
  return Object.keys(parsed).length ? parsed : undefined;
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function parseSupportTicketConsent(value: unknown): SupportTicket["consent"] {
  const parsed = objectFromUnknown(value);
  return {
    agreed: Boolean(parsed.agreed),
    no_sensitive_birth_data: true
  };
}

function asPrismaUserRecord(record: unknown): PrismaUserRecord {
  return record as PrismaUserRecord;
}

function asPrismaAnonymousVisitorRecord(record: unknown): PrismaAnonymousVisitorRecord {
  return record as PrismaAnonymousVisitorRecord;
}

function asPrismaAnonymousLinkRecord(record: unknown): PrismaAnonymousLinkRecord {
  return record as PrismaAnonymousLinkRecord;
}

function asPrismaSmsVerificationChallengeRecord(record: unknown): PrismaSmsVerificationChallengeRecord {
  return record as PrismaSmsVerificationChallengeRecord;
}

function asPrismaShareRecord(record: unknown): PrismaShareRecord {
  return record as PrismaShareRecord;
}

function asPrismaSupportTicketRecord(record: unknown): PrismaSupportTicketRecord {
  return record as PrismaSupportTicketRecord;
}

function asPrismaDataDeletionRequestRecord(record: unknown): PrismaDataDeletionRequestRecord {
  return record as PrismaDataDeletionRequestRecord;
}

function asPrismaWechatOpenIdBindingRecord(record: unknown): PrismaWechatOpenIdBindingRecord {
  return record as PrismaWechatOpenIdBindingRecord;
}

function asPrismaOrderRecord(record: unknown): PrismaOrderRecord {
  return record as PrismaOrderRecord;
}

function asPrismaCheckoutSessionRecord(record: unknown): PrismaCheckoutSessionRecord {
  return record as PrismaCheckoutSessionRecord;
}

function asPrismaPaymentEventRecord(record: unknown): PrismaPaymentEventRecord {
  return record as PrismaPaymentEventRecord;
}

function asPrismaProviderStatementRecord(record: unknown): PrismaProviderStatementRecord {
  return record as PrismaProviderStatementRecord;
}

function asPrismaRefundRecord(record: unknown): PrismaRefundRecord {
  return record as PrismaRefundRecord;
}

function asPrismaEntitlementRecord(record: unknown): PrismaEntitlementRecord {
  return record as PrismaEntitlementRecord;
}

function asPrismaReportRecord(record: unknown): PrismaReportRecord {
  return record as PrismaReportRecord;
}

function asPrismaReportVersionRecord(record: unknown): PrismaReportVersionRecord {
  return record as PrismaReportVersionRecord;
}

function asPrismaReportGenerationJobRecord(record: unknown): PrismaReportGenerationJobRecord {
  return record as PrismaReportGenerationJobRecord;
}

function asPrismaExportPreviewRecord(record: unknown): PrismaExportPreviewRecord {
  return record as PrismaExportPreviewRecord;
}

function asPrismaAiGenerationLogRecord(record: unknown): PrismaAiGenerationLogRecord {
  return record as PrismaAiGenerationLogRecord;
}

function asPrismaFollowUpQuotaRecord(record: unknown): PrismaFollowUpQuotaRecord {
  return record as PrismaFollowUpQuotaRecord;
}

function asPrismaContentReviewRecord(record: unknown): PrismaContentReviewRecordRecord {
  return record as PrismaContentReviewRecordRecord;
}

function asPrismaAdminAuditLogRecord(record: unknown): PrismaAdminAuditLogRecord {
  return record as PrismaAdminAuditLogRecord;
}

function asPrismaRuleVersionRecord(record: unknown): PrismaRuleVersionRecord {
  return record as PrismaRuleVersionRecord;
}

function asPrismaChartRecord(record: unknown): PrismaChartRecord {
  return record as PrismaChartRecord;
}

function buildBirthProfileWrite(input: ChartPersistenceInput): PrismaBirthProfileWrite {
  const profile = input.birth_profile;
  const chart = input.chart;
  return {
    birthProfileId: chartBirthProfileId(chart.chart_id),
    memberId: input.owner?.member_id ?? null,
    visitorId: input.owner?.visitor_id ?? null,
    calendarType: profile.calendar_type,
    birthDateEncrypted: encryptBirthProfileField(profile.birth_date, `${chart.chart_id}:birth_date`),
    birthTimeEncrypted: encryptBirthProfileField(profile.birth_time, `${chart.chart_id}:birth_time`),
    locationEncrypted: profile.location
      ? encryptBirthProfileField(JSON.stringify(profile.location), `${chart.chart_id}:location`)
      : null,
    timezone: profile.timezone,
    isLeapMonth: profile.is_leap_month,
    trueSolarTimeEnabled: profile.true_solar_time_enabled,
    genderRule: profile.gender_rule,
    accuracyNote: chart.warnings.length ? chart.warnings.map((warning) => warning.code).join(",") : null,
    createdAt: new Date(input.created_at ?? new Date().toISOString())
  };
}

function buildChartWrite(chart: ChartCreateResponse): PrismaChartWrite {
  return {
    chartId: chart.chart_id,
    birthProfileId: chartBirthProfileId(chart.chart_id),
    ruleVersionId: chart.rule_version,
    chartJson: toJsonObject(chart),
    normalizedBirth: toJsonObject(chart.normalized_birth),
    traceJson: toJsonObject({ trace: chart.trace, warnings: chart.warnings }),
    createdAt: new Date()
  };
}

function parseChartRecord(record: PrismaChartRecord): ChartCreateResponse | undefined {
  const parsed = objectFromUnknown(record.chartJson);
  if (typeof parsed.chart_id !== "string") return undefined;
  return parsed as unknown as ChartCreateResponse;
}

function chartBirthProfileId(chartId: string): string {
  return `birth_${chartId}`.slice(0, 96);
}

function encryptBirthProfileField(value: string, aad: string): string {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", resolveBirthDataEncryptionKey(salt), iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v2", salt.toString("base64url"), iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(":");
}

function resolveBirthDataEncryptionKey(salt: Buffer): Buffer {
  const configuredKey = process.env.ZIWEI_BIRTH_DATA_ENCRYPTION_KEY ?? "";
  const readiness = resolveBirthDataEncryptionReadiness({ encryptionKey: configuredKey });
  if (!readiness.ready) {
    throw new Error(readiness.blockers[0] ?? "ZIWEI_BIRTH_DATA_ENCRYPTION_KEY must be configured before storing birth profiles in PostgreSQL.");
  }
  return scryptSync(configuredKey, salt, 32, { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
}

function buildReportWrite(draft: ReportDraft, chartOwner?: ChartOwnerRecord): PrismaReportWrite {
  const resolvedChartOwner = chartOwner ?? (draft.chart_ref?.chart_id ? getChartOwnerRecord(draft.chart_ref.chart_id) : undefined);
  return {
    reportId: draft.report_id,
    chartId: draft.chart_ref?.chart_id ?? null,
    memberId: resolvedChartOwner?.member_id ?? null,
    tier: draft.price_tier_hint,
    status: draft.review.status,
    currentVersion: draft.report_version ?? 1,
    accessPolicy: draft.access?.policy ?? "private_paid",
    shareSummary: sanitizeShareSummary(draft),
    createdAt: new Date(draft.created_at),
    updatedAt: new Date(draft.created_at)
  };
}

function buildReportVersionWrite(draft: ReportDraft): PrismaReportVersionWrite {
  const reportVersion = draft.report_version ?? 1;
  return {
    reportVersionId: draft.lineage?.report_version_id ?? `${draft.report_id}_v${reportVersion}`,
    reportId: draft.report_id,
    version: reportVersion,
    ruleVersionId: draft.rule_version ?? draft.template_version,
    promptVersion: draft.lineage?.prompt_version ?? null,
    generatedAt: new Date(draft.lineage?.generated_at ?? draft.created_at),
    contentJson: toJsonObject(draft),
    traceJson: toJsonObject({
      report_id: draft.report_id,
      report_type: draft.report_type,
      mode: draft.mode,
      report_version: reportVersion,
      prompt_version: draft.lineage?.prompt_version,
      review_status: draft.review.status,
      creator_asset_count: draft.creator_assets.length,
      section_count: draft.sections.length,
      safety_flags: draft.safety_flags
    }),
    reviewStatus: draft.review.status
  };
}

function parseReportVersionRecord(record: PrismaReportVersionRecord): ReportDraft {
  const parsed = objectFromUnknown(record.contentJson);
  return parsed as ReportDraft;
}

function buildReportGenerationJobWrite(job: ReportGenerationJob): PrismaReportGenerationJobWrite {
  return {
    jobId: job.job_id,
    memberId: job.member_id ?? null,
    visitorId: job.visitor_id ?? null,
    reportId: job.report_id ?? null,
    status: job.status,
    attemptCount: job.attempt_count,
    maxAttempts: job.max_attempts,
    requestDigest: job.request_digest,
    requestSummaryJson: toJsonObject(job.request_summary),
    lastErrorCode: job.last_error_code ?? null,
    lastErrorMessage: job.last_error_message ?? null,
    supportTicketId: job.support_ticket_id ?? null,
    auditTrailJson: toJsonObject(job.audit_trail),
    privacyNote: job.privacy_note,
    createdAt: new Date(job.created_at),
    updatedAt: new Date(job.updated_at)
  };
}

function buildExportPreviewWrite(preview: ExportPreview): PrismaExportPreviewWrite {
  return {
    exportPreviewId: preview.export_preview_id,
    reportId: preview.report_id,
    format: preview.format,
    previewUrl: preview.preview_url,
    storageJson: toJsonObject(preview.storage ?? {}),
    reviewStatus: preview.review_status,
    orderCreated: preview.order_created,
    paymentStatus: preview.payment_status,
    privacyNote: preview.privacy_note,
    createdAt: new Date(preview.created_at),
    expiresAt: new Date(preview.expires_at)
  };
}

function parseExportPreviewRecord(record: PrismaExportPreviewRecord): ExportPreview {
  return {
    export_preview_id: record.exportPreviewId,
    report_id: record.reportId,
    format: record.format as ExportPreview["format"],
    preview_url: record.previewUrl,
    storage: parseExportPreviewStorage(record.storageJson),
    created_at: record.createdAt.toISOString(),
    expires_at: record.expiresAt.toISOString(),
    review_status: record.reviewStatus as ExportPreview["review_status"],
    order_created: false,
    payment_status: record.paymentStatus as ExportPreview["payment_status"],
    privacy_note: record.privacyNote
  };
}

function parseExportPreviewStorage(value: unknown): ExportPreview["storage"] {
  const parsed = objectFromUnknown(value);
  if (!Object.keys(parsed).length) return undefined;
  const objectKey = typeof parsed.object_key === "string" ? parsed.object_key : "";
  if (!objectKey) return undefined;
  return {
    provider: parsed.provider === "s3_compatible" ? "s3_compatible" : "local_preview",
    bucket: typeof parsed.bucket === "string" ? parsed.bucket : undefined,
    object_key: objectKey,
    content_type: parsed.content_type === "application/pdf" ? "application/pdf" : "text/html; charset=utf-8",
    private_acl: Boolean(parsed.private_acl),
    signed_url_required: Boolean(parsed.signed_url_required)
  };
}

function parseReportGenerationJobRecord(record: PrismaReportGenerationJobRecord): ReportGenerationJob {
  return {
    job_id: record.jobId,
    member_id: record.memberId ?? undefined,
    visitor_id: record.visitorId ?? undefined,
    report_id: record.reportId ?? undefined,
    status: record.status as ReportGenerationJob["status"],
    attempt_count: record.attemptCount,
    max_attempts: record.maxAttempts,
    request_digest: record.requestDigest,
    request_summary: parseReportRequestSummary(record.requestSummaryJson),
    last_error_code: record.lastErrorCode ?? undefined,
    last_error_message: record.lastErrorMessage ?? undefined,
    support_ticket_id: record.supportTicketId ?? undefined,
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString(),
    audit_trail: parseSupportTicketAuditTrail(record.auditTrailJson),
    privacy_note: record.privacyNote
  };
}

function parseReportRequestSummary(value: unknown): ReportGenerationJob["request_summary"] {
  const parsed = objectFromUnknown(value);
  return {
    report_type: parsed.report_type as ReportGenerationJob["request_summary"]["report_type"],
    mode: parsed.mode as ReportGenerationJob["request_summary"]["mode"],
    chart_id: typeof parsed.chart_id === "string" ? parsed.chart_id : undefined
  };
}

function parseSupportTicketAuditTrail(value: unknown): SupportTicketAuditEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => objectFromUnknown(entry))
    .filter((entry) => Object.keys(entry).length > 0)
    .map((entry) => ({
      audit_id: String(entry.audit_id ?? ""),
      action: String(entry.action ?? ""),
      actor_role: String(entry.actor_role ?? "system") as SupportTicketAuditEntry["actor_role"],
      actor_id: typeof entry.actor_id === "string" ? entry.actor_id : undefined,
      note: typeof entry.note === "string" ? entry.note : undefined,
      created_at: String(entry.created_at ?? new Date().toISOString())
    }));
}

function buildShareWhere(filter: ShareLandingSnapshotFilter): { sourceType?: string; sourceId?: string } | undefined {
  const where = {
    sourceType: filter.source_type,
    sourceId: filter.source_id
  };
  return Object.values(where).some((value) => value !== undefined) ? where : undefined;
}

function buildSupportTicketWhere(filter: SupportTicketFilter): { memberId?: string; status?: string } | undefined {
  const where = {
    memberId: filter.member_id,
    status: filter.status
  };
  return Object.values(where).some((value) => value !== undefined) ? where : undefined;
}

function buildDataDeletionRequestWhere(filter: DataDeletionRequestFilter): { memberId?: string; visitorId?: string; status?: string } | undefined {
  const where = {
    memberId: filter.member_id,
    visitorId: filter.visitor_id,
    status: filter.status
  };
  return Object.values(where).some((value) => value !== undefined) ? where : undefined;
}

function buildReportWhere(filter: ReportDraftFilter): { memberId?: string; chartId?: string; status?: string } | undefined {
  const where = {
    memberId: filter.member_id,
    chartId: filter.chart_id,
    status: filter.status
  };
  return Object.values(where).some((value) => value !== undefined) ? where : undefined;
}

function buildReportGenerationJobWhere(filter: ReportGenerationJobFilter): { memberId?: string; visitorId?: string; reportId?: string; status?: string } | undefined {
  const where = {
    memberId: filter.member_id,
    visitorId: filter.visitor_id,
    reportId: filter.report_id,
    status: filter.status
  };
  return Object.values(where).some((value) => value !== undefined) ? where : undefined;
}

function filterShareLandingSnapshots(records: ShareLandingSnapshot[], filter: ShareLandingSnapshotFilter): ShareLandingSnapshot[] {
  return records.filter((snapshot) => {
    if (filter.source_type && snapshot.source_type !== filter.source_type) return false;
    if (filter.source_id && snapshot.source_id !== filter.source_id) return false;
    return true;
  });
}

function filterSupportTickets(records: SupportTicket[], filter: SupportTicketFilter): SupportTicket[] {
  return records.filter((ticket) => {
    if (filter.member_id && ticket.member_id !== filter.member_id) return false;
    if (filter.status && ticket.status !== filter.status) return false;
    return true;
  });
}

function filterDataDeletionRequests(records: DataDeletionRequestRecord[], filter: DataDeletionRequestFilter): DataDeletionRequestRecord[] {
  return records.filter((record) => {
    if (filter.member_id && record.member_id !== filter.member_id) return false;
    if (filter.visitor_id && record.visitor_id !== filter.visitor_id) return false;
    if (filter.status && record.status !== filter.status) return false;
    return true;
  });
}

function filterReportDrafts(records: ReportDraft[], filter: ReportDraftFilter): ReportDraft[] {
  const chartOwners = listChartOwnerRecords();
  return records.filter((report) => {
    if (filter.chart_id && report.chart_ref?.chart_id !== filter.chart_id) return false;
    if (filter.status && report.review.status !== filter.status) return false;
    if (filter.member_id) {
      const chartId = report.chart_ref?.chart_id;
      if (!chartId) return false;
      const owned = chartOwners.some((owner) => owner.chart_id === chartId && owner.member_id === filter.member_id);
      if (!owned) return false;
    }
    return true;
  });
}

function filterReportGenerationJobs(records: ReportGenerationJob[], filter: ReportGenerationJobFilter): ReportGenerationJob[] {
  return records.filter((job) => {
    if (filter.member_id && job.member_id !== filter.member_id) return false;
    if (filter.visitor_id && job.visitor_id !== filter.visitor_id) return false;
    if (filter.report_id && job.report_id !== filter.report_id) return false;
    if (filter.status && job.status !== filter.status) return false;
    return true;
  });
}

function sanitizeShareSummary(draft: ReportDraft): string | null {
  if (draft.share_summary?.summary) {
    return sanitizeText(draft.share_summary.summary);
  }
  const pieces = [draft.title, draft.sections[0]?.scenario, draft.sections[0]?.advice].filter(Boolean).map((part) => sanitizeText(String(part)));
  if (!pieces.length) return null;
  return sanitizeText(pieces.join(" "));
}

function sanitizeText(text: string): string {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/g, "[birth_date_redacted]")
    .replace(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g, "[birth_time_redacted]")
    .replace(/\b(?:Shanghai|Beijing|Guangzhou|Shenzhen|Chengdu|Hangzhou|Nanjing|Wuhan)\b/gi, "[location_redacted]")
    .replace(/data:image\/[a-zA-Z+.-]+;base64,[A-Za-z0-9+/=]+/g, "[image_payload_redacted]");
}

function digestObject(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function createProductRepository(client?: PrismaProductClient, options: RepositoryRuntimeOptions = {}): ProductRepository {
  const mode = resolveProductRepositoryMode();
  if (mode.mode === "postgresql") {
    const prismaClient = client ?? getPrismaProductClient();
    if (prismaClient) return new PrismaProductRepository(prismaClient);
    if (options.allowStoreFallback || process.env.NODE_ENV !== "production") return new StoreProductRepository();
    throw new Error("Prisma product repository requires a generated Prisma client before production startup.");
  }
  if (mode.mode === "not_configured") {
    throw new Error(mode.blockers[0] ?? "Product repository is not configured.");
  }
  return new StoreProductRepository();
}

export function createLazyProductRepository(): ProductRepository {
  return new LazyProductRepository();
}

export const productRepository: ProductRepository = createLazyProductRepository();
