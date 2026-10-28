CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id varchar(96) NOT NULL UNIQUE,
  display_name varchar(120) NOT NULL,
  phone_hash varchar(128),
  email_hash varchar(128),
  status varchar(32) NOT NULL DEFAULT 'active',
  privacy_version varchar(32) NOT NULL DEFAULT '2026-05-25',
  privacy_note text NOT NULL DEFAULT 'phone, email, and provider identities are stored as hashes.',
  upgraded_from_visitor_id varchar(96),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS anonymous_visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id varchar(96) NOT NULL UNIQUE,
  upgraded_member_id varchar(96),
  privacy_note text NOT NULL DEFAULT 'anonymous visitor id only; no raw birth data stored.',
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  upgraded_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS anonymous_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id varchar(96) NOT NULL UNIQUE,
  visitor_id varchar(96) NOT NULL UNIQUE,
  member_id varchar(96) NOT NULL,
  openid_placeholder varchar(96),
  linked_at timestamptz NOT NULL DEFAULT now(),
  privacy_note text NOT NULL DEFAULT 'anonymous visitor, member id, and openid placeholder are linked without sensitive birth data.'
);

CREATE TABLE IF NOT EXISTS identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id varchar(96) NOT NULL UNIQUE,
  member_id varchar(96) NOT NULL,
  provider varchar(32) NOT NULL,
  provider_user_hash varchar(128) NOT NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT identities_provider_user_unique UNIQUE (provider, provider_user_hash)
);

CREATE TABLE IF NOT EXISTS sms_verification_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id varchar(96) NOT NULL UNIQUE,
  phone_hash varchar(128) NOT NULL,
  code_hash varchar(128) NOT NULL,
  provider varchar(40) NOT NULL,
  template_id varchar(96) NOT NULL,
  purpose varchar(32) NOT NULL DEFAULT 'login',
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  delivery_status varchar(40) NOT NULL,
  provider_message_id varchar(120),
  privacy_note text NOT NULL DEFAULT 'raw phone number and verification code are never stored; only sha256 hashes are persisted.',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);

CREATE TABLE IF NOT EXISTS birth_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  birth_profile_id varchar(96) NOT NULL UNIQUE,
  member_id varchar(96),
  visitor_id varchar(96),
  calendar_type varchar(24) NOT NULL,
  birth_date_encrypted text NOT NULL,
  birth_time_encrypted text NOT NULL,
  location_encrypted text,
  timezone varchar(64) NOT NULL DEFAULT 'Asia/Shanghai',
  is_leap_month boolean NOT NULL DEFAULT false,
  true_solar_time_enabled boolean NOT NULL DEFAULT false,
  gender_rule varchar(40) NOT NULL,
  accuracy_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS charts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chart_id varchar(96) NOT NULL UNIQUE,
  birth_profile_id varchar(96) NOT NULL,
  rule_version_id varchar(96) NOT NULL,
  chart_json jsonb NOT NULL,
  normalized_birth jsonb NOT NULL,
  trace_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chart_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chart_id varchar(96) NOT NULL UNIQUE,
  member_id varchar(96),
  visitor_id varchar(96),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS interpretations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interpretation_id varchar(96) NOT NULL UNIQUE,
  chart_id varchar(96) NOT NULL,
  palace_id varchar(64) NOT NULL,
  mode varchar(32) NOT NULL,
  rule_version_id varchar(96) NOT NULL,
  prompt_version varchar(64),
  content_json jsonb NOT NULL,
  trace_json jsonb NOT NULL,
  safety_flags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id varchar(96) NOT NULL UNIQUE,
  chart_id varchar(96),
  member_id varchar(96),
  tier varchar(32) NOT NULL,
  status varchar(32) NOT NULL,
  current_version integer NOT NULL DEFAULT 1,
  access_policy varchar(32) NOT NULL DEFAULT 'private',
  share_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_version_id varchar(96) NOT NULL UNIQUE,
  report_id varchar(96) NOT NULL,
  version integer NOT NULL,
  rule_version_id varchar(96) NOT NULL,
  prompt_version varchar(64),
  generated_at timestamptz NOT NULL DEFAULT now(),
  content_json jsonb NOT NULL,
  trace_json jsonb NOT NULL,
  review_status varchar(32) NOT NULL DEFAULT 'pending',
  CONSTRAINT report_versions_report_version_unique UNIQUE (report_id, version)
);

