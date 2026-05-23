export const calendarTypes = ["gregorian", "lunar"] as const;
export type CalendarType = (typeof calendarTypes)[number];

export const genderRules = ["traditional_male", "traditional_female", "traditional_unspecified"] as const;
export type GenderRule = (typeof genderRules)[number];

export const interpretationModes = ["professional", "entertainment"] as const;
export type InterpretationMode = (typeof interpretationModes)[number];

export const confidenceLevels = ["strong_structure", "medium_structure", "weak_structure"] as const;
export type ConfidenceLevel = (typeof confidenceLevels)[number];

export const feedbackIssueCategories = ["blocking", "major", "minor", "content_review", "future_feature"] as const;
export type FeedbackIssueCategory = (typeof feedbackIssueCategories)[number];

export const feedbackTaskIds = ["create_chart", "select_palace", "switch_mode", "open_trace", "gesture_or_fallback", "submit_feedback"] as const;
export type FeedbackTaskId = (typeof feedbackTaskIds)[number];

export const feedbackDeviceTypes = ["desktop", "mobile", "tablet", "unknown"] as const;
export type FeedbackDeviceType = (typeof feedbackDeviceTypes)[number];

export const cameraPermissionStates = ["granted", "denied", "unavailable", "not_requested"] as const;
export type CameraPermissionState = (typeof cameraPermissionStates)[number];

export const reportTierIds = ["starter_19", "standard_49", "premium_99"] as const;
export type ReportTierId = (typeof reportTierIds)[number];

export const betaEventTypes = ["activation", "share_card_created", "favorite_saved", "report_intent_submitted", "feedback_submitted"] as const;
export type BetaEventType = (typeof betaEventTypes)[number];

export const displayModes = ["web_beta", "stage_screen", "ar_mobile"] as const;
export type DisplayMode = (typeof displayModes)[number];

export const immersiveStageEventTypes = [
  "select_palace",
  "cycle_layer",
  "cycle_major_period",
  "reset_view",
  "enter_panorama",
  "toggle_mode",
  "create_share_card"
] as const;
export type ImmersiveStageEventType = (typeof immersiveStageEventTypes)[number];

export const arCapabilityStatuses = ["ready", "fallback"] as const;
export type ARCapabilityStatus = (typeof arCapabilityStatuses)[number];

export type BirthProfile = {
  display_name?: string;
  calendar_type: CalendarType;
  birth_date: string;
  birth_time: string;
  timezone: string;
  location?: {
    name?: string;
    longitude?: number;
    latitude?: number;
  };
  is_leap_month: boolean;
  true_solar_time_enabled: boolean;
  gender_rule: GenderRule;
};

export type RuleConfig = {
  school_id: "default_ziwei_v0_1" | "experimental_sanhe_v0_1";
  zi_hour_day_boundary: "civil_midnight" | "late_zi_next_day";
  leap_month_policy: "same_month_number" | "split_leap_month";
  true_solar_time_policy?: "disabled" | "optional";
  four_transform_policy?: "default_stem" | "experimental_stem_variant";
  interpretation_style?: "balanced_modern" | "classical_source_first";
};

export type NormalizedBirth = {
  calendar_type: CalendarType;
  solar_date: string | null;
  lunar_date: string | null;
  local_time: string;
  timezone: string;
  time_index: number;
  true_solar_time_applied: boolean;
  engine_gender: "男" | "女";
};

export type Palace = {
  palace_id: string;
  name: string;
  branch: string;
  stem: string;
  main_stars: string[];
  support_stars: string[];
  transforms: TransformType[];
  strength_score: number | null;
  relation_refs: {
    opposite: string;
    triad: string[];
    neighbors: string[];
  };
};

export type Star = {
  name: string;
  category: "major" | "minor" | "adjective" | "tianma" | "other";
  palace_id: string;
  element: string | null;
  brightness: string | null;
  tags: string[];
};

export type TransformType = "hua_lu" | "hua_quan" | "hua_ke" | "hua_ji";

export type Transform = {
  type: TransformType;
  star: string;
  source_stem: string | null;
  palace_id: string;
};

export type MajorPeriod = {
  period_id: string;
  age_start: number;
  age_end: number;
  palace_id: string;
  direction: "clockwise" | "counter_clockwise" | "unknown";
};

export type Chart = {
  palaces: Palace[];
  stars: Star[];
  transforms: Transform[];
  major_periods: MajorPeriod[];
};

export type CalculationTrace = {
  step: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  warnings?: string[];
};

export type ChartCreateRequest = {
  birth_profile: BirthProfile;
  rule_config?: RuleConfig;
  rule_profile_id?: string;
};

export type ChartCreateResponse = {
  chart_id: string;
  rule_profile_id: string;
  rule_version: string;
  rule_config_used: RuleConfig;
  normalized_birth: NormalizedBirth;
  chart: Chart;
  trace: CalculationTrace[];
  warnings: Array<{ code: string; message: string }>;
  privacy: {
    share_birth_date: false;
    share_birth_time: false;
    share_location: false;
  };
};

export type InterpretRequest = {
  chart_id: string;
  palace_id: string;
  mode: InterpretationMode;
  major_period_id?: string;
  include_trace?: boolean;
  chart?: Chart;
};

export type InterpretationStatus = "ready" | "not_open";

export type InterpretationLayer =
  | "palace_theme"
  | "star_symbol"
  | "strength_modifier"
  | "relation"
  | "pattern"
  | "major_period"
  | "copy_generation";

export type RuleCondition =
  | { type: "palace"; value: string }
  | { type: "main_star"; value: string }
  | { type: "support_star"; value: string }
  | { type: "transform"; value: TransformType }
  | { type: "relation"; relation: "opposite" | "triad" | "neighbor"; target_palace_ids?: string[]; target_has_transform?: TransformType };

export type TraceSource = {
  title: string;
  excerpt: string;
  modern_translation: string;
};

export type InterpretationRule = {
  rule_id: string;
  layer: InterpretationLayer;
  palace_ids: string[];
  conditions: RuleCondition[];
  weight: number;
  source: TraceSource;
  professional_text: string;
  entertainment_text: string;
  scenario: string;
  advice: string;
  safety_flags: string[];
};

export type RuleMatch = {
  rule: InterpretationRule;
  matched_conditions: RuleCondition[];
  weight: number;
};

