import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  BetaEventRecord,
  BetaFavoriteRecord,
  BetaReportIntentRecord,
  BetaShareCard,
  ChartCreateResponse,
  AnonymousLink,
  ChannelEntry,
  ChannelGrowthEvent,
  MiniProgramShareCard,
  CheckInEvent,
  CheckoutSession,
  ChallengeProgress,
  ClosedTestFeedbackRecord,
  DailyTheme,
  ExportPreview,
  LaunchGrowthEvent,
  ImmersiveSession,
  MemberEntitlement,
  MiniProgramReminderEvent,
  MiniProgramSession,
  MiniProgramSharePayload,
  Order,
  OpsOrderNote,
  PaymentEvent,
  ReferralEvent,
  ReportDraft,
  ShareLandingSnapshot,
  SubscribeTemplateConsent,
  SupportTicket,
  StageEvent,
  WechatOpenIdBinding
} from "./types.js";

const chartStore = new Map<string, ChartCreateResponse>();
const feedbackStore = new Map<string, ClosedTestFeedbackRecord>();
const betaShareCardStore = new Map<string, BetaShareCard>();
const betaFavoriteStore = new Map<string, BetaFavoriteRecord>();
const betaReportIntentStore = new Map<string, BetaReportIntentRecord>();
const betaEventStore = new Map<string, BetaEventRecord>();
const immersiveSessionStore = new Map<string, ImmersiveSession>();
const immersiveEventStore = new Map<string, StageEvent[]>();
const reportDraftStore = new Map<string, ReportDraft>();
const exportPreviewStore = new Map<string, ExportPreview>();
const orderStore = new Map<string, Order>();
const checkoutSessionStore = new Map<string, CheckoutSession>();
const paymentEventStore = new Map<string, PaymentEvent>();
const entitlementStore = new Map<string, MemberEntitlement>();
const opsOrderNoteStore = new Map<string, OpsOrderNote>();
const supportTicketStore = new Map<string, SupportTicket>();
const launchGrowthEventStore = new Map<string, LaunchGrowthEvent>();
const dailyThemeStore = new Map<string, DailyTheme>();
const dailyCheckInStore = new Map<string, CheckInEvent>();
const shareLandingStore = new Map<string, ShareLandingSnapshot>();
const referralEventStore = new Map<string, ReferralEvent>();
const challengeProgressStore = new Map<string, ChallengeProgress>();
const channelEntryStore = new Map<string, ChannelEntry>();
const anonymousLinkStore = new Map<string, AnonymousLink>();
const channelShareCardStore = new Map<string, MiniProgramShareCard>();
const channelGrowthEventStore = new Map<string, ChannelGrowthEvent>();
const miniProgramSessionStore = new Map<string, MiniProgramSession>();
const wechatOpenIdBindingStore = new Map<string, WechatOpenIdBinding>();
const miniProgramSharePayloadStore = new Map<string, MiniProgramSharePayload>();
const subscribeConsentStore = new Map<string, SubscribeTemplateConsent>();
const miniProgramReminderEventStore = new Map<string, MiniProgramReminderEvent>();
let unauthorizedOpsAccessCount = 0;
const persistentStoreDir = getPersistentStoreDir();

export function saveChart(response: ChartCreateResponse): void {
  chartStore.set(response.chart_id, response);
}

export function getChart(chartId: string): ChartCreateResponse | undefined {
  return chartStore.get(chartId);
}

export function clearChartsForTests(): void {
  chartStore.clear();
}

export function saveFeedback(record: ClosedTestFeedbackRecord): void {
  feedbackStore.set(record.feedback_id, record);
}

export function listFeedback(): ClosedTestFeedbackRecord[] {
  return [...feedbackStore.values()];
}

export function clearFeedbackForTests(): void {
  feedbackStore.clear();
}

export function saveBetaShareCard(card: BetaShareCard): void {
  betaShareCardStore.set(card.share_card_id, card);
}

export function listBetaShareCards(): BetaShareCard[] {
  return [...betaShareCardStore.values()];
}

export function saveBetaFavorite(record: BetaFavoriteRecord): void {
  betaFavoriteStore.set(record.favorite_id, record);
}

export function listBetaFavorites(): BetaFavoriteRecord[] {
  return [...betaFavoriteStore.values()];
}

export function saveBetaReportIntent(record: BetaReportIntentRecord): void {
  betaReportIntentStore.set(record.report_intent_id, record);
}

