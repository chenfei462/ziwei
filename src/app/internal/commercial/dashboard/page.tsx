import { headers } from "next/headers.js";
import { CommercialOpsPanel } from "../../../../components/phase10/CommercialOpsPanel.js";
import { getLaunchOperationsDashboard, getOpsPaymentReconciliation } from "../../../../phase10/launchOps.js";

export const dynamic = "force-dynamic";

export default async function InternalCommercialDashboardPage() {
  const headerStore = await headers();
  const auth = {
    token: headerStore.get("x-admin-token") ?? "",
    role: (headerStore.get("x-admin-role") ?? "support_agent") as "ops_admin" | "support_agent" | "content_reviewer",
    actor_id: headerStore.get("x-admin-actor") ?? "internal_commercial_dashboard_page",
    mfa_code: headerStore.get("x-admin-mfa-code") ?? ""
  };
  const dashboard = getLaunchOperationsDashboard({ auth });
  const financeAccessGranted = auth.role === "ops_admin" || auth.role === "support_agent";
  const reconciliation = financeAccessGranted ? getOpsPaymentReconciliation({ auth }) : undefined;
  const readinessCards = buildReadinessCards(dashboard.launch_config);

  return (
    <main className="phase9-page">
      <section className="workspace-header">
        <div>
          <p className="eyebrow">Internal Commercial Dashboard</p>
          <h1>Commercial Operations Dashboard</h1>
        </div>
        <div className="status-strip" aria-label="commercial dashboard status">
          <span>orders:{dashboard.orders.total_orders}</span>
          <span>refunds:{dashboard.orders.refunded_manual_orders + dashboard.orders.partially_refunded_orders}</span>
          <span>finance:{financeAccessGranted ? "granted" : "restricted"}</span>
          <span>gate:{dashboard.launch_config.public_status}</span>
        </div>
      </section>
      <section className="phase9-layout">
        <CommercialOpsPanel dashboard={dashboard} financeAccessGranted={financeAccessGranted} canManagePaymentAlerts={auth.role === "ops_admin"} reconciliation={reconciliation} />
        <aside className="phase9-panel">
          <div className="panel-title-row">
            <h2>Launch Gate Checklist</h2>
          </div>
          <div className="commercial-ops-readiness-grid">
            {readinessCards.map((card) => (
              <article className="commercial-ops-readiness-card" key={card.label}>
                <strong>{card.label}</strong>
                <div className="phase10-result">
                  <span>{card.ready ? "ready" : "blocked"}</span>
                  <span>{card.provider}</span>
                </div>
                <small>{card.detail}</small>
                {card.blockers.length ? <small>{card.blockers.join(" ")}</small> : null}
                <small>{card.requiredEnv.join(" · ")}</small>
              </article>
            ))}
          </div>
          <div className="commercial-ops-subsection">
            <div className="panel-title-row">
              <h3>Launch Notes</h3>
            </div>
            <ul className="phase9-scope-list">
              <li>Production traffic is allowed only when database, birth data encryption, login, rate limit, export storage, observability, and operator MFA are ready.</li>
              <li>Finance reconciliation is only visible to ops_admin and support_agent roles through server-side authorization.</li>
              <li>Webhooks, refunds, entitlement recovery, and audit writes remain on the service side even when the UI hides sensitive details.</li>
              <li>External payment, SMS, WeChat, and object storage credentials still need to be filled in by operations before production enablement.</li>
            </ul>
          </div>
        </aside>
      </section>
    </main>
  );
}