export type SafetyReviewResult = {
  text: string;
  flags: string[];
  blocked_terms: string[];
};

export type InterpretationTrace = {
  rule_id: string;
  palace_id: string;
  layer: InterpretationLayer;
  weight: number;
  confidence: ConfidenceLevel;
  matched_conditions: RuleCondition[];
  source: TraceSource;
  safety_flags: string[];
};

export type InterpretResponse = {
  chart_id: string;
  palace_id: string;
  mode: InterpretationMode;
  status: InterpretationStatus;
  interpretation: {
    basis: string;
    interpretation: string;
    scenario: string;
    advice: string;
    confidence: ConfidenceLevel;
    safety_flags: string[];
  };
  trace: InterpretationTrace[];
  generation?: {
    provider: "deepseek";
    model: "deepseek-v4-flash";
    status: "generated" | "fallback";
    reason?: "missing_api_key" | "test_mode" | "api_error" | "empty_model_content" | "invalid_model_json";
  };
};

export type ClosedTestDeviceInfo = {
  type: FeedbackDeviceType;
  browser?: string;
  viewport?: {
    width: number;
    height: number;
  };
  camera_permission: CameraPermissionState;
};

export type ClosedTestRatings = {
  overall: number;
  interpretation_trust: number;
  gesture_usability: number;
  share_willingness: number;
};

export type ClosedTestConsent = {
  agreed: boolean;
  no_sensitive_birth_data: true;
  no_video_frame: true;
};

export type ClosedTestFeedbackRequest = {
  session_id?: string;
  chart_id?: string;
  device: ClosedTestDeviceInfo;
  completed_tasks: readonly FeedbackTaskId[];
  ratings: ClosedTestRatings;
  issue_category: FeedbackIssueCategory;
  comment: string;
  screenshot_note?: string;
  consent: ClosedTestConsent;
};

export type ClosedTestFeedbackRecord = {
  feedback_id: string;
  session_id: string;
  chart_id?: string;
  received_at: string;
  device: ClosedTestDeviceInfo;
  completed_tasks: FeedbackTaskId[];
  ratings: ClosedTestRatings;
  issue_category: FeedbackIssueCategory;
  comment: string;
  screenshot_note?: string;
  consent: ClosedTestConsent;
};

export type ClosedTestPrivacy = {
  stores_full_birth_date: false;
  stores_birth_time: false;
  stores_location_detail: false;
  stores_video_frame: false;
};

export type ClosedTestMetricsSummary = {
  total_feedback: number;
  completion_rate: number;
  share_willingness_rate: number;
  average_ratings: ClosedTestRatings;
  issue_counts: Record<FeedbackIssueCategory, number>;
  phase_exit_targets: {
    completion_rate_target: 0.6;
    share_willingness_target: 0.2;
  };
  privacy: ClosedTestPrivacy;
};

export type ClosedTestFeedbackResponse = {
  feedback_id: string;
  session_id: string;
  received_at: string;
  sanitized_feedback: ClosedTestFeedbackRecord;
  metrics_snapshot: ClosedTestMetricsSummary;
  privacy: ClosedTestPrivacy;
};

export type BetaPrivacy = {
  hides_full_birth_date: true;
  hides_birth_time: true;
  hides_location_detail: true;
  stores_video_frame: false;
  real_payment_enabled: false;
};

export type BetaShareCardRequest = {
  chart_id: string;
  palace_id: string;
  mode: InterpretationMode;
  session_id?: string;
  chart?: Chart;
};

export type BetaShareCard = {
  share_card_id: string;
  created_at: string;
  session_id: string;
  chart_id: string;
  palace_id: string;
  palace_label: string;
  mode: InterpretationMode;
  title: string;
  star_keywords: string[];
  summary: string;
  privacy_note: string;
  share_text: string;
  safety_flags: string[];
};

export type BetaShareCardResponse = {
  share_card_id: string;
  share_card: BetaShareCard;
  dashboard_snapshot: BetaDashboardSummary;
  privacy: BetaPrivacy;
};

export type BetaFavoriteRequest = {
  chart_id: string;
  palace_id: string;
  session_id?: string;
  note?: string;
  chart?: Chart;
};

export type BetaFavoriteRecord = {
  favorite_id: string;
  created_at: string;
  session_id: string;
  chart_id: string;
  palace_id: string;
  palace_label: string;
  note?: string;
};

export type BetaFavoriteResponse = {
  favorite_id: string;
  favorite: BetaFavoriteRecord;
  dashboard_snapshot: BetaDashboardSummary;
  privacy: BetaPrivacy;
};

export type BetaReportIntentRequest = {
  chart_id: string;
  session_id?: string;
  tier_id: ReportTierId;
  intent_level: number;
  contact_opt_in: boolean;
  note?: string;
};

export type BetaReportIntentRecord = {
  report_intent_id: string;
  created_at: string;
  session_id: string;
  chart_id: string;
  tier_id: ReportTierId;
  intent_level: number;
  contact_opt_in: boolean;
  note?: string;
  payment_status: "intent_only";
};

export type BetaReportIntentResponse = {
  report_intent_id: string;
  report_intent: BetaReportIntentRecord;
  dashboard_snapshot: BetaDashboardSummary;
  privacy: BetaPrivacy;
};

export type BetaEventRecord = {
  event_id: string;
  type: BetaEventType;
  timestamp: string;
  session_id: string;
  chart_id?: string;
  target_palace_id?: string;
  action: string;
  metadata?: Record<string, string | number | boolean>;
};

export type BetaDashboardSummary = {
  total_beta_events: number;
  active_sessions: number;
  share_cards_created: number;
  favorites_saved: number;
  report_intents: number;
  share_rate: number;
  favorite_rate: number;
  report_intent_rate: number;
  report_price_interest: Record<ReportTierId, number>;
  closed_test: ClosedTestMetricsSummary;
  content_safety: {
    safety_flag_hits: number;
    hard_prediction_violations: 0;
  };
  beta_exit_targets: {
    completion_rate_target: 0.6;
    share_rate_target: 0.2;
    report_intent_rate_target: 0.05;
  };
  privacy: {
    event_logs_store_sensitive_birth_data: false;
    share_cards_hide_full_birth_date: true;
    favorites_hide_birth_time: true;
    report_intents_are_payment_free: true;
    stores_video_frame: false;
  };
};