CREATE TABLE IF NOT EXISTS report_generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id varchar(96) NOT NULL UNIQUE,
  member_id varchar(96),
  visitor_id varchar(96),
  report_id varchar(96),
  status varchar(32) NOT NULL,
  attempt_count integer NOT NULL,
  max_attempts integer NOT NULL,
  request_digest varchar(128) NOT NULL,
  request_summary_json jsonb NOT NULL,
  last_error_code varchar(96),
  last_error_message text,
  support_ticket_id varchar(96),
  audit_trail_json jsonb NOT NULL,
  privacy_note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS export_previews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_preview_id varchar(96) NOT NULL UNIQUE,
  report_id varchar(96) NOT NULL,
  format varchar(16) NOT NULL,
  preview_url text NOT NULL,
  storage_json jsonb NOT NULL,
  review_status varchar(32) NOT NULL,
  order_created boolean NOT NULL DEFAULT false,
  payment_status varchar(32) NOT NULL,
  privacy_note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id varchar(96) NOT NULL UNIQUE,
  source_type varchar(40) NOT NULL,
  source_id varchar(96) NOT NULL,
  member_id varchar(96),
  visitor_id varchar(96),
  snapshot_json jsonb NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id varchar(96) NOT NULL UNIQUE,
  member_id varchar(96) NOT NULL,
  report_id varchar(96) NOT NULL,
  package_id varchar(40) NOT NULL,
  tier_id varchar(40) NOT NULL,
  report_type varchar(40) NOT NULL,
  amount_cents integer NOT NULL,
  currency varchar(8) NOT NULL DEFAULT 'cny',
  status varchar(32) NOT NULL,
  payment_provider varchar(40) NOT NULL,
  checkout_session_id varchar(128),
  refunded_amount_cents integer,
  refund_reason text,
  compliance_json jsonb NOT NULL,
  privacy_json jsonb NOT NULL,
  attribution_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  fulfilled_at timestamptz,
  refunded_at timestamptz
);

CREATE TABLE IF NOT EXISTS checkout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_session_id varchar(128) NOT NULL UNIQUE,
  order_id varchar(96) NOT NULL,
  provider varchar(40) NOT NULL,
  provider_mode varchar(32) NOT NULL,
  checkout_url text NOT NULL,
  status varchar(32) NOT NULL,
  sandbox_webhook_json jsonb,
  provider_requirements_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_event_id varchar(128) NOT NULL UNIQUE,
  provider varchar(40) NOT NULL,
  provider_event_id varchar(128) NOT NULL,
  event_type varchar(96) NOT NULL,
  order_id varchar(96),
  checkout_session_id varchar(128),
  signature_verified boolean NOT NULL DEFAULT false,
  is_duplicate boolean NOT NULL DEFAULT false,
  raw_payload_digest varchar(128) NOT NULL,
  order_snapshot_json jsonb,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entitlement_id varchar(96) NOT NULL UNIQUE,
  member_id varchar(96) NOT NULL,
  report_id varchar(96) NOT NULL,
  source_order_id varchar(96) NOT NULL,
  tier_id varchar(32),
  access_level varchar(40),
  benefits text[] NOT NULL DEFAULT '{}',
  status varchar(32) NOT NULL DEFAULT 'active',
  credits integer NOT NULL DEFAULT 0,
  has_access boolean NOT NULL DEFAULT true,
  can_read_report boolean NOT NULL DEFAULT true,
  favorite_enabled boolean NOT NULL DEFAULT false,
  privacy_note text NOT NULL,
  report_snapshot_json jsonb,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entitlements_member_report_unique UNIQUE (member_id, report_id)
);