export function listBetaReportIntents(): BetaReportIntentRecord[] {
  return [...betaReportIntentStore.values()];
}

export function saveBetaEvent(record: BetaEventRecord): void {
  betaEventStore.set(record.event_id, record);
}

export function listBetaEvents(): BetaEventRecord[] {
  return [...betaEventStore.values()];
}

export function clearBetaForTests(): void {
  betaShareCardStore.clear();
  betaFavoriteStore.clear();
  betaReportIntentStore.clear();
  betaEventStore.clear();
}

export function saveImmersiveSession(session: ImmersiveSession): void {
  immersiveSessionStore.set(session.session_id, session);
}

export function getImmersiveSessionRecord(sessionId: string): ImmersiveSession | undefined {
  return immersiveSessionStore.get(sessionId);
}

export function appendImmersiveEvent(event: StageEvent): void {
  const events = immersiveEventStore.get(event.session_id) ?? [];
  immersiveEventStore.set(event.session_id, [...events, event]);
}

export function listImmersiveEvents(sessionId: string): StageEvent[] {
  return immersiveEventStore.get(sessionId) ?? [];
}

export function clearImmersiveForTests(): void {
  immersiveSessionStore.clear();
  immersiveEventStore.clear();
}

export function saveReportDraft(draft: ReportDraft): void {
  reportDraftStore.set(draft.report_id, draft);
  writePersistentRecord("reports", draft.report_id, draft);
}

export function getReportDraftRecord(reportId: string): ReportDraft | undefined {
  const cached = reportDraftStore.get(reportId);
  if (cached) return cached;
  const persisted = readPersistentRecord<ReportDraft>("reports", reportId);
  if (persisted) reportDraftStore.set(reportId, persisted);
  return persisted;
}

export function saveExportPreview(preview: ExportPreview): void {
  exportPreviewStore.set(preview.export_preview_id, preview);
  writePersistentRecord("export-previews", preview.export_preview_id, preview);
}

export function getExportPreviewRecord(previewId: string): ExportPreview | undefined {
  const cached = exportPreviewStore.get(previewId);
  if (cached) return cached;
  const persisted = readPersistentRecord<ExportPreview>("export-previews", previewId);
  if (persisted) exportPreviewStore.set(previewId, persisted);
  return persisted;
}

export function clearReportsForTests(): void {
  reportDraftStore.clear();
  exportPreviewStore.clear();
  clearPersistentBucket("reports");
  clearPersistentBucket("export-previews");
}

export function saveOrder(order: Order): void {
  orderStore.set(order.order_id, order);
  writePersistentRecord("orders", order.order_id, order);
}

export function getOrderRecord(orderId: string): Order | undefined {
  const cached = orderStore.get(orderId);
  if (cached) return cached;
  const persisted = readPersistentRecord<Order>("orders", orderId);
  if (persisted) orderStore.set(orderId, persisted);
  return persisted;
}

export function listOrderRecords(memberId?: string): Order[] {
  const orders = mergeRecords([...orderStore.values()], readPersistentBucket<Order>("orders"), (order) => order.order_id);
  return memberId ? orders.filter((order) => order.member_id === memberId) : orders;
}

export function saveCheckoutSession(session: CheckoutSession): void {
  checkoutSessionStore.set(session.checkout_session_id, session);
  writePersistentRecord("checkout-sessions", session.checkout_session_id, session);
}

export function getCheckoutSessionRecord(sessionId: string): CheckoutSession | undefined {
  const cached = checkoutSessionStore.get(sessionId);
  if (cached) return cached;
  const persisted = readPersistentRecord<CheckoutSession>("checkout-sessions", sessionId);
  if (persisted) checkoutSessionStore.set(sessionId, persisted);
  return persisted;
}

export function findCheckoutSessionByOrder(orderId: string): CheckoutSession | undefined {
  return mergeRecords(
    [...checkoutSessionStore.values()],
    readPersistentBucket<CheckoutSession>("checkout-sessions"),
    (session) => session.checkout_session_id
  ).find((session) => session.order_id === orderId);
}

export function savePaymentEvent(event: PaymentEvent): void {
  paymentEventStore.set(event.payment_event_id, event);
  writePersistentRecord("payment-events", event.payment_event_id, event);
}