export type ImmersivePrivacy = {
  hides_full_birth_date: true;
  hides_birth_time: true;
  hides_location_detail: true;
  stores_video_frame: false;
};

export type CalibrationProfile = {
  camera_permission: CameraPermissionState;
  light_quality: "good" | "dim" | "unknown";
  ar_supported: boolean;
  fallback_mode: "manual_panorama" | "none";
  no_video_frame: true;
};

export type ARCapability = {
  status: ARCapabilityStatus;
  webxr_supported: boolean;
  camera_permission: CameraPermissionState;
  device_type: FeedbackDeviceType;
  fallback_mode: "manual_panorama" | "none";
  no_video_frame: true;
};

export type ImmersiveSession = {
  session_id: string;
  short_code: string;
  chart_id: string;
  display_mode: DisplayMode;
  created_at: string;
  expires_at: string;
  controller_label?: string;
  active_palace_id?: string;
  active_layer: "main" | "support" | "transforms";
  active_major_period_index: number;
  interpretation_mode: InterpretationMode;
  is_panorama: boolean;
  event_count: number;
  privacy: ImmersivePrivacy;
  calibration: CalibrationProfile;
};

export type CreateImmersiveSessionRequest = {
  chart_id: string;
  display_mode: DisplayMode;
  ttl_minutes?: number;
  controller_label?: string;
};

export type ImmersiveSessionResponse = {
  session: ImmersiveSession;
  privacy: ImmersivePrivacy;
};

export type StageEventRequest = {
  type: ImmersiveStageEventType;
  target_palace_id?: string;
  confidence?: number;
  gesture_type?: "open_palm" | "point" | "pinch" | "circle" | "fist" | "two_hand_spread" | "palm_flip";
  note?: string;
  session_snapshot?: ImmersiveSession;
};

export type StageEvent = {
  event_id: string;
  session_id: string;
  type: ImmersiveStageEventType;
  timestamp: string;
  target_palace_id?: string;
  confidence: number;
  gesture_type?: StageEventRequest["gesture_type"];
  action: string;
  note?: string;
  no_video_frame: true;
};

export type StageEventResponse = {
  session: ImmersiveSession;
  event: StageEvent;
  privacy: ImmersivePrivacy;
};

export type ImmersiveStreamResponse = {
  session: ImmersiveSession;
  events: StageEvent[];
  performance_targets: {
    sync_latency_ms: 250;
    ar_startup_ms: 3000;
    stage_min_fps: 30;
  };
  privacy: ImmersivePrivacy;
};

export type ImmersiveSessionSummary = {
  session_id: string;
  display_mode: DisplayMode;
  event_count: number;
  active_palace_id?: string;
  active_layer: ImmersiveSession["active_layer"];
  active_major_period_index: number;
  interpretation_mode: InterpretationMode;
  is_panorama: boolean;
  performance_targets: ImmersiveStreamResponse["performance_targets"];
  privacy: ImmersivePrivacy;
};

export const timelineScopes = ["annual", "monthly"] as const;
export type TimelineScope = (typeof timelineScopes)[number];

export type Phase7Privacy = {
  hides_full_birth_date: true;
  hides_birth_time: true;
  hides_location_detail: true;
  stores_video_frame: false;
  requires_participant_consent: true;
};

export type SynastryConsent = {
  agreed: boolean;
  no_sensitive_birth_data: true;
};

export type SynastryProfile = {
  label: string;
  chart_id: string;
  chart?: Chart;
  consent: SynastryConsent;
};

export type RelationshipTrace = {
  rule_id: string;
  layer: "synastry" | "annual_monthly";
  title: string;
  weight: number;
  confidence: ConfidenceLevel;
  source: TraceSource;
  safety_flags: string[];
  matched_points: string[];
};

export type Phase7ShareCard = {
  share_card_id: string;
  title: string;
  summary: string;
  share_text: string;
  privacy_note: string;
  safety_flags: string[];
};

export type SynastryResult = {
  synastry_id: string;
  status: "ready";
  mode: InterpretationMode;
  rule_profile_ids?: string[];
  rule_version?: string;
  created_at: string;
  participant_labels: [string, string];
  summary: string;
  communication_style: string;
  cooperation_rhythm: string;
  complementary_points: string[];
  conflict_reminders: string[];
  shared_advice: string[];
  confidence: ConfidenceLevel;
  safety_flags: string[];
  trace: RelationshipTrace[];
};

export type SynastryCreateRequest = {
  mode: InterpretationMode;
  primary: SynastryProfile;
  partner: SynastryProfile;
};

export type SynastryCreateResponse = {
  result: SynastryResult;
  share_card: Phase7ShareCard;
  privacy: Phase7Privacy;
};

export type AnnualTheme = {
  year: number;
  focus_palace_id: string;
  title: string;
  basis: string;
  scenario: string;
  advice: string;
  confidence: ConfidenceLevel;
  safety_flags: string[];
};

export type MonthlyTheme = {
  month: number;
  focus_palace_id: string;
  title: string;
  focus: string;
  scenario: string;
  advice: string;
  confidence: ConfidenceLevel;
  safety_flags: string[];
};

export type TimelineInterpretRequest = {
  chart_id: string;
  chart?: Chart;
  year: number;
  month?: number;
  mode: InterpretationMode;
  palace_id?: string;
};

export type TimelineInterpretResponse = {
  timeline_id: string;
  chart_id: string;
  rule_profile_id?: string;
  rule_version?: string;
  scope: TimelineScope;
  mode: InterpretationMode;
  palace_id: string;
  annual_theme: AnnualTheme;
  monthly_theme?: MonthlyTheme;
  trace: RelationshipTrace[];
  share_card: Phase7ShareCard;
  privacy: Phase7Privacy;
};

export const reportTypes = ["single_chart", "synastry", "timeline"] as const;
export type ReportType = (typeof reportTypes)[number];

export const reportExportFormats = ["html", "pdf"] as const;
export type ReportExportFormat = (typeof reportExportFormats)[number];

export const creatorAssetTypes = ["live_outline", "short_video_script", "palace_card", "synastry_card", "timeline_card"] as const;
export type CreatorAssetType = (typeof creatorAssetTypes)[number];

