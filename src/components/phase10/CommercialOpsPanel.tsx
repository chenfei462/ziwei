"use client";

import {
  BarChart3,
  BadgeCheck,
  CircleDollarSign,
  FileUp,
  ReceiptText,
  ShieldAlert,
  ShieldCheck,
  Wallet
} from "lucide-react";
import { useState } from "react";
import type {
  LaunchOperationsDashboard,
  OpsPaymentAlertWebhookResponse,
  OpsPaymentReconciliationResponse,
  PaymentProvider,
  ProviderStatementImportResponse,
  ProviderStatementPreviewResponse,
  ProviderStatementRowType
} from "../../types.js";

type CommercialOpsPanelProps = {
  dashboard: LaunchOperationsDashboard;
  financeAccessGranted: boolean;
  canManagePaymentAlerts?: boolean;
  reconciliation?: OpsPaymentReconciliationResponse;
};

const providerOrder: PaymentProvider[] = [
  "wechat_pay_reserved",
  "alipay_reserved",
  "stripe_checkout",
  "mock_checkout"
];

const defaultStatementRows = JSON.stringify(
  [
    {
      provider_transaction_id: "provider_txn_example",
      order_id: "order_example",
      type: "payment",
      amount_cents: 4900,
      occurred_at: "2026-06-09T00:00:00.000Z"
    }
  ],
  null,
  2
);

const defaultStatementCsv = [
  "transaction_id,out_trade_no,type,total_amount,success_time,memo",
  "provider_txn_example,order_example,payment,49.00,2026-06-09 00:00:00,"
].join("\n");

