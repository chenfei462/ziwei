import { describe, expect, test } from "vitest";
import { evaluateOperationalAlerts, formatStructuredLog, resolveObservabilityReadiness, emitStructuredLog, dispatchOperationalAlerts } from "../src/observability.js";

describe("production observability readiness", () => {
  test("reports blockers until logs, metrics, traces, alerts, and backup checks are configured", () => {
    const previousLogSink = process.env.OBS_LOG_SINK;
    const previousMetrics = process.env.OBS_METRICS_ENDPOINT;
    const previousAlertWebhook = process.env.OBS_ALERT_WEBHOOK_URL;
    const previousAlertWebhookSecret = process.env.OBS_ALERT_WEBHOOK_SECRET;
    const previousTrace = process.env.OBS_TRACE_EXPORTER;
    const previousBackup = process.env.OBS_BACKUP_HEALTHCHECK_URL;
    delete process.env.OBS_LOG_SINK;
    delete process.env.OBS_METRICS_ENDPOINT;
    delete process.env.OBS_ALERT_WEBHOOK_URL;
    delete process.env.OBS_ALERT_WEBHOOK_SECRET;
    delete process.env.OBS_TRACE_EXPORTER;
    delete process.env.OBS_BACKUP_HEALTHCHECK_URL;
    try {
      const readiness = resolveObservabilityReadiness();

      expect(readiness).toMatchObject({
        ready: false,
        log_sink_configured: false,
        metrics_configured: false,
        alert_webhook_configured: false,
        alert_webhook_secret_configured: false,
        trace_exporter_configured: false,
        backup_healthcheck_configured: false
      });
      expect(readiness.requiredEnv).toEqual(["OBS_LOG_SINK", "OBS_METRICS_ENDPOINT", "OBS_ALERT_WEBHOOK_URL", "OBS_ALERT_WEBHOOK_SECRET", "OBS_TRACE_EXPORTER", "OBS_BACKUP_HEALTHCHECK_URL"]);
      expect(readiness.blockers).toEqual(expect.arrayContaining(["Configure structured log sink before production launch."]));
    } finally {
      restoreEnv("OBS_LOG_SINK", previousLogSink);
      restoreEnv("OBS_METRICS_ENDPOINT", previousMetrics);
      restoreEnv("OBS_ALERT_WEBHOOK_URL", previousAlertWebhook);
      restoreEnv("OBS_ALERT_WEBHOOK_SECRET", previousAlertWebhookSecret);
      restoreEnv("OBS_TRACE_EXPORTER", previousTrace);
      restoreEnv("OBS_BACKUP_HEALTHCHECK_URL", previousBackup);
    }
  });

  test("formats structured logs with request context and redacts sensitive fields", () => {
    const log = formatStructuredLog({
      request_id: "req_test",
      route: "/api/report/export-preview",
      status: 503,
      error_code: "EXPORT_STORAGE_NOT_CONFIGURED",
      member_id: "member_2000-08-16",
      visitor_id: "visitor_03:30",
      message: "Failed for 2000-08-16 03:30 Shanghai phone 13800138000 webhook_secret=secret data:image/png;base64,AAAA"
    });

    expect(log).toMatchObject({
      request_id: "req_test",
      route: "/api/report/export-preview",
      status: 503,
      error_code: "EXPORT_STORAGE_NOT_CONFIGURED"
    });
    expect(log.member_id).toMatch(/^sha256:/);
    expect(log.visitor_id).toMatch(/^sha256:/);
    expect(JSON.stringify(log)).not.toMatch(/2000-08-16|03:30|Shanghai|13800138000|secret|data:image/);
    expect(log.message).toContain("[birth_date_redacted]");
    expect(log.message).toContain("[phone_redacted]");
  });

  test("evaluates launch alert rules without leaking sensitive context", () => {
    const alerts = evaluateOperationalAlerts({
      five_minute_5xx_rate: 0.03,
      payment_webhook_signature_failures: 4,
      entitlement_gap_count: 1,
      unauthorized_ops_attempts: 3,
      backup_last_success_minutes_ago: 180,
      sample_context: "member 2000-08-16 03:30 Shanghai phone 13800138000"
    });

    expect(alerts.map((alert) => alert.code)).toEqual(
      expect.arrayContaining(["FIVE_MINUTE_5XX_RATE_HIGH", "PAYMENT_WEBHOOK_SIGNATURE_FAILURE_SPIKE", "ENTITLEMENT_GAP_DETECTED", "OPS_UNAUTHORIZED_ACCESS_SPIKE", "BACKUP_HEALTHCHECK_STALE"])
    );
    expect(alerts.every((alert) => alert.severity === "critical" || alert.severity === "warning")).toBe(true);
    expect(JSON.stringify(alerts)).not.toMatch(/2000-08-16|03:30|Shanghai|13800138000/);
  });

  test("emits structured logs and alerts to configured sinks", async () => {
    const previous = { sink: process.env.OBS_LOG_SINK, alert: process.env.OBS_ALERT_WEBHOOK_URL, secret: process.env.OBS_ALERT_WEBHOOK_SECRET };
    process.env.OBS_LOG_SINK = "https://logs.example.test/ingest";
    process.env.OBS_ALERT_WEBHOOK_URL = "https://alerts.example.test/hook";
    process.env.OBS_ALERT_WEBHOOK_SECRET = "test-secret";
    const calls: Array<{ url: string; body: string }> = [];
    const oldFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), body: String(init?.body ?? "") });
      return new Response("ok", { status: 200 });
    }) as typeof fetch;
    try {
      await emitStructuredLog({ request_id: "req-1", route: "/api/test", status: 500 });
      await dispatchOperationalAlerts([{ code: "FIVE_MINUTE_5XX_RATE_HIGH", severity: "critical", metric: "five_minute_5xx_rate", threshold: 0.02, actual: 0.2, message: "bad" }]);
      expect(calls.map((call) => call.url)).toEqual(["https://logs.example.test/ingest", "https://alerts.example.test/hook"]);
      expect(calls[0].body).toContain("request_id");
      expect(calls[1].body).toContain("FIVE_MINUTE_5XX_RATE_HIGH");
    } finally {
      globalThis.fetch = oldFetch;
      restoreEnv("OBS_LOG_SINK", previous.sink);
      restoreEnv("OBS_ALERT_WEBHOOK_URL", previous.alert);
      restoreEnv("OBS_ALERT_WEBHOOK_SECRET", previous.secret);
    }
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