export const contentReviewStatuses = ["approved", "needs_review", "blocked"] as const;
export type ContentReviewStatus = (typeof contentReviewStatuses)[number];

export type ReportPrivacy = {
  hides_full_birth_date: true;
  hides_birth_time: true;
  hides_location_detail: true;
  stores_video_frame: false;
  stores_full_birth_profile: false;
  real_payment_enabled: false;
};

export type ReportTrace = {
  rule_id: string;
  title: string;
  source_title: string;
  modern_translation: string;
  weight: number;
  confidence: ConfidenceLevel;
  safety_flags: string[];
};

export type ReportSection = {
  section_id: string;
  title: string;
  palace_id?: string;
  basis: string;
  interpretation: string;
  scenario?: string;
  advice?: string;
  trace: ReportTrace[];
  safety_flags: string[];
  share_blocks: string[];
  confidence: ConfidenceLevel;
};

export type ReportTemplate = {
  template_id: string;
  report_type: ReportType;
  version: "v0.1";
  title: string;
  section_strategy: string;
  supported_formats: ReportExportFormat[];
};

export type CreatorAsset = {
  asset_id: string;
  asset_type: CreatorAssetType;
  title: string;
  body: string;
  safety_flags: string[];
  privacy_note: string;
};

export type ContentReviewQueueItem = {
  review_id: string;
  report_id: string;
  status: ContentReviewStatus;
  blocked_terms: string[];
  privacy_flags: string[];
  safety_flags: string[];
  checked_at: string;
  notes: string[];
};

export type ReportDraft = {
  report_id: string;
  report_type: ReportType;
  mode: InterpretationMode;
  rule_profile_id?: string;
  rule_version?: string;
  template_id: string;
  template_version: "v0.1";
  title: string;
  created_at: string;
  chart_ref?: {
    chart_id: string;
    snapshot_type: "chart" | "synastry" | "timeline";
  };
  source_refs?: {
    synastry_id?: string;
    timeline_id?: string;
  };
  sections: ReportSection[];
  creator_assets: CreatorAsset[];
  review: ContentReviewQueueItem;
  privacy_note: string;
  safety_flags: string[];
  price_tier_hint: ReportTierId;
};

export type ReportDraftRequest = {
  report_type: ReportType;
  mode: InterpretationMode;
  chart_id?: string;
  chart?: Chart;
  synastry?: SynastryCreateResponse;
  timeline?: TimelineInterpretResponse;
};

export type ExportPreview = {
  export_preview_id: string;
  report_id: string;
  format: ReportExportFormat;
  preview_url: string;
  created_at: string;
  expires_at: string;
  review_status: ContentReviewStatus;
  order_created: false;
  payment_status: "preview_only";
  privacy_note: string;
};

export type ExportPreviewRequest = {
  report_id: string;
  format: ReportExportFormat;
};

export const orderStatuses = ["draft", "pending_payment", "paid", "fulfilled", "failed", "expired", "refunded_manual"] as const;
export type OrderStatus = (typeof orderStatuses)[number];

export const orderPackageIds = ["single_report", "light_membership"] as const;
export type OrderPackageId = (typeof orderPackageIds)[number];

export const paymentProviders = ["stripe_checkout", "wechat_pay_reserved", "alipay_reserved"] as const;
export type PaymentProvider = (typeof paymentProviders)[number];

export const checkoutSessionStatuses = ["open", "completed", "expired"] as const;
export type CheckoutSessionStatus = (typeof checkoutSessionStatuses)[number];

export type CommercialConsent = {
  agreed: boolean;
  service_terms: boolean;
  privacy_policy: boolean;
  refund_policy: boolean;
  cultural_entertainment_only: boolean;
};

export type CommercialPrivacy = {
  stores_full_birth_date: false;
  stores_birth_time: false;
  stores_location_detail: false;
  stores_video_frame: false;
};

export type Order = {
  order_id: string;
  report_id: string;
  member_id: string;
  package_id: OrderPackageId;
  tier_id: ReportTierId;
  report_type: ReportType;
  amount_cents: number;
  currency: "cny";
  status: OrderStatus;
  payment_provider: PaymentProvider;
  checkout_session_id?: string;
  created_at: string;
  updated_at: string;
  fulfilled_at?: string;
  refunded_at?: string;
  compliance: {
    service_terms_accepted: boolean;
    privacy_policy_accepted: boolean;
    refund_policy_accepted: boolean;
    cultural_entertainment_only: boolean;
  };
  privacy: CommercialPrivacy;
};

export type OrderCreateRequest = {
  report_id: string;
  package_id: OrderPackageId;
  tier_id: ReportTierId;
  member_id?: string;
  consent: CommercialConsent;
};

export type CheckoutSession = {
  checkout_session_id: string;
  order_id: string;
  provider: PaymentProvider;
  provider_mode: "sandbox" | "production";
  checkout_url: string;
  status: CheckoutSessionStatus;
  created_at: string;
  expires_at: string;
  sandbox_webhook?: {
    raw_body: string;
    signature_header: string;
  };
};

export type CheckoutSessionRequest = {
  order_id: string;
  provider: PaymentProvider;
  success_url: string;
  cancel_url: string;
};

export type PaymentWebhookRequest = {
  provider: PaymentProvider;
  raw_body: string;
  signature: string;
};

export type PaymentEvent = {
  payment_event_id: string;
  provider: PaymentProvider;
  event_type: string;
  checkout_session_id: string;
  order_id: string;
  received_at: string;
  signature_verified: boolean;
  is_duplicate: boolean;
  order: Order;
};

export type MemberEntitlement = {
  entitlement_id: string;
  member_id: string;
  report_id: string;
  source_order_id: string;
  has_access: boolean;
  can_read_report: boolean;
  export_preview_credits: number;
  favorite_enabled: boolean;
  created_at: string;
  privacy_note: string;
  report_snapshot?: ReportDraft;
};

export type MemberEntitlementSummary = {
  member_id: string;
  purchased_report_ids: string[];
  light_membership_active: boolean;
  entitlements: MemberEntitlement[];
  privacy: CommercialPrivacy;
};

export type CommercialDashboardSummary = {
  total_orders: number;
  pending_orders: number;
  paid_orders: number;
  fulfilled_orders: number;
  failed_orders: number;
  refunded_manual_orders: number;
  payment_conversion_rate: number;
  average_order_value_cents: number;
  report_type_counts: Record<ReportType, number>;
  content_review_block_rate: number;
  payment_provider_counts: Record<PaymentProvider, number>;
  privacy: CommercialPrivacy;
};