CREATE TABLE IF NOT EXISTS refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id varchar(96) NOT NULL UNIQUE,
  order_id varchar(96) NOT NULL,
  provider varchar(40) NOT NULL,
  provider_refund_id varchar(128),
  amount_cents integer NOT NULL,
  status varchar(32) NOT NULL,
  reason text NOT NULL,
  requested_by varchar(96) NOT NULL,
  provider_refund_request_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provider_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id varchar(96) NOT NULL UNIQUE,
  provider varchar(40) NOT NULL,
  period_start varchar(32) NOT NULL,
  period_end varchar(32) NOT NULL,
  imported_by varchar(96) NOT NULL,
  row_count integer NOT NULL,
  rows_json jsonb NOT NULL,
  privacy_note text NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_statements_provider_period ON provider_statements(provider, period_start, period_end);

CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id varchar(96) NOT NULL UNIQUE,
  member_id varchar(96) NOT NULL,
  order_id varchar(96),
  report_id varchar(96),
  category varchar(40) NOT NULL,
  priority varchar(20) NOT NULL,
  status varchar(32) NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  assignee varchar(96),
  consent_json jsonb NOT NULL DEFAULT '{"agreed":false,"no_sensitive_birth_data":true}'::jsonb,
  audit_trail_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analytics_event_id varchar(96) NOT NULL UNIQUE,
  type varchar(64) NOT NULL,
  visitor_id varchar(96),
  member_id varchar(96),
  chart_id varchar(96),
  report_id varchar(96),
  order_id varchar(96),
  channel_code varchar(96),
  metadata_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_log_id varchar(96) NOT NULL UNIQUE,
  actor_id varchar(96) NOT NULL,
  actor_role varchar(40) NOT NULL,
  action varchar(96) NOT NULL,
  target_type varchar(64) NOT NULL,
  target_id varchar(96),
  metadata_json jsonb NOT NULL,
  ip_hash varchar(128),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_generation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id varchar(96) NOT NULL UNIQUE,
  provider varchar(40) NOT NULL,
  model varchar(80) NOT NULL,
  prompt_version varchar(64) NOT NULL,
  chart_id varchar(96),
  report_id varchar(96),
  input_digest varchar(128) NOT NULL,
  output_digest varchar(128),
  status varchar(32) NOT NULL,
  fallback_reason varchar(80),
  safety_flags text[] NOT NULL DEFAULT '{}',
  privacy_note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS follow_up_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quota_key varchar(160) NOT NULL UNIQUE,
  subject_id varchar(96) NOT NULL,
  plan varchar(16) NOT NULL,
  window_start date NOT NULL,
  quota_limit integer NOT NULL,
  used integer NOT NULL DEFAULT 0,
  privacy_note text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_review_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id varchar(96) NOT NULL UNIQUE,
  report_id varchar(96) NOT NULL,
  source_type varchar(64) NOT NULL,
  source_id varchar(96) NOT NULL,
  status varchar(32) NOT NULL,
  blocked_terms text[] NOT NULL DEFAULT '{}',
  privacy_flags text[] NOT NULL DEFAULT '{}',
  safety_flags text[] NOT NULL DEFAULT '{}',
  reviewer_id varchar(96),
  notes text[] NOT NULL DEFAULT '{}',
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rule_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_version_id varchar(96) NOT NULL UNIQUE,
  profile_id varchar(96) NOT NULL,
  label varchar(120) NOT NULL,
  status varchar(32) NOT NULL,
  active_default boolean NOT NULL DEFAULT false,
  config_json jsonb NOT NULL,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id varchar(96) NOT NULL UNIQUE,
  role varchar(40) NOT NULL,
  display_name varchar(120) NOT NULL,
  mfa_enabled boolean NOT NULL DEFAULT false,
  status varchar(32) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE IF NOT EXISTS ops_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ops_action_id varchar(96) NOT NULL UNIQUE,
  actor_id varchar(96) NOT NULL,
  action varchar(96) NOT NULL,
  target_type varchar(64) NOT NULL,
  target_id varchar(96),
  requires_second_confirm boolean NOT NULL DEFAULT false,
  confirmed_at timestamptz,
  metadata_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS channel_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribution_id varchar(96) NOT NULL UNIQUE,
  visitor_id varchar(96) NOT NULL,
  member_id varchar(96),
  channel varchar(64) NOT NULL,
  campaign varchar(96),
  share_id varchar(96),
  referrer_hash varchar(128),
  disabled_at timestamptz,
  metadata_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wechat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id varchar(96) NOT NULL UNIQUE,
  member_id varchar(96) NOT NULL,
  visitor_id varchar(96) NOT NULL,
  openid_hash varchar(128) NOT NULL,
  unionid_hash varchar(128),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wechat_sessions_openid_member_unique UNIQUE (openid_hash, member_id)
);

