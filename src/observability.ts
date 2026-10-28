import { createHash, createHmac } from "node:crypto";

const observabilityRequiredEnv = ["OBS_LOG_SINK", "OBS_METRICS_ENDPOINT", "OBS_ALERT_WEBHOOK_URL", "OBS_ALERT_WEBHOOK_SECRET", "OBS_TRACE_EXPORTER", "OBS_BACKUP_HEALTHCHECK_URL"] as const;

export type ObservabilityReadiness = {
  ready: boolean;
  log_sink_configured: boolean;
  metrics_configured: boolean;
  alert_webhook_configured: boolean;
  alert_webhook_secret_configured: boolean;
  trace_exporter_configured: boolean;
  backup_healthcheck_configured: boolean;
  requiredEnv: typeof observabilityRequiredEnv;
  blockers: string[];
};

export type StructuredLogInput = {
  request_id: string;
  route: string;
  status: number;
  error_code?: string;
  member_id?: string;
  visitor_id?: string;
  message?: string;
};

export type StructuredLog = {
  request_id: string;
  route: string;
  status: number;
  error_code?: string;
  member_id?: string;
  visitor_id?: string;
  message?: string;
  privacy: {
    sensitive_fields_redacted: true;
    raw_member_id_hidden: true;
    raw_visitor_id_hidden: true;
  };
};

export type OperationalAlertInput = {
  five_minute_5xx_rate: number;
  payment_webhook_signature_failures: number;
  entitlement_gap_count: number;
  unauthorized_ops_attempts: number;
  backup_last_success_minutes_ago: number;
  sample_context?: string;
};

export type OperationalAlert = {
  code:
    | "FIVE_MINUTE_5XX_RATE_HIGH"
    | "PAYMENT_WEBHOOK_SIGNATURE_FAILURE_SPIKE"
    | "ENTITLEMENT_GAP_DETECTED"
    | "OPS_UNAUTHORIZED_ACCESS_SPIKE"
    | "BACKUP_HEALTHCHECK_STALE";
  severity: "warning" | "critical";
  metric: keyof OperationalAlertInput;
  threshold: number;
  actual: number;
  message: string;
  context?: string;
};

export function resolveObservabilityReadiness(): ObservabilityReadiness {
  const logSink = Boolean(process.env.OBS_LOG_SINK?.trim());
  const metrics = Boolean(process.env.OBS_METRICS_ENDPOINT?.trim());
  const alertWebhook = Boolean(process.env.OBS_ALERT_WEBHOOK_URL?.trim());
  const alertWebhookSecret = Boolean(process.env.OBS_ALERT_WEBHOOK_SECRET?.trim());
  const traceExporter = Boolean(process.env.OBS_TRACE_EXPORTER?.trim());
  const backupHealthcheck = Boolean(process.env.OBS_BACKUP_HEALTHCHECK_URL?.trim());
  const blockers = [
    logSink ? undefined : "Configure structured log sink before production launch.",
    metrics ? undefined : "Configure metrics endpoint before production launch.",
    alertWebhook ? undefined : "Configure alert webhook before production launch.",
    alertWebhookSecret ? undefined : "Configure alert webhook signing secret before production launch.",
    traceExporter ? undefined : "Configure trace exporter before production launch.",
    backupHealthcheck ? undefined : "Configure backup healthcheck before production launch."
  ].filter((item): item is string => Boolean(item));

  return {
    ready: blockers.length === 0,
    log_sink_configured: logSink,
    metrics_configured: metrics,
    alert_webhook_configured: alertWebhook,
    alert_webhook_secret_configured: alertWebhookSecret,
    trace_exporter_configured: traceExporter,
    backup_healthcheck_configured: backupHealthcheck,
    requiredEnv: observabilityRequiredEnv,
    blockers
  };
}

export function formatStructuredLog(input: StructuredLogInput): StructuredLog {
  return {
    request_id: sanitizeLogText(input.request_id),
    route: sanitizeRoute(input.route),
    status: normalizeStatus(input.status),
    error_code: input.error_code ? sanitizeLogText(input.error_code) : undefined,
    member_id: input.member_id ? hashIdentifier(input.member_id) : undefined,
    visitor_id: input.visitor_id ? hashIdentifier(input.visitor_id) : undefined,
    message: input.message ? redactSensitiveLogText(input.message) : undefined,
    privacy: {
      sensitive_fields_redacted: true,
      raw_member_id_hidden: true,
      raw_visitor_id_hidden: true
    }
  };
}