export const opsRoles = ["ops_admin", "support_agent", "content_reviewer"] as const;
export type OpsRole = (typeof opsRoles)[number];

export const supportTicketCategories = ["payment_failed", "unfulfilled", "refund_request", "content_dispute", "privacy_deletion", "general"] as const;
export type SupportTicketCategory = (typeof supportTicketCategories)[number];

export const supportTicketPriorities = ["low", "normal", "high", "urgent"] as const;
export type SupportTicketPriority = (typeof supportTicketPriorities)[number];

export const supportTicketStatuses = ["open", "in_progress", "resolved", "closed"] as const;
export type SupportTicketStatus = (typeof supportTicketStatuses)[number];

export const launchGrowthEventTypes = [
  "chart_to_purchase",
  "preview_to_payment",
  "payment_to_revisit",
  "entitlement_usage",
  "share_to_purchase",
  "repeat_purchase_intent"
] as const;
export type LaunchGrowthEventType = (typeof launchGrowthEventTypes)[number];

export type OpsAuth = {
  token?: string;
  role?: OpsRole;
  actor_id?: string;
};

export type LaunchPaymentConfig = {
  provider: "stripe_checkout";
  provider_mode: "sandbox" | "production";
  production_payment_enabled: boolean;
  rollout_percent: number;
  rollback_enabled: boolean;
  webhook_secret_configured: boolean;
  max_production_amount_cents: number;
  public_status: "sandbox_only" | "production_ready" | "rollback_active" | "needs_webhook_secret";
};

export type LaunchPaymentConfigInput = {
  stripe_secret_key?: string;
  webhook_secret_configured?: boolean;
  production_payment_enabled?: boolean;
  rollout_percent?: number;
  rollback_enabled?: boolean;
  max_production_amount_cents?: number;
};

export type PaymentLaunchGateRequest = {
  member_id: string;
  amount_cents: number;
  config?: LaunchPaymentConfig;
};

export type PaymentLaunchGateResult = {
  allowed: boolean;
  reason:
    | "production_allowed"
    | "production_disabled"
    | "outside_rollout"
    | "rollback_enabled"
    | "amount_exceeds_limit"
    | "webhook_secret_missing";
  rollout_bucket: number;
  provider_mode: LaunchPaymentConfig["provider_mode"];
};

export type OpsOrderListRequest = {
  auth: OpsAuth;
  status?: OrderStatus;
  member_id?: string;
};

export type OpsOrderListResponse = {
  orders: Order[];
  filters: {
    status?: OrderStatus;
    member_id?: string;
  };
  privacy: CommercialPrivacy;
};

export type OpsOrderNote = {
  note_id: string;
  order_id: string;
  ticket_id?: string;
  action: "manual_refund_marked" | "support_note_added" | "webhook_exception";
  note: string;
  actor_role: OpsRole;
  actor_id?: string;
  created_at: string;
};

export type OpsRefundRequest = {
  auth: OpsAuth;
  order_id: string;
  reason: string;
  ticket_id?: string;
};

export type OpsRefundResponse = {
  order: Order;
  note: OpsOrderNote;
  privacy: CommercialPrivacy;
};

export type SupportTicketConsent = {
  agreed: boolean;
  no_sensitive_birth_data: true;
};

export type SupportTicketRequest = {
  member_id: string;
  order_id?: string;
  report_id?: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  subject: string;
  message: string;
  consent: SupportTicketConsent;
};

export type SupportTicketAuditEntry = {
  audit_id: string;
  action: string;
  actor_role: OpsRole | "user";
  actor_id?: string;
  note?: string;
  created_at: string;
};

export type SupportTicket = {
  ticket_id: string;
  member_id: string;
  order_id?: string;
  report_id?: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  subject: string;
  message: string;
  assignee?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  consent: SupportTicketConsent;
  audit_trail: SupportTicketAuditEntry[];
};

export type SupportTicketUpdateRequest = {
  auth: OpsAuth;
  ticket_id: string;
  status: SupportTicketStatus;
  assignee?: string;
  note?: string;
};

export type LaunchGrowthEvent = {
  growth_event_id: string;
  type: LaunchGrowthEventType;
  member_id?: string;
  report_id?: string;
  order_id?: string;
  value_cents?: number;
  created_at: string;
};

export type LaunchGrowthEventRequest = {
  type: LaunchGrowthEventType;
  member_id?: string;
  report_id?: string;
  order_id?: string;
  value_cents?: number;
};

export type LaunchRiskSummary = {
  payment_failure_rate: number;
  refund_rate: number;
  webhook_exception_count: number;
  content_review_block_rate: number;
  privacy_scan_violations: number;
  unauthorized_access_attempts: number;
};

export type SupportOpsSummary = {
  total_tickets: number;
  open_tickets: number;
  resolved_tickets: number;
  high_priority_tickets: number;
  refund_request_tickets: number;
  privacy_deletion_tickets: number;
  sla_attention_required: number;
};

export type GrowthDashboardSummary = Record<LaunchGrowthEventType, number>;

export type LaunchOperationsDashboard = {
  launch_config: LaunchPaymentConfig;
  orders: CommercialDashboardSummary;
  risk: LaunchRiskSummary;
  support: SupportOpsSummary;
  growth: GrowthDashboardSummary;
  privacy: CommercialPrivacy;
};

export const ruleProfileReviewStatuses = ["confirmed", "experimental", "needs_consultant_review"] as const;
export type RuleProfileReviewStatus = (typeof ruleProfileReviewStatuses)[number];

export type RuleVersion = {
  version_id: string;
  label: string;
  released_at: string;
  source: string;
};

export type RuleProfile = {
  profile_id: string;
  label: string;
  description: string;
  version: RuleVersion;
  rule_config: RuleConfig;
  consultant_review_status: RuleProfileReviewStatus;
  is_default: boolean;
  risk_note: string;
  supported_features: string[];
  safety_flags: string[];
};

export type RuleProfileListResponse = {
  profiles: RuleProfile[];
  default_profile_id: string;
};

export type RuleDiff = {
  field: keyof RuleConfig | "interpretation_style";
  base_value: string;
  candidate_value: string;
  reason: string;
  impact: string;
  requires_consultant_review: boolean;
};