function buildReadinessCards(config: {
  database?: {
    ready: boolean;
    mode: "postgresql" | "not_configured";
    requiredTables: string[];
    migrationPath: string;
    blockers: string[];
  };
  birth_data_encryption?: {
    ready: boolean;
    algorithm: "aes-256-gcm";
    requiredEnv: readonly ["ZIWEI_BIRTH_DATA_ENCRYPTION_KEY"];
    blockers: string[];
  };
  login?: {
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
  wechat_share?: {
    ready: boolean;
    requiredEnv: string[];
    blockers: string[];
    jsApiList: ["updateAppMessageShareData", "updateTimelineShareData"];
    manualVerification: string[];
  };
  ops_security?: {
    mfa_enabled: boolean;
    mfa_configured: boolean;
    requiredEnv: string[];
    blockers: string[];
  };
  rate_limit?: {
    provider: "memory" | "redis_rest";
    ready: boolean;
    production_required: boolean;
    requiredEnv: ["ZIWEI_RATE_LIMIT_REDIS_REST_URL", "ZIWEI_RATE_LIMIT_REDIS_REST_TOKEN"];
    blockers: string[];
  };
  export_storage?: {
    provider: "local_preview" | "s3_compatible";
    ready: boolean;
    production_required: boolean;
    bucket?: string;
    endpoint_configured: boolean;
    public_base_url_configured: boolean;
    requiredEnv: readonly [
      "ZIWEI_EXPORT_STORAGE_ENDPOINT",
      "ZIWEI_EXPORT_STORAGE_BUCKET",
      "ZIWEI_EXPORT_STORAGE_ACCESS_KEY_ID",
      "ZIWEI_EXPORT_STORAGE_SECRET_ACCESS_KEY",
      "ZIWEI_EXPORT_STORAGE_PUBLIC_BASE_URL"
    ];
    blockers: string[];
  };
  observability?: {
    ready: boolean;
    log_sink_configured: boolean;
    metrics_configured: boolean;
    alert_webhook_configured: boolean;
    alert_webhook_secret_configured: boolean;
    trace_exporter_configured: boolean;
    backup_healthcheck_configured: boolean;
    requiredEnv: readonly ["OBS_LOG_SINK", "OBS_METRICS_ENDPOINT", "OBS_ALERT_WEBHOOK_URL", "OBS_ALERT_WEBHOOK_SECRET", "OBS_TRACE_EXPORTER", "OBS_BACKUP_HEALTHCHECK_URL"];
    blockers: string[];
  };
}) {
  return [
    {
      label: "Database",
      provider: config.database?.mode ?? "not_configured",
      ready: Boolean(config.database?.ready),
      detail: `Migration path: ${config.database?.migrationPath ?? "prisma/migrations/20260525000100_china_market_delivery/migration.sql"}`,
      blockers: config.database?.blockers ?? [],
      requiredEnv: ["DATABASE_URL", "DIRECT_DATABASE_URL"]
    },
    {
      label: "Birth Data Encryption",
      provider: config.birth_data_encryption?.algorithm ?? "aes-256-gcm",
      ready: Boolean(config.birth_data_encryption?.ready),
      detail: "Birth date, time, and location fields are AES-256-GCM encrypted in production.",
      blockers: config.birth_data_encryption?.blockers ?? [],
      requiredEnv: ["ZIWEI_BIRTH_DATA_ENCRYPTION_KEY"]
    },
    {
      label: "Login Providers",
      provider: config.login?.providers.sms.provider ?? "unconfigured",
      ready: Boolean(config.login?.ready),
      detail: `SMS: ${config.login?.providers.sms.ready ? "ready" : "blocked"} · WeChat: ${config.login?.providers.wechat_web.ready ? "ready" : "blocked"} · Session: ${config.login?.session.secretConfigured ? "ready" : "blocked"}`,
      blockers: config.login?.blockers ?? [],
      requiredEnv: [
        "SMS_PROVIDER",
        "SMS_ACCESS_KEY",
        "SMS_TEMPLATE_ID",
        "SMS_HTTP_ENDPOINT",
        "SMS_HTTP_SIGNING_SECRET",
        "WECHAT_APP_ID",
        "WECHAT_APP_SECRET",
        "SESSION_SECRET"
      ]
    },
    {
      label: "WeChat Share",
      provider: config.wechat_share?.jsApiList.join(" · ") ?? "unconfigured",
      ready: Boolean(config.wechat_share?.ready),
      detail: `Manual verification: ${config.wechat_share?.manualVerification.length ?? 0} checks`,
      blockers: config.wechat_share?.blockers ?? [],
      requiredEnv: config.wechat_share?.requiredEnv ?? ["WECHAT_JS_SDK_APP_ID", "WECHAT_JS_SDK_TICKET", "NEXT_PUBLIC_SITE_URL", "WECHAT_JS_SDK_ENABLED"]
    },
    {
      label: "Ops Security",
      provider: config.ops_security?.mfa_enabled ? "mfa_enabled" : "mfa_disabled",
      ready: Boolean(config.ops_security?.mfa_enabled && config.ops_security?.mfa_configured),
      detail: "Operator access is gated by the admin token and a second factor when enabled.",
      blockers: config.ops_security?.blockers ?? [],
      requiredEnv: ["PHASE10_OPS_MFA_ENABLED", "PHASE10_OPS_MFA_CODE"]
    },
    {
      label: "Rate Limit",
      provider: config.rate_limit?.provider ?? "memory",
      ready: Boolean(config.rate_limit?.ready),
      detail: `Production required: ${config.rate_limit?.production_required ? "yes" : "no"}`,
      blockers: config.rate_limit?.blockers ?? [],
      requiredEnv: ["ZIWEI_RATE_LIMIT_REDIS_REST_URL", "ZIWEI_RATE_LIMIT_REDIS_REST_TOKEN"]
    },
    {
      label: "Export Storage",
      provider: config.export_storage?.provider ?? "local_preview",
      ready: Boolean(config.export_storage?.ready),
      detail: `Bucket: ${config.export_storage?.bucket ?? "not configured"}`,
      blockers: config.export_storage?.blockers ?? [],
      requiredEnv: [
        "ZIWEI_EXPORT_STORAGE_ENDPOINT",
        "ZIWEI_EXPORT_STORAGE_BUCKET",
        "ZIWEI_EXPORT_STORAGE_ACCESS_KEY_ID",
        "ZIWEI_EXPORT_STORAGE_SECRET_ACCESS_KEY",
        "ZIWEI_EXPORT_STORAGE_PUBLIC_BASE_URL"
      ]
    },
    {
      label: "Observability",
      provider: config.observability?.ready ? "ready" : "blocked",
      ready: Boolean(config.observability?.ready),
      detail: "Logs, metrics, alerts, traces, and backup health checks must all be wired before public launch.",
      blockers: config.observability?.blockers ?? [],
      requiredEnv: ["OBS_LOG_SINK", "OBS_METRICS_ENDPOINT", "OBS_ALERT_WEBHOOK_URL", "OBS_ALERT_WEBHOOK_SECRET", "OBS_TRACE_EXPORTER", "OBS_BACKUP_HEALTHCHECK_URL"]
    }
  ];
}