/** Send one privacy-redacted log event to the configured sink. */
export async function emitStructuredLog(input: StructuredLogInput): Promise<void> {
  const sink = process.env.OBS_LOG_SINK?.trim();
  if (!sink) return;
  const payload = formatStructuredLog(input);
  await fetch(sink, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(3000)
  });
}

export function evaluateOperationalAlerts(input: OperationalAlertInput): OperationalAlert[] {
  const context = input.sample_context ? redactSensitiveLogText(input.sample_context) : undefined;
  return [
    createAlert(input.five_minute_5xx_rate > 0.02, "FIVE_MINUTE_5XX_RATE_HIGH", "critical", "five_minute_5xx_rate", 0.02, input.five_minute_5xx_rate, "5xx rate exceeded production threshold.", context),
    createAlert(input.payment_webhook_signature_failures >= 3, "PAYMENT_WEBHOOK_SIGNATURE_FAILURE_SPIKE", "critical", "payment_webhook_signature_failures", 3, input.payment_webhook_signature_failures, "Payment webhook signature failures spiked.", context),
    createAlert(input.entitlement_gap_count > 0, "ENTITLEMENT_GAP_DETECTED", "critical", "entitlement_gap_count", 0, input.entitlement_gap_count, "Paid or fulfilled orders have entitlement gaps.", context),
    createAlert(input.unauthorized_ops_attempts >= 3, "OPS_UNAUTHORIZED_ACCESS_SPIKE", "warning", "unauthorized_ops_attempts", 3, input.unauthorized_ops_attempts, "Unauthorized ops access attempts exceeded threshold.", context),
    createAlert(input.backup_last_success_minutes_ago > 120, "BACKUP_HEALTHCHECK_STALE", "critical", "backup_last_success_minutes_ago", 120, input.backup_last_success_minutes_ago, "Backup healthcheck is stale.", context)
  ].filter((alert): alert is OperationalAlert => Boolean(alert));
}

/** Dispatch evaluated alerts without exposing secrets in the payload. */
export async function dispatchOperationalAlerts(alerts: readonly OperationalAlert[]): Promise<void> {
  const endpoint = process.env.OBS_ALERT_WEBHOOK_URL?.trim();
  const secret = process.env.OBS_ALERT_WEBHOOK_SECRET?.trim();
  if (!endpoint || !secret || alerts.length === 0) return;
  const body = JSON.stringify({ alerts, emitted_at: new Date().toISOString() });
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", "x-observability-signature": signature },
    body,
    signal: AbortSignal.timeout(3000)
  });
}

function createAlert(
  active: boolean,
  code: OperationalAlert["code"],
  severity: OperationalAlert["severity"],
  metric: keyof OperationalAlertInput,
  threshold: number,
  actual: number,
  message: string,
  context?: string
): OperationalAlert | undefined {
  if (!active) return undefined;
  return {
    code,
    severity,
    metric,
    threshold,
    actual,
    message,
    context
  };
}

function normalizeStatus(status: number): number {
  return Number.isFinite(status) ? Math.trunc(status) : 500;
}

function sanitizeRoute(route: string): string {
  const urlLike = String(route || "/").split("?")[0] || "/";
  return sanitizeLogText(urlLike.replace(/\/{2,}/g, "/"));
}

function sanitizeLogText(text: string): string {
  return redactSensitiveLogText(String(text ?? "").replace(/\s+/g, " ").trim());
}

function redactSensitiveLogText(text: string): string {
  return String(text ?? "")
    .replace(/data:image\/[a-zA-Z+.-]+;base64,[A-Za-z0-9+/=]+/g, "[image_payload_redacted]")
    .replace(/\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/g, "[birth_date_redacted]")
    .replace(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g, "[birth_time_redacted]")
    .replace(/\b(?:Shanghai|Beijing|Guangzhou|Shenzhen|Chengdu|Hangzhou|Nanjing|Wuhan)\b|(?:北京|上海|广州|深圳|成都|杭州|南京|武汉)/gi, "[location_redacted]")
    .replace(/\b1[3-9]\d{9}\b/g, "[phone_redacted]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email_redacted]")
    .replace(/(?:webhook_secret|secret|token|authorization)=?[^,\s]*/gi, "[credential_redacted]");
}

function hashIdentifier(value: string): string {
  return `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
}