export type RuleCompareRequest = {
  birth_profile: BirthProfile;
  base_rule_profile_id: string;
  candidate_rule_profile_id: string;
};

export type RuleCompareChartSummary = {
  chart_id: string;
  rule_profile_id: string;
  rule_version: string;
  palace_count: number;
  transform_count: number;
};

export type RuleCompareResponse = {
  base_profile: RuleProfile;
  candidate_profile: RuleProfile;
  base_chart: RuleCompareChartSummary;
  candidate_chart: RuleCompareChartSummary;
  diffs: RuleDiff[];
  privacy: CommercialPrivacy;
};

export const knowledgeNodeTypes = ["star", "palace", "transform", "pattern", "source", "rule", "theme"] as const;
export type KnowledgeNodeType = (typeof knowledgeNodeTypes)[number];

export const knowledgeEdgeRelations = ["appears_in_rule", "derived_from", "maps_to", "modifies", "belongs_to", "supports_trace"] as const;
export type KnowledgeEdgeRelation = (typeof knowledgeEdgeRelations)[number];

export type SourceTrace = {
  title: string;
  excerpt: string;
  modern_translation: string;
};

export type KnowledgeNode = {
  node_id: string;
  node_type: KnowledgeNodeType;
  label: string;
  summary: string;
  tags: string[];
  source: SourceTrace;
  safety_flags: string[];
};

export type KnowledgeEdge = {
  edge_id: string;
  from_node_id: string;
  to_node_id: string;
  relation: KnowledgeEdgeRelation;
  rule_ids: string[];
  weight: number;
  note: string;
};

export type KnowledgeSearchRequest = {
  query?: string;
  node_type?: KnowledgeNodeType;
  source_title?: string;
  rule_usage?: string;
  limit?: number;
};

export type KnowledgeSearchResult = {
  node: KnowledgeNode;
  matched_fields: string[];
  score: number;
};

export type KnowledgeSearchResponse = {
  query: string;
  results: KnowledgeSearchResult[];
  privacy: CommercialPrivacy;
};

export type KnowledgeNodeDetail = {
  node: KnowledgeNode;
  edges: KnowledgeEdge[];
  related_nodes: KnowledgeNode[];
  privacy: CommercialPrivacy;
};

export const dailyQuestCategories = ["reflection", "organization", "communication", "restoration"] as const;
export type DailyQuestCategory = (typeof dailyQuestCategories)[number];

export const starAtlasCategories = ["major_star", "support_star", "transform", "pattern"] as const;
export type StarAtlasCategory = (typeof starAtlasCategories)[number];

export const starAtlasUnlockStatuses = ["locked", "unlocked"] as const;
export type StarAtlasUnlockStatus = (typeof starAtlasUnlockStatuses)[number];

export const dailyShareCardTypes = ["daily_theme", "star_atlas", "seasonal_theme"] as const;
export type DailyShareCardType = (typeof dailyShareCardTypes)[number];

export type DailyPrivacy = {
  hides_full_birth_date: true;
  hides_birth_time: true;
  hides_location_detail: true;
  stores_video_frame: false;
  stores_full_birth_profile: false;
};

export type SeasonalTheme = {
  seasonal_theme_id: string;
  label: string;
  theme_date: string;
  copy: string;
  safety_flags: string[];
};

export type DailyQuest = {
  quest_id: string;
  title: string;
  prompt: string;
  category: DailyQuestCategory;
  safety_flags: string[];
  completed: boolean;
};

export type DailyTrace = {
  trace_id: string;
  rule_id: string;
  rule_profile_id: string;
  rule_version: string;
  knowledge_node_ids: string[];
  basis: string;
  confidence: ConfidenceLevel;
  safety_flags: string[];
};

export type DailyShareCard = {
  share_card_id: string;
  version: "v0.3";
  card_type: DailyShareCardType;
  title: string;
  summary: string;
  keywords: string[];
  privacy_note: string;
  safety_flags: string[];
};

export type DailyTheme = {
  daily_theme_id: string;
  chart_id: string;
  date: string;
  mode: InterpretationMode;
  palace_id: string;
  palace_label: string;
  rule_profile_id: string;
  rule_version: string;
  title: string;
  summary: string;
  star_keywords: string[];
  seasonal_theme?: SeasonalTheme;
  quests: DailyQuest[];
  trace: DailyTrace[];
  share_card: DailyShareCard;
  safety_flags: string[];
};

export type DailyThemeRequest = {
  chart_id: string;
  date: string;
  mode: InterpretationMode;
  palace_id?: string;
  chart?: Chart;
  member_id?: string;
};

export type DailyThemeResponse = {
  daily_theme: DailyTheme;
  privacy: DailyPrivacy;
};

export type StarAtlasCard = {
  card_id: string;
  label: string;
  category: StarAtlasCategory;
  unlock_status: StarAtlasUnlockStatus;
  keywords: string[];
  summary: string;
  knowledge_node_id: string;
  source_title: string;
  safety_flags: string[];
};

export type StarAtlasListRequest = {
  member_id?: string;
};

export type StarAtlasListResponse = {
  cards: StarAtlasCard[];
  privacy: DailyPrivacy;
};

export type StarAtlasCardResponse = {
  card: StarAtlasCard;
  related_knowledge_node_id: string;
  privacy: DailyPrivacy;
};

export type Achievement = {
  achievement_id: string;
  label: string;
  description: string;
  unlocked: boolean;
  progress: number;
  target: number;
  unlocked_at?: string;
  safety_flags: string[];
};

export type AchievementListResponse = {
  member_id: string;
  achievements: Achievement[];
  privacy: DailyPrivacy;
};

export type DailyCheckInConsent = {
  agreed: boolean;
  no_sensitive_birth_data: true;
  no_video_frame: true;
};

export type CheckInEvent = {
  check_in_id: string;
  daily_theme_id: string;
  member_id: string;
  completed_quest_ids: string[];
  favorite_star_card_ids: string[];
  share_intent: boolean;
  feedback?: string;
  created_at: string;
  consent: DailyCheckInConsent;
};

export type DailyCheckInRequest = {
  daily_theme_id: string;
  member_id?: string;
  completed_quest_ids: string[];
  favorite_star_card_ids?: string[];
  share_intent?: boolean;
  feedback?: string;
  consent: DailyCheckInConsent;
};