export function CommercialOpsPanel({ dashboard, financeAccessGranted, canManagePaymentAlerts = false, reconciliation }: CommercialOpsPanelProps) {
  const { launch_config, orders, risk, support, growth } = dashboard;
  const [currentReconciliation, setCurrentReconciliation] = useState(reconciliation);
  const [statementProvider, setStatementProvider] = useState<PaymentProvider>("wechat_pay_reserved");
  const [statementId, setStatementId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [statementImportMode, setStatementImportMode] = useState<"json" | "csv">("json");
  const [statementRows, setStatementRows] = useState(defaultStatementRows);
  const [statementCsv, setStatementCsv] = useState(defaultStatementCsv);
  const [importResult, setImportResult] = useState<ProviderStatementImportResponse | undefined>();
  const [previewResult, setPreviewResult] = useState<ProviderStatementPreviewResponse | undefined>();
  const [importError, setImportError] = useState<string | undefined>();
  const [isImporting, setIsImporting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [alertReason, setAlertReason] = useState("Finance reconciliation alert drill");
  const [alertResult, setAlertResult] = useState<OpsPaymentAlertWebhookResponse | undefined>();
  const [alertError, setAlertError] = useState<string | undefined>();
  const [isSendingAlert, setIsSendingAlert] = useState(false);
  const financeReconciliation = currentReconciliation ?? reconciliation;

  async function importProviderStatement() {
    if (isImporting || !financeAccessGranted) return;
    setIsImporting(true);
    setImportError(undefined);
    try {
      const response = await fetch("/api/ops/reconciliation/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          provider: statementProvider,
          statement_id: statementId.trim(),
          period_start: periodStart.trim(),
          period_end: periodEnd.trim(),
          ...(statementImportMode === "csv" ? { csv: statementCsv } : { rows: parseStatementRows(statementRows) })
        })
      });
      const payload = (await response.json()) as ProviderStatementImportResponse | { error?: { message?: string } };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error?.message : "Provider statement import failed.");
      }
      const importPayload = payload as ProviderStatementImportResponse;
      setImportResult(importPayload);
      const reconciliationResponse = await fetch("/api/ops/reconciliation", { credentials: "same-origin" });
      const reconciliationPayload = (await reconciliationResponse.json()) as OpsPaymentReconciliationResponse | { error?: { message?: string } };
      if (!reconciliationResponse.ok) {
        throw new Error("error" in reconciliationPayload ? reconciliationPayload.error?.message : "Provider reconciliation refresh failed.");
      }
      setCurrentReconciliation(reconciliationPayload as OpsPaymentReconciliationResponse);
      setStatementId("");
      setStatementRows(defaultStatementRows);
      setStatementCsv(defaultStatementCsv);
    } catch (caught) {
      setImportError(caught instanceof Error ? caught.message : "Provider statement import failed.");
    } finally {
      setIsImporting(false);
    }
  }

  async function previewProviderStatement() {
    if (isPreviewing || !financeAccessGranted) return;
    setIsPreviewing(true);
    setImportError(undefined);
    try {
      const response = await fetch("/api/ops/reconciliation/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          provider: statementProvider,
          statement_id: statementId.trim(),
          period_start: periodStart.trim(),
          period_end: periodEnd.trim(),
          ...(statementImportMode === "csv" ? { csv: statementCsv } : { rows: parseStatementRows(statementRows) })
        })
      });
      const payload = (await response.json()) as ProviderStatementPreviewResponse | { error?: { message?: string } };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error?.message : "Provider statement preview failed.");
      }
      setPreviewResult(payload as ProviderStatementPreviewResponse);
      if (statementImportMode === "csv") {
        setStatementCsv(redactVisibleStatementInput(statementCsv));
      } else {
        setStatementRows(redactVisibleStatementInput(statementRows));
      }
    } catch (caught) {
      setImportError(caught instanceof Error ? caught.message : "Provider statement preview failed.");
    } finally {
      setIsPreviewing(false);
    }
  }

  async function triggerPaymentAlert(mode: "dry_run" | "send") {
    if (isSendingAlert || !financeAccessGranted || !canManagePaymentAlerts) return;
    setIsSendingAlert(true);
    setAlertError(undefined);
    try {
      const response = await fetch("/api/ops/reconciliation/alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          mode,
          reason: sanitizeBrowserAlertReason(alertReason)
        })
      });
      const payload = (await response.json()) as OpsPaymentAlertWebhookResponse | { error?: { message?: string } };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error?.message : "Payment alert webhook request failed.");
      }
      setAlertResult(payload as OpsPaymentAlertWebhookResponse);
    } catch (caught) {
      setAlertError(caught instanceof Error ? caught.message : "Payment alert webhook request failed.");
    } finally {
      setIsSendingAlert(false);
    }
  }

  return (
    <section className="phase10-panel commercial-ops-panel">
      <div className="panel-title-row">
        <BadgeCheck aria-hidden="true" size={18} />
        <h2>Commercial Operations</h2>
      </div>
      <p className="muted">Finance summaries stay redacted unless the operator has finance-grade access. Public birth data, report bodies, and private messages never appear here.</p>

      <div className="phase10-result" aria-label="commercial launch status">
        <span>{launch_config.public_status}</span>
        <span>{launch_config.provider_mode}</span>
        <span>{financeAccessGranted ? "Finance access granted" : "Finance access restricted"}</span>
        <span>orders {orders.total_orders}</span>
        <span>paid {orders.paid_orders}</span>
        <span>fulfilled {orders.fulfilled_orders}</span>
      </div>

      <section className="commercial-ops-section" aria-label="revenue and risk">
        <div className="panel-title-row">
          <CircleDollarSign aria-hidden="true" size={18} />
          <h3>Revenue and Risk</h3>
        </div>
        <div className="phase10-metric-row">
          <span>conversion {formatPercent(orders.payment_conversion_rate)}</span>
          <span>aov {formatCurrency(orders.average_order_value_cents)}</span>
          <span>orders {orders.total_orders}</span>
          <span>failed {orders.failed_orders}</span>
          <span>manual refund {orders.refunded_manual_orders}</span>
          <span>partial refund {orders.partially_refunded_orders}</span>
        </div>
        <div className="phase10-metric-row">
          <span>payment failure {formatPercent(risk.payment_failure_rate)}</span>
          <span>refund rate {formatPercent(risk.refund_rate)}</span>
          <span>webhook exceptions {risk.webhook_exception_count}</span>
          <span>privacy scan {risk.privacy_scan_violations}</span>
          <span>unauthorized access {risk.unauthorized_access_attempts}</span>
        </div>
      </section>

      <section className="commercial-ops-section" aria-label="support and funnel">
        <div className="panel-title-row">
          <BarChart3 aria-hidden="true" size={18} />
          <h3>Support and Funnel</h3>
        </div>
        <div className="phase10-metric-row">
          <span>open tickets {support.open_tickets}</span>
          <span>high priority {support.high_priority_tickets}</span>
          <span>refund requests {support.refund_request_tickets}</span>
          <span>deletion requests {support.privacy_deletion_tickets}</span>
          <span>SLA attention {support.sla_attention_required}</span>
        </div>
        <div className="phase10-metric-row">
          <span>chart to purchase {growth.chart_to_purchase}</span>
          <span>preview to payment {growth.preview_to_payment}</span>
          <span>payment to revisit {growth.payment_to_revisit}</span>
          <span>entitlement usage {growth.entitlement_usage}</span>
          <span>share to purchase {growth.share_to_purchase}</span>
          <span>repeat purchase {growth.repeat_purchase_intent}</span>
        </div>
        <div className="commercial-ops-note">
          <ReceiptText aria-hidden="true" size={14} />
          <span>Orders, support tickets, and funnel events are all stored with privacy redaction and service-side identity checks.</span>
        </div>
      </section>

      <section className="commercial-ops-section" aria-label="provider reconciliation">
        <div className="panel-title-row">
          <Wallet aria-hidden="true" size={18} />
          <h3>Provider Reconciliation</h3>
        </div>
        {financeAccessGranted && financeReconciliation ? (
          <>
            <div className="phase10-metric-row">
              <span>gross {formatCurrency(financeReconciliation.summary.gross_amount_cents)}</span>
              <span>refunded {formatCurrency(financeReconciliation.summary.refunded_amount_cents)}</span>
              <span>net {formatCurrency(financeReconciliation.summary.net_amount_cents)}</span>
              <span>duplicate webhooks {financeReconciliation.summary.duplicate_webhook_count}</span>
              <span>entitlement gaps {financeReconciliation.summary.entitlement_gap_count}</span>
              <span>refund records {financeReconciliation.summary.refund_record_count}</span>
              <span>payment events {financeReconciliation.summary.payment_event_count}</span>
            </div>
            <div className="commercial-ops-provider-grid">
              {providerOrder.map((provider) => {
                const item = financeReconciliation.by_provider[provider];
                return (
                  <article className="commercial-ops-provider-card" key={provider}>
                    <strong>{provider}</strong>
                    <div className="phase10-metric-row">
                      <span>orders {item.order_count}</span>
                      <span>events {item.payment_event_count}</span>
                      <span>refunds {item.refund_record_count}</span>
                    </div>
                    <div className="phase10-metric-row">
                      <span>gross {formatCurrency(item.gross_amount_cents)}</span>
                      <span>refunded {formatCurrency(item.refunded_amount_cents)}</span>
                      <span>net {formatCurrency(item.net_amount_cents)}</span>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="commercial-ops-subsection">
              <div className="panel-title-row">
                <ReceiptText aria-hidden="true" size={18} />
                <h4>Provider Statements</h4>
              </div>
              <div className="commercial-ops-statement-form" aria-label="provider statement import form">
                <label>
                  Provider
                  <select value={statementProvider} onChange={(event) => setStatementProvider(event.target.value as PaymentProvider)}>
                    <option value="wechat_pay_reserved">wechat_pay_reserved</option>
                    <option value="alipay_reserved">alipay_reserved</option>
                  </select>
                </label>
                <label>
                  Statement ID
                  <input value={statementId} onChange={(event) => setStatementId(event.target.value)} placeholder="statement_YYYYMMDD_provider" />
                </label>
                <label>
                  Period start
                  <input value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} placeholder="2026-06-09" />
                </label>
                <label>
                  Period end
                  <input value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} placeholder="2026-06-09" />
                </label>
                <div className="commercial-ops-statement-mode" role="radiogroup" aria-label="statement import mode">
                  <label>
                    <input
                      checked={statementImportMode === "json"}
                      name="statement_import_mode"
                      onChange={() => setStatementImportMode("json")}
                      type="radio"
                    />
                    JSON import
                  </label>
                  <label>
                    <input
                      checked={statementImportMode === "csv"}
                      name="statement_import_mode"
                      onChange={() => setStatementImportMode("csv")}
                      type="radio"
                    />
                    CSV import
                  </label>
                </div>
                {statementImportMode === "csv" ? (
                  <label className="commercial-ops-statement-rows">
                    Statement rows CSV
                    <textarea value={statementCsv} onChange={(event) => setStatementCsv(event.target.value)} />
                  </label>
                ) : (
                  <label className="commercial-ops-statement-rows">
                    Statement rows JSON
                    <textarea value={statementRows} onChange={(event) => setStatementRows(event.target.value)} />
                  </label>
                )}
                <div className="commercial-ops-action-row">
                  <button disabled={isPreviewing || !statementId.trim() || !periodStart.trim() || !periodEnd.trim()} onClick={previewProviderStatement} type="button">
                    Preview provider statement
                  </button>
                  <button disabled={isImporting || !statementId.trim() || !periodStart.trim() || !periodEnd.trim()} onClick={importProviderStatement} type="button">
                    <FileUp aria-hidden="true" size={15} />
                    Import provider statement
                  </button>
                </div>
              </div>
              {importError ? <p className="error-message">{importError}</p> : null}
              {previewResult ? (
                <div className="phase10-result" aria-label="provider statement preview result">
                  <span>preview {previewResult.statement.statement_id}</span>
                  <span>preview matched {previewResult.reconciliation.matched_row_count}</span>
                  <span>preview amount mismatch {previewResult.reconciliation.amount_mismatch_count}</span>
                  <span>preview orphan rows {previewResult.reconciliation.orphan_provider_row_count}</span>
                  <span>persisted {previewResult.persistence?.persisted ? "yes" : "no"}</span>
                </div>
              ) : null}
              {importResult ? (
                <div className="phase10-result" aria-label="provider statement import result">
                  <span>{importResult.statement.statement_id}</span>
                  <span>matched {importResult.reconciliation.matched_row_count}</span>
                  <span>amount mismatch {importResult.reconciliation.amount_mismatch_count}</span>
                  <span>orphan rows {importResult.reconciliation.orphan_provider_row_count}</span>
                </div>
              ) : null}
              <div className="phase10-metric-row">
                <span>statements {financeReconciliation.provider_statements.summary.statement_count}</span>
                <span>rows {financeReconciliation.provider_statements.summary.statement_row_count}</span>
                <span>matched {financeReconciliation.provider_statements.summary.matched_row_count}</span>
                <span>amount mismatch {financeReconciliation.provider_statements.summary.amount_mismatch_count}</span>
                <span>orphan rows {financeReconciliation.provider_statements.summary.orphan_provider_row_count}</span>
              </div>
              <div className="commercial-ops-subsection" aria-label="payment reconciliation alerts">
                <div className="panel-title-row">
                  <ShieldAlert aria-hidden="true" size={18} />
                  <h4>Payment Alerts</h4>
                </div>
                {financeReconciliation.alerts.length > 0 ? (
                  <ul className="commercial-ops-list">
                    {financeReconciliation.alerts.map((alert) => (
                      <li key={`${alert.code}:${alert.provider ?? "all"}`}>
                        <strong>
                          {alert.severity} · {alert.title}
                        </strong>
                        <span>
                          {alert.provider ? `${alert.provider} · ` : ""}
                          count {alert.count} · {alert.detail}
                        </span>
                        <small>{alert.action}</small>
                        <small>{alert.privacy_note}</small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">No payment reconciliation alerts.</p>
                )}
                {canManagePaymentAlerts ? (
                  <div className="commercial-ops-alert-actions" aria-label="payment alert webhook actions">
                    <label>
                      Alert drill reason
                      <input value={alertReason} onChange={(event) => setAlertReason(event.target.value)} />
                    </label>
                    <div className="commercial-ops-action-row">
                      <button disabled={isSendingAlert || !alertReason.trim()} onClick={() => void triggerPaymentAlert("dry_run")} type="button">
                        Dry-run payment alert
                      </button>
                      <button disabled={isSendingAlert || !alertReason.trim()} onClick={() => void triggerPaymentAlert("send")} type="button">
                        Send payment alert
                      </button>
                    </div>
                    {alertError ? <p className="error-message">{alertError}</p> : null}
                    {alertResult ? (
                      <div className="phase10-result" aria-label="payment alert webhook result">
                        <span>{alertResult.status}</span>
                        <span>alerts {alertResult.payload.summary.alert_count}</span>
                        <span>attempted {alertResult.delivery.attempted ? "yes" : "no"}</span>
                        {alertResult.delivery.http_status === undefined ? null : <span>http {alertResult.delivery.http_status}</span>}
                        <span>idempotency {alertResult.delivery.idempotency_key}</span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {financeReconciliation.provider_statements.statements.length > 0 ? (
                <ul className="commercial-ops-list">
                  {financeReconciliation.provider_statements.statements.map((statement) => (
                    <li key={statement.statement_id}>
                      <strong>{statement.statement_id}</strong>
                      <span>
                        {statement.provider} 路 {statement.period_start} to {statement.period_end} 路 rows {statement.row_count}
                      </span>
                      <small>
                        imported by {statement.imported_by} 路 {statement.imported_at}
                      </small>
                      <small>{statement.privacy_note}</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No provider statements imported.</p>
              )}
              {financeReconciliation.provider_statements.discrepancies.length > 0 ? (
                <ul className="commercial-ops-list" aria-label="provider statement discrepancies">
                  {financeReconciliation.provider_statements.discrepancies.map((item) => (
                    <li key={`${item.type}:${item.provider_transaction_id}:${item.order_id ?? item.refund_id ?? "unmatched"}`}>
                      <strong>{item.type}</strong>
                      <span>
                        {item.provider} 路 transaction {item.provider_transaction_id} 路 statement {formatCurrency(item.statement_amount_cents)}
                        {item.internal_amount_cents === undefined ? "" : ` 路 internal ${formatCurrency(item.internal_amount_cents)}`}
                      </span>
                      <small>
                        {item.order_id ? `order ${item.order_id}` : ""}
                        {item.refund_id ? ` refund ${item.refund_id}` : ""}
                      </small>
                      <small>{item.privacy_note}</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No provider statement discrepancies detected.</p>
              )}
            </div>

            <div className="commercial-ops-subsection">
              <div className="panel-title-row">
                <ShieldCheck aria-hidden="true" size={18} />
                <h4>Refund Records</h4>
              </div>
              {financeReconciliation.refunds.length > 0 ? (
                <ul className="commercial-ops-list">
                  {financeReconciliation.refunds.map((refund) => (
                    <li key={refund.refund_id}>
                      <strong>{refund.refund_id}</strong>
                      <span>
                        order {refund.order_id} · {refund.provider} · {formatCurrency(refund.amount_cents)} · {refund.status}
                      </span>
                      <small>
                        requested by {refund.requested_by}
                        {refund.ticket_id ? ` · ticket ${refund.ticket_id}` : ""}
                      </small>
                      <small>{refund.privacy_note}</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No refund records loaded.</p>
              )}
            </div>

            <div className="commercial-ops-subsection">
              <div className="panel-title-row">
                <ShieldAlert aria-hidden="true" size={18} />
                <h4>Entitlement Gaps</h4>
              </div>
              {financeReconciliation.entitlement_gaps.length > 0 ? (
                <ul className="commercial-ops-list">
                  {financeReconciliation.entitlement_gaps.map((gap) => (
                    <li key={gap.order_id}>
                      <strong>{gap.order_id}</strong>
                      <span>
                        report {gap.report_id} · member {gap.member_id} · {gap.status}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No entitlement gaps detected.</p>
              )}
            </div>
          </>
        ) : (
          <div className="commercial-ops-restricted">
            <ShieldAlert aria-hidden="true" size={18} />
            <p>Finance access restricted to ops_admin and support_agent.</p>
          </div>
        )}
      </section>
    </section>
  );
}

function formatCurrency(valueCents: number): string {
  return `${(valueCents / 100).toFixed(2)} CNY`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function sanitizeBrowserAlertReason(value: string): string {
  return String(value || "Payment alert drill")
    .replace(/\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/g, "[date_redacted]")
    .replace(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g, "[time_redacted]")
    .replace(/\b(?:Shanghai|Beijing|Guangzhou|Shenzhen|Chengdu|Hangzhou|Nanjing|Wuhan)\b/gi, "[location_redacted]")
    .replace(/openid[^\s,;]*/gi, "[provider_identity_redacted]")
    .replace(/\s+/g, " ")
    .trim();
}

function redactVisibleStatementInput(value: string): string {
  return String(value || "")
    .replace(/\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/g, "[date_redacted]")
    .replace(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g, "[time_redacted]")
    .replace(/\b(?:Shanghai|Beijing|Guangzhou|Shenzhen|Chengdu|Hangzhou|Nanjing|Wuhan)\b/gi, "[location_redacted]")
    .replace(/openid[^\s"',;}]*/gi, "[provider_identity_redacted]");
}

function parseStatementRows(value: string) {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Statement rows JSON must be an array.");
  }
  return parsed.map((row) => {
    if (!isStatementRowInput(row)) {
      throw new Error("Statement rows must include provider_transaction_id, type, amount_cents, and occurred_at.");
    }
    return row;
  });
}

function isStatementRowInput(row: unknown): row is {
  provider_transaction_id: string;
  order_id?: string;
  refund_id?: string;
  type: ProviderStatementRowType;
  amount_cents: number;
  occurred_at: string;
  raw_reference?: string;
} {
  if (typeof row !== "object" || row === null) return false;
  const maybe = row as Record<string, unknown>;
  return (
    typeof maybe.provider_transaction_id === "string" &&
    (maybe.type === "payment" || maybe.type === "refund") &&
    typeof maybe.amount_cents === "number" &&
    Number.isFinite(maybe.amount_cents) &&
    typeof maybe.occurred_at === "string" &&
    (maybe.order_id === undefined || typeof maybe.order_id === "string") &&
    (maybe.refund_id === undefined || typeof maybe.refund_id === "string") &&
    (maybe.raw_reference === undefined || typeof maybe.raw_reference === "string")
  );
}