CREATE TABLE IF NOT EXISTS wechat_openid_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  binding_id varchar(96) NOT NULL UNIQUE,
  openid_hash varchar(128) NOT NULL UNIQUE,
  visitor_id varchar(96) NOT NULL,
  member_id varchar(96) NOT NULL,
  linked_at timestamptz NOT NULL DEFAULT now(),
  is_duplicate boolean NOT NULL DEFAULT false,
  privacy_note text NOT NULL
);

CREATE TABLE IF NOT EXISTS data_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deletion_request_id varchar(96) NOT NULL UNIQUE,
  member_id varchar(96),
  visitor_id varchar(96),
  ticket_id varchar(96),
  status varchar(32) NOT NULL,
  scope varchar(64) NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  audit_log_id varchar(96),
  audit_trail_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  privacy_note text NOT NULL DEFAULT 'deletion workflow stores identifiers and audit metadata only.'
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS privacy_note text NOT NULL DEFAULT 'phone, email, and provider identities are stored as hashes.';

ALTER TABLE anonymous_visitors
  ADD COLUMN IF NOT EXISTS privacy_note text NOT NULL DEFAULT 'anonymous visitor id only; no raw birth data stored.';

ALTER TABLE anonymous_links
  ADD COLUMN IF NOT EXISTS openid_placeholder varchar(96),
  ADD COLUMN IF NOT EXISTS privacy_note text NOT NULL DEFAULT 'anonymous visitor, member id, and openid placeholder are linked without sensitive birth data.';

ALTER TABLE sms_verification_challenges
  ADD COLUMN IF NOT EXISTS provider_message_id varchar(120),
  ADD COLUMN IF NOT EXISTS privacy_note text NOT NULL DEFAULT 'raw phone number and verification code are never stored; only sha256 hashes are persisted.';

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS consent_json jsonb NOT NULL DEFAULT '{"agreed":false,"no_sensitive_birth_data":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS audit_trail_json jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE data_deletion_requests
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS audit_trail_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS privacy_note text NOT NULL DEFAULT 'deletion workflow stores identifiers and audit metadata only.';