export function getPaymentEventRecord(eventId: string): PaymentEvent | undefined {
  const cached = paymentEventStore.get(eventId);
  if (cached) return cached;
  const persisted = readPersistentRecord<PaymentEvent>("payment-events", eventId);
  if (persisted) paymentEventStore.set(eventId, persisted);
  return persisted;
}

export function listPaymentEvents(): PaymentEvent[] {
  return mergeRecords([...paymentEventStore.values()], readPersistentBucket<PaymentEvent>("payment-events"), (event) => event.payment_event_id);
}

export function saveMemberEntitlement(entitlement: MemberEntitlement): void {
  entitlementStore.set(`${entitlement.member_id}:${entitlement.report_id}`, entitlement);
  writePersistentRecord("entitlements", entitlementKey(entitlement.member_id, entitlement.report_id), entitlement);
}

export function getMemberEntitlementRecord(memberId: string, reportId: string): MemberEntitlement | undefined {
  const key = `${memberId}:${reportId}`;
  const cached = entitlementStore.get(key);
  if (cached) return cached;
  const persisted = readPersistentRecord<MemberEntitlement>("entitlements", entitlementKey(memberId, reportId));
  if (persisted) entitlementStore.set(key, persisted);
  return persisted;
}

export function listMemberEntitlements(memberId?: string): MemberEntitlement[] {
  const entitlements = mergeRecords(
    [...entitlementStore.values()],
    readPersistentBucket<MemberEntitlement>("entitlements"),
    (entitlement) => `${entitlement.member_id}:${entitlement.report_id}`
  );
  return memberId ? entitlements.filter((entitlement) => entitlement.member_id === memberId) : entitlements;
}

export function clearCommerceForTests(): void {
  orderStore.clear();
  checkoutSessionStore.clear();
  paymentEventStore.clear();
  entitlementStore.clear();
  clearPersistentBucket("orders");
  clearPersistentBucket("checkout-sessions");
  clearPersistentBucket("payment-events");
  clearPersistentBucket("entitlements");
}

export function saveOpsOrderNote(note: OpsOrderNote): void {
  opsOrderNoteStore.set(note.note_id, note);
  writePersistentRecord("ops-order-notes", note.note_id, note);
}

export function listOpsOrderNotes(orderId?: string): OpsOrderNote[] {
  const notes = mergeRecords([...opsOrderNoteStore.values()], readPersistentBucket<OpsOrderNote>("ops-order-notes"), (note) => note.note_id);
  return orderId ? notes.filter((note) => note.order_id === orderId) : notes;
}

export function saveSupportTicket(ticket: SupportTicket): void {
  supportTicketStore.set(ticket.ticket_id, ticket);
  writePersistentRecord("support-tickets", ticket.ticket_id, ticket);
}

export function getSupportTicketRecord(ticketId: string): SupportTicket | undefined {
  const cached = supportTicketStore.get(ticketId);
  if (cached) return cached;
  const persisted = readPersistentRecord<SupportTicket>("support-tickets", ticketId);
  if (persisted) supportTicketStore.set(ticketId, persisted);
  return persisted;
}

export function listSupportTickets(): SupportTicket[] {
  return mergeRecords([...supportTicketStore.values()], readPersistentBucket<SupportTicket>("support-tickets"), (ticket) => ticket.ticket_id);
}

export function saveLaunchGrowthEvent(event: LaunchGrowthEvent): void {
  launchGrowthEventStore.set(event.growth_event_id, event);
  writePersistentRecord("launch-growth-events", event.growth_event_id, event);
}

export function listLaunchGrowthEvents(): LaunchGrowthEvent[] {
  return mergeRecords(
    [...launchGrowthEventStore.values()],
    readPersistentBucket<LaunchGrowthEvent>("launch-growth-events"),
    (event) => event.growth_event_id
  );
}

export function recordUnauthorizedOpsAccess(): void {
  unauthorizedOpsAccessCount += 1;
}

export function getUnauthorizedOpsAccessCount(): number {
  return unauthorizedOpsAccessCount;
}

export function clearLaunchOpsForTests(): void {
  opsOrderNoteStore.clear();
  supportTicketStore.clear();
  launchGrowthEventStore.clear();
  unauthorizedOpsAccessCount = 0;
  clearPersistentBucket("ops-order-notes");
  clearPersistentBucket("support-tickets");
  clearPersistentBucket("launch-growth-events");
}