export type DailyCheckInResponse = {
  check_in: CheckInEvent;
  achievements: Achievement[];
  privacy: DailyPrivacy;
};

export const pwaInstallStates = ["unsupported", "prompt_available", "installed", "dismissed"] as const;
export type PwaInstallState = (typeof pwaInstallStates)[number];

export const shareLandingSourceTypes = ["daily_theme", "star_atlas", "achievement", "seasonal_theme"] as const;
export type ShareLandingSourceType = (typeof shareLandingSourceTypes)[number];

export const referralEventTypes = [
  "share_opened",
  "invite_visit",
  "daily_theme_created",
  "daily_check_in",
  "atlas_unlocked",
  "challenge_joined"
] as const;
export type ReferralEventType = (typeof referralEventTypes)[number];

export const communityChallengeTypes = ["seven_day_stargarden", "seasonal_theme", "star_atlas_collection"] as const;
export type CommunityChallengeType = (typeof communityChallengeTypes)[number];

export const challengeProgressStatuses = ["not_joined", "active", "completed"] as const;
export type ChallengeProgressStatus = (typeof challengeProgressStatuses)[number];

export type DailyStreak = {
  member_id: string;
  current_streak_days: number;
  longest_streak_days: number;
  last_check_in_date?: string;
  break_protection_available: boolean;
  week_theme: string;
  next_recommended_action: string;
  privacy_note: string;
};

export type DailyStreakRequest = {
  member_id?: string;
  as_of_date?: string;
};

export type DailyStreakResponse = {
  streak: DailyStreak;
  privacy: DailyPrivacy;
};

export type ShareLandingSnapshot = {
  share_id: string;
  version: "v0.1";
  source_type: ShareLandingSourceType;
  source_id: string;
  title: string;
  summary: string;
  keywords: string[];
  safety_flags: string[];
  created_at: string;
  privacy_note: string;
};

export type ShareCreateRequest = {
  member_id?: string;
  source_type: ShareLandingSourceType;
  source_id: string;
  title: string;
  summary: string;
  keywords?: string[];
  safety_flags?: string[];
};

export type ShareCreateResponse = {
  share_url: string;
  snapshot: ShareLandingSnapshot;
  privacy: DailyPrivacy;
};

export type ShareLandingResponse = {
  snapshot: ShareLandingSnapshot;
  privacy: DailyPrivacy;
};

export type ReferralEvent = {
  referral_event_id: string;
  share_id: string;
  event_type: ReferralEventType;
  visitor_id?: string;
  member_id?: string;
  created_at: string;
  is_duplicate: boolean;
  metadata: Record<string, string | number | boolean>;
};

export type ReferralEventRequest = {
  share_id: string;
  event_type: ReferralEventType;
  visitor_id?: string;
  member_id?: string;
  metadata?: Record<string, string | number | boolean>;
};

export type Phase13GrowthDashboardSummary = Record<ReferralEventType, number> & {
  total_referral_events: number;
  privacy: DailyPrivacy;
};

export type ReferralEventResponse = {
  event: ReferralEvent;
  dashboard_snapshot: Phase13GrowthDashboardSummary;
  privacy: DailyPrivacy;
};

export type CommunityChallenge = {
  challenge_id: string;
  title: string;
  description: string;
  challenge_type: CommunityChallengeType;
  target_count: number;
  safety_flags: string[];
  share_card_enabled: boolean;
  seasonal: boolean;
};

export type ChallengeProgress = {
  challenge_id: string;
  member_id: string;
  status: ChallengeProgressStatus;
  current_count: number;
  target_count: number;
  joined_at?: string;
  completed_at?: string;
  last_check_in_ref?: string;
  privacy_note: string;
};

export type ChallengeListRequest = {
  member_id?: string;
};

export type ChallengeListResponse = {
  challenges: CommunityChallenge[];
  progress: ChallengeProgress[];
  privacy: DailyPrivacy;
};

export type ChallengeJoinRequest = {
  member_id?: string;
  challenge_id: string;
};

export type ChallengeJoinResponse = {
  challenge: CommunityChallenge;
  progress: ChallengeProgress;
  privacy: DailyPrivacy;
};

export type ChallengeCheckInRequest = {
  member_id?: string;
  challenge_id: string;
  check_in_ref?: string;
};

export type ChallengeCheckInResponse = ChallengeJoinResponse & {
  share_snapshot: ShareLandingSnapshot;
};

export const channelSources = ["wechat_group", "mini_program", "qr_event", "short_video", "creator_homepage", "organic"] as const;
export type ChannelSource = (typeof channelSources)[number];

export const channelShareFormats = ["mini_program_card", "h5_poster", "qr_landing"] as const;
export type ChannelShareFormat = (typeof channelShareFormats)[number];

export const channelGrowthEventTypes = [
  "share_opened",
  "invite_visit",
  "daily_theme_created",
  "daily_check_in",
  "challenge_joined",
  "report_intent"
] as const;
export type ChannelGrowthEventType = (typeof channelGrowthEventTypes)[number];

export type CampaignAttribution = {
  channel: ChannelSource;
  campaign?: string;
  share_id?: string;
  referrer?: string;
  visitor_id: string;
};

export type ChannelEntry = {
  entry_id: string;
  channel: ChannelSource;
  campaign?: string;
  share_id?: string;
  referrer?: string;
  visitor_id: string;
  created_at: string;
  attribution: CampaignAttribution;
  privacy_note: string;
};

export type ChannelEntryRequest = {
  channel: ChannelSource;
  campaign?: string;
  share_id?: string;
  referrer?: string;
  visitor_id?: string;
};

export type ChannelEntryResponse = {
  entry: ChannelEntry;
  landing_url: string;
  privacy: DailyPrivacy;
};

export type AnonymousLink = {
  link_id: string;
  visitor_id: string;
  member_id: string;
  openid_placeholder?: string;
  linked_at: string;
  privacy_note: string;
};

export type AnonymousLinkRequest = {
  visitor_id: string;
  member_id: string;
  openid_placeholder?: string;
};

export type AnonymousLinkResponse = {
  link: AnonymousLink;
  privacy: DailyPrivacy;
};