CREATE INDEX IF NOT EXISTS idx_users_phone_hash ON users (phone_hash);
CREATE INDEX IF NOT EXISTS idx_users_email_hash ON users (email_hash);
CREATE INDEX IF NOT EXISTS idx_anonymous_visitors_upgraded_member ON anonymous_visitors (upgraded_member_id);
CREATE INDEX IF NOT EXISTS idx_anonymous_links_member ON anonymous_links (member_id);
CREATE INDEX IF NOT EXISTS idx_identities_member ON identities (member_id);
CREATE INDEX IF NOT EXISTS idx_sms_verification_challenges_phone_expires ON sms_verification_challenges (phone_hash, expires_at);
CREATE INDEX IF NOT EXISTS idx_sms_verification_challenges_created_at ON sms_verification_challenges (created_at);
CREATE INDEX IF NOT EXISTS idx_birth_profiles_member ON birth_profiles (member_id);
CREATE INDEX IF NOT EXISTS idx_birth_profiles_visitor ON birth_profiles (visitor_id);
CREATE INDEX IF NOT EXISTS idx_charts_birth_profile ON charts (birth_profile_id);
CREATE INDEX IF NOT EXISTS idx_charts_rule_version ON charts (rule_version_id);
CREATE INDEX IF NOT EXISTS idx_chart_owners_member ON chart_owners (member_id);
CREATE INDEX IF NOT EXISTS idx_chart_owners_visitor ON chart_owners (visitor_id);
CREATE INDEX IF NOT EXISTS idx_interpretations_chart ON interpretations (chart_id);
CREATE INDEX IF NOT EXISTS idx_reports_member ON reports (member_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status);
CREATE INDEX IF NOT EXISTS idx_report_versions_rule ON report_versions (rule_version_id);
CREATE INDEX IF NOT EXISTS idx_report_generation_jobs_member ON report_generation_jobs (member_id);
CREATE INDEX IF NOT EXISTS idx_report_generation_jobs_visitor ON report_generation_jobs (visitor_id);
CREATE INDEX IF NOT EXISTS idx_report_generation_jobs_report ON report_generation_jobs (report_id);
CREATE INDEX IF NOT EXISTS idx_report_generation_jobs_status ON report_generation_jobs (status);
CREATE INDEX IF NOT EXISTS idx_export_previews_report ON export_previews (report_id);
CREATE INDEX IF NOT EXISTS idx_export_previews_review ON export_previews (review_status);
CREATE INDEX IF NOT EXISTS idx_export_previews_expires ON export_previews (expires_at);
CREATE INDEX IF NOT EXISTS idx_shares_source ON shares (source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_orders_member_status ON orders (member_id, status);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_order ON checkout_sessions (order_id);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_status ON checkout_sessions (status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_events_provider_event ON payment_events (provider, provider_event_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_order ON payment_events (order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds (order_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_member ON support_tickets (member_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status_priority ON support_tickets (status, priority);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_time ON analytics_events (type, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_channel ON analytics_events (channel_code);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_time ON audit_logs (actor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_generation_logs_chart ON ai_generation_logs (chart_id);
CREATE INDEX IF NOT EXISTS idx_ai_generation_logs_report ON ai_generation_logs (report_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_quotas_subject_window ON follow_up_quotas (subject_id, window_start);
CREATE INDEX IF NOT EXISTS idx_follow_up_quotas_plan ON follow_up_quotas (plan);
CREATE INDEX IF NOT EXISTS idx_content_review_records_report ON content_review_records (report_id);
CREATE INDEX IF NOT EXISTS idx_content_review_records_source ON content_review_records (source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_rule_versions_status ON rule_versions (status);
CREATE INDEX IF NOT EXISTS idx_rule_versions_active_default ON rule_versions (active_default, updated_at);
CREATE INDEX IF NOT EXISTS idx_admin_accounts_role_status ON admin_accounts (role, status);
CREATE INDEX IF NOT EXISTS idx_ops_actions_actor_time ON ops_actions (actor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_channel_attributions_channel_campaign ON channel_attributions (channel, campaign);
CREATE INDEX IF NOT EXISTS idx_wechat_sessions_member ON wechat_sessions (member_id);
CREATE INDEX IF NOT EXISTS idx_wechat_openid_bindings_member ON wechat_openid_bindings (member_id);
CREATE INDEX IF NOT EXISTS idx_wechat_openid_bindings_visitor ON wechat_openid_bindings (visitor_id);
CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_status ON data_deletion_requests (status);