export function saveDailyTheme(theme: DailyTheme): void {
  dailyThemeStore.set(theme.daily_theme_id, theme);
}

export function getDailyThemeRecord(themeId: string): DailyTheme | undefined {
  return dailyThemeStore.get(themeId);
}

export function saveDailyCheckIn(event: CheckInEvent): void {
  dailyCheckInStore.set(event.check_in_id, event);
}

export function listDailyCheckIns(memberId?: string): CheckInEvent[] {
  const records = [...dailyCheckInStore.values()];
  return memberId ? records.filter((event) => event.member_id === memberId) : records;
}

export function clearDailyForTests(): void {
  dailyThemeStore.clear();
  dailyCheckInStore.clear();
}

export function saveShareLandingSnapshot(snapshot: ShareLandingSnapshot): void {
  shareLandingStore.set(snapshot.share_id, snapshot);
  writePersistentRecord("share-landings", snapshot.share_id, snapshot);
}

export function getShareLandingSnapshotRecord(shareId: string): ShareLandingSnapshot | undefined {
  const cached = shareLandingStore.get(shareId);
  if (cached) return cached;
  const persisted = readPersistentRecord<ShareLandingSnapshot>("share-landings", shareId);
  if (persisted) shareLandingStore.set(shareId, persisted);
  return persisted;
}

export function saveReferralEvent(event: ReferralEvent): void {
  referralEventStore.set(event.referral_event_id, event);
  writePersistentRecord("referral-events", event.referral_event_id, event);
}

export function listReferralEvents(): ReferralEvent[] {
  return mergeRecords([...referralEventStore.values()], readPersistentBucket<ReferralEvent>("referral-events"), (event) => event.referral_event_id);
}

export function saveChallengeProgress(progress: ChallengeProgress): void {
  challengeProgressStore.set(challengeProgressKey(progress.member_id, progress.challenge_id), progress);
  writePersistentRecord("challenge-progress", challengeProgressKey(progress.member_id, progress.challenge_id), progress);
}

export function getChallengeProgressRecord(memberId: string, challengeId: string): ChallengeProgress | undefined {
  const key = challengeProgressKey(memberId, challengeId);
  const cached = challengeProgressStore.get(key);
  if (cached) return cached;
  const persisted = readPersistentRecord<ChallengeProgress>("challenge-progress", key);
  if (persisted) challengeProgressStore.set(key, persisted);
  return persisted;
}

export function listChallengeProgress(memberId?: string): ChallengeProgress[] {
  const records = mergeRecords(
    [...challengeProgressStore.values()],
    readPersistentBucket<ChallengeProgress>("challenge-progress"),
    (progress) => challengeProgressKey(progress.member_id, progress.challenge_id)
  );
  return memberId ? records.filter((progress) => progress.member_id === memberId) : records;
}

export function saveChannelEntry(entry: ChannelEntry): void {
  channelEntryStore.set(entry.entry_id, entry);
  writePersistentRecord("channel-entries", entry.entry_id, entry);
}

export function listChannelEntries(): ChannelEntry[] {
  return mergeRecords([...channelEntryStore.values()], readPersistentBucket<ChannelEntry>("channel-entries"), (entry) => entry.entry_id);
}

export function saveAnonymousLink(link: AnonymousLink): void {
  anonymousLinkStore.set(link.visitor_id, link);
  writePersistentRecord("anonymous-links", link.visitor_id, link);
}

export function getAnonymousLinkRecord(visitorId: string): AnonymousLink | undefined {
  const cached = anonymousLinkStore.get(visitorId);
  if (cached) return cached;
  const persisted = readPersistentRecord<AnonymousLink>("anonymous-links", visitorId);
  if (persisted) anonymousLinkStore.set(visitorId, persisted);
  return persisted;
}

export function saveChannelShareCard(card: MiniProgramShareCard): void {
  channelShareCardStore.set(card.share_id, card);
  writePersistentRecord("channel-share-cards", card.share_id, card);
}

export function getChannelShareCardRecord(shareId: string): MiniProgramShareCard | undefined {
  const cached = channelShareCardStore.get(shareId);
  if (cached) return cached;
  const persisted = readPersistentRecord<MiniProgramShareCard>("channel-share-cards", shareId);
  if (persisted) channelShareCardStore.set(shareId, persisted);
  return persisted;
}