export type MiniProgramShareCard = {
  share_id: string;
  share_format: ChannelShareFormat;
  channel: ChannelSource;
  campaign?: string;
  title: string;
  summary: string;
  path: string;
  qr_payload: string;
  privacy_note: string;
  safety_flags: string[];
};

export type ChannelShareCreateRequest = ShareCreateRequest & {
  share_format: ChannelShareFormat;
  channel: ChannelSource;
  campaign?: string;
  visitor_id?: string;
};

export type ChannelShareCreateResponse = ShareCreateResponse & {
  channel_share: MiniProgramShareCard;
};

export type ChannelGrowthEvent = {
  channel_event_id: string;
  event_type: ChannelGrowthEventType;
  channel: ChannelSource;
  campaign?: string;
  share_id?: string;
  visitor_id?: string;
  member_id?: string;
  created_at: string;
  is_duplicate: boolean;
  share_format?: ChannelShareFormat;
  metadata: Record<string, string | number | boolean>;
};

export type ChannelGrowthEventRequest = {
  event_type: ChannelGrowthEventType;
  channel: ChannelSource;
  campaign?: string;
  share_id?: string;
  visitor_id?: string;
  member_id?: string;
  share_format?: ChannelShareFormat;
  metadata?: Record<string, string | number | boolean>;
};

export type ChannelDashboardSummary = {
  total_channel_events: number;
  unique_visitors: number;
  by_channel: Record<ChannelSource, number>;
  by_event: Record<ChannelGrowthEventType, number>;
  by_share_format: Record<ChannelShareFormat, number>;
  report_intent_events: number;
  challenge_join_events: number;
  privacy: DailyPrivacy;
};

export type ChannelGrowthEventResponse = {
  event: ChannelGrowthEvent;
  dashboard_snapshot: ChannelDashboardSummary;
  privacy: DailyPrivacy;
};

export type ChannelDashboardResponse = {
  dashboard: ChannelDashboardSummary;
  privacy: DailyPrivacy;
};

export const miniProgramShareFormats = ["wechat_mini_card", "wechat_group_card", "mini_qr_landing"] as const;
export type MiniProgramShareFormat = (typeof miniProgramShareFormats)[number];

export const miniProgramSubscribeTemplateTypes = ["daily_stargarden_reminder", "challenge_progress_reminder"] as const;
export type MiniProgramSubscribeTemplateType = (typeof miniProgramSubscribeTemplateTypes)[number];

export const miniProgramReviewStatuses = ["draft", "materials_ready", "submitted", "approved", "rejected", "fallback_h5"] as const;
export type MiniProgramReviewStatus = (typeof miniProgramReviewStatuses)[number];

export const miniProgramReminderActions = ["daily_reminder_queued", "challenge_reminder_queued"] as const;
export type MiniProgramReminderAction = (typeof miniProgramReminderActions)[number];

export type MiniProgramReleaseGate = {
  version: "mini_program_v0.1";
  review_status: MiniProgramReviewStatus;
  rollout_percent: number;
  fallback_to_h5: boolean;
  allowed_channels: ChannelSource[];
  review_notes: string[];
};

export type WechatOpenIdBinding = {
  binding_id: string;
  openid_hash: string;
  visitor_id: string;
  member_id: string;
  linked_at: string;
  is_duplicate: boolean;
  privacy_note: string;
};

export type MiniProgramSession = {
  session_id: string;
  visitor_id: string;
  member_id: string;
  openid_hash: string;
  openid_binding_status: "new" | "reused";
  channel: ChannelSource;
  campaign?: string;
  created_at: string;
  expires_at: string;
  release_gate: MiniProgramReleaseGate;
  privacy_note: string;
};

export type MiniProgramLoginRequest = {
  code: string;
  visitor_id?: string;
  channel: ChannelSource;
  campaign?: string;
};

export type MiniProgramLoginResponse = {
  session: MiniProgramSession;
  binding: WechatOpenIdBinding;
  release_gate: MiniProgramReleaseGate;
  privacy: DailyPrivacy;
};

export type MiniProgramLinkMemberRequest = {
  visitor_id: string;
  member_id: string;
  openid_hash: string;
};

export type MiniProgramLinkMemberResponse = {
  binding: WechatOpenIdBinding;
  privacy: DailyPrivacy;
};

export type MiniProgramSharePayload = {
  share_id: string;
  share_format: MiniProgramShareFormat;
  channel: ChannelSource;
  campaign?: string;
  title: string;
  summary: string;
  path: string;
  qr_payload: string;
  review_copy: string;
  privacy_note: string;
  safety_flags: string[];
};

export type MiniProgramShareCreateRequest = ShareCreateRequest & {
  mini_program_share_format: MiniProgramShareFormat;
  channel: ChannelSource;
  campaign?: string;
  visitor_id?: string;
};

export type MiniProgramShareCreateResponse = ShareCreateResponse & {
  mini_program_share: MiniProgramSharePayload;
};

export type SubscribeTemplateConsent = {
  consent_id: string;
  member_id: string;
  template_type: MiniProgramSubscribeTemplateType;
  template_id: string;
  consent_granted: boolean;
  channel: ChannelSource;
  created_at: string;
  privacy_note: string;
};

export type MiniProgramSubscribeRequest = {
  member_id: string;
  template_type: MiniProgramSubscribeTemplateType;
  template_id: string;
  consent_granted: boolean;
  channel: ChannelSource;
};

export type MiniProgramSubscribeResponse = {
  consent: SubscribeTemplateConsent;
  privacy: DailyPrivacy;
};

export type MiniProgramReminderEvent = {
  reminder_event_id: string;
  member_id: string;
  template_type: MiniProgramSubscribeTemplateType;
  target_date?: string;
  action: MiniProgramReminderAction;
  created_at: string;
  metadata: Record<string, string | number | boolean>;
  privacy_note: string;
};

export type MiniProgramReminderEventRequest = {
  member_id: string;
  template_type: MiniProgramSubscribeTemplateType;
  target_date?: string;
  action: MiniProgramReminderAction;
  metadata?: Record<string, string | number | boolean>;
};

export type MiniProgramReminderEventResponse = {
  event: MiniProgramReminderEvent;
  privacy: DailyPrivacy;
};

export type MiniProgramReleaseGateResponse = {
  release_gate: MiniProgramReleaseGate;
  privacy: DailyPrivacy;
};