export function listChannelShareCards(): MiniProgramShareCard[] {
  return mergeRecords(
    [...channelShareCardStore.values()],
    readPersistentBucket<MiniProgramShareCard>("channel-share-cards"),
    (card) => card.share_id
  );
}

export function saveChannelGrowthEvent(event: ChannelGrowthEvent): void {
  channelGrowthEventStore.set(event.channel_event_id, event);
  writePersistentRecord("channel-growth-events", event.channel_event_id, event);
}

export function listChannelGrowthEvents(): ChannelGrowthEvent[] {
  return mergeRecords(
    [...channelGrowthEventStore.values()],
    readPersistentBucket<ChannelGrowthEvent>("channel-growth-events"),
    (event) => event.channel_event_id
  );
}

export function clearChannelForTests(): void {
  channelEntryStore.clear();
  anonymousLinkStore.clear();
  channelShareCardStore.clear();
  channelGrowthEventStore.clear();
  clearPersistentBucket("channel-entries");
  clearPersistentBucket("anonymous-links");
  clearPersistentBucket("channel-share-cards");
  clearPersistentBucket("channel-growth-events");
}

export function saveMiniProgramSession(session: MiniProgramSession): void {
  miniProgramSessionStore.set(session.session_id, session);
  writePersistentRecord("mini-program-sessions", session.session_id, session);
}

export function getMiniProgramSessionRecord(sessionId: string): MiniProgramSession | undefined {
  const cached = miniProgramSessionStore.get(sessionId);
  if (cached) return cached;
  const persisted = readPersistentRecord<MiniProgramSession>("mini-program-sessions", sessionId);
  if (persisted) miniProgramSessionStore.set(sessionId, persisted);
  return persisted;
}

export function saveWechatOpenIdBinding(binding: WechatOpenIdBinding): void {
  wechatOpenIdBindingStore.set(binding.openid_hash, binding);
  writePersistentRecord("wechat-openid-bindings", binding.openid_hash, binding);
}

export function getWechatOpenIdBindingRecord(openidHash: string): WechatOpenIdBinding | undefined {
  const cached = wechatOpenIdBindingStore.get(openidHash);
  if (cached) return cached;
  const persisted = readPersistentRecord<WechatOpenIdBinding>("wechat-openid-bindings", openidHash);
  if (persisted) wechatOpenIdBindingStore.set(openidHash, persisted);
  return persisted;
}

export function saveMiniProgramSharePayload(payload: MiniProgramSharePayload): void {
  miniProgramSharePayloadStore.set(payload.share_id, payload);
  writePersistentRecord("mini-program-share-payloads", payload.share_id, payload);
}

export function getMiniProgramSharePayloadRecord(shareId: string): MiniProgramSharePayload | undefined {
  const cached = miniProgramSharePayloadStore.get(shareId);
  if (cached) return cached;
  const persisted = readPersistentRecord<MiniProgramSharePayload>("mini-program-share-payloads", shareId);
  if (persisted) miniProgramSharePayloadStore.set(shareId, persisted);
  return persisted;
}

export function saveSubscribeConsent(consent: SubscribeTemplateConsent): void {
  subscribeConsentStore.set(subscribeConsentKey(consent.member_id, consent.template_type), consent);
  writePersistentRecord("mini-program-subscribe-consents", subscribeConsentKey(consent.member_id, consent.template_type), consent);
}

export function getSubscribeConsentRecord(memberId: string, templateType: string): SubscribeTemplateConsent | undefined {
  const key = subscribeConsentKey(memberId, templateType);
  const cached = subscribeConsentStore.get(key);
  if (cached) return cached;
  const persisted = readPersistentRecord<SubscribeTemplateConsent>("mini-program-subscribe-consents", key);
  if (persisted) subscribeConsentStore.set(key, persisted);
  return persisted;
}

export function saveMiniProgramReminderEvent(event: MiniProgramReminderEvent): void {
  miniProgramReminderEventStore.set(event.reminder_event_id, event);
  writePersistentRecord("mini-program-reminder-events", event.reminder_event_id, event);
}

export function listMiniProgramReminderEvents(): MiniProgramReminderEvent[] {
  return mergeRecords(
    [...miniProgramReminderEventStore.values()],
    readPersistentBucket<MiniProgramReminderEvent>("mini-program-reminder-events"),
    (event) => event.reminder_event_id
  );
}

export function clearMiniProgramForTests(): void {
  miniProgramSessionStore.clear();
  wechatOpenIdBindingStore.clear();
  miniProgramSharePayloadStore.clear();
  subscribeConsentStore.clear();
  miniProgramReminderEventStore.clear();
  clearPersistentBucket("mini-program-sessions");
  clearPersistentBucket("wechat-openid-bindings");
  clearPersistentBucket("mini-program-share-payloads");
  clearPersistentBucket("mini-program-subscribe-consents");
  clearPersistentBucket("mini-program-reminder-events");
}

export function clearGrowthForTests(): void {
  shareLandingStore.clear();
  referralEventStore.clear();
  challengeProgressStore.clear();
  clearPersistentBucket("share-landings");
  clearPersistentBucket("referral-events");
  clearPersistentBucket("challenge-progress");
}

function writePersistentRecord(bucket: string, id: string, value: unknown): void {
  const bucketDir = persistentBucketDir(bucket);
  mkdirSync(bucketDir, { recursive: true });
  const finalPath = join(bucketDir, `${safeFileId(id)}.json`);
  const temporaryPath = `${finalPath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  writeFileSync(temporaryPath, JSON.stringify(value), "utf8");
  replacePersistentFile(temporaryPath, finalPath);
}

function readPersistentRecord<T>(bucket: string, id: string): T | undefined {
  const filePath = join(persistentBucketDir(bucket), `${safeFileId(id)}.json`);
  if (!existsSync(filePath)) return undefined;
  return readPersistentJson<T>(filePath);
}

function readPersistentBucket<T>(bucket: string): T[] {
  const bucketDir = persistentBucketDir(bucket);
  if (!existsSync(bucketDir)) return [];
  const records: T[] = [];
  for (const name of readdirSync(bucketDir)) {
    if (!name.endsWith(".json")) continue;
    const record = readPersistentJson<T>(join(bucketDir, name));
    if (record) records.push(record);
  }
  return records;
}

function clearPersistentBucket(bucket: string): void {
  const bucketDir = persistentBucketDir(bucket);
  if (existsSync(bucketDir)) {
    rmSync(bucketDir, { recursive: true, force: true });
  }
}

function persistentBucketDir(bucket: string): string {
  return join(persistentStoreDir, bucket);
}

function getPersistentStoreDir(): string {
  if (process.env.NODE_ENV === "test") {
    return join(/* turbopackIgnore: true */ process.cwd(), ".next", "phase-store", `test-${process.pid}`);
  }
  return join(/* turbopackIgnore: true */ process.cwd(), ".next", "phase-store");
}

function safeFileId(id: string): string {
  return encodeURIComponent(id);
}

function readPersistentJson<T>(filePath: string): T | undefined {
  try {
    const content = readFileSync(filePath, "utf8");
    if (!content.trim()) return undefined;
    return JSON.parse(content) as T;
  } catch (caught) {
    if (isMissingFileError(caught)) return undefined;
    throw caught;
  }
}

function isMissingFileError(caught: unknown): boolean {
  return typeof caught === "object" && caught !== null && "code" in caught && (caught as { code?: unknown }).code === "ENOENT";
}

function replacePersistentFile(temporaryPath: string, finalPath: string): void {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      renameSync(temporaryPath, finalPath);
      return;
    } catch (caught) {
      if (!isTransientFileReplaceError(caught) || attempt === 7) {
        throw caught;
      }
      sleepSync(15);
    }
  }
}

function isTransientFileReplaceError(caught: unknown): boolean {
  if (typeof caught !== "object" || caught === null || !("code" in caught)) return false;
  const code = (caught as { code?: unknown }).code;
  return code === "EPERM" || code === "EACCES" || code === "EBUSY";
}

function sleepSync(milliseconds: number): void {
  const buffer = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(buffer), 0, 0, milliseconds);
}

function entitlementKey(memberId: string, reportId: string): string {
  return `${memberId}__${reportId}`;
}

function challengeProgressKey(memberId: string, challengeId: string): string {
  return `${memberId}__${challengeId}`;
}

function subscribeConsentKey(memberId: string, templateType: string): string {
  return `${memberId}__${templateType}`;
}

function mergeRecords<T>(left: T[], right: T[], getKey: (record: T) => string): T[] {
  const records = new Map<string, T>();
  for (const record of right) records.set(getKey(record), record);
  for (const record of left) records.set(getKey(record), record);
  return [...records.values()];
}
