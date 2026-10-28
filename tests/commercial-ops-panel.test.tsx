// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CommercialOpsPanel } from "../src/components/phase10/CommercialOpsPanel.js";
import type { LaunchOperationsDashboard, OpsPaymentAlertWebhookResponse, OpsPaymentReconciliationResponse } from "../src/types.js";

const dashboard = {
  launch_config: {
    provider: "stripe_checkout",
    provider_mode: "production",
    production_payment_enabled: true,
    rollout_percent: 80,
    rollback_enabled: false,
    webhook_secret_configured: true,
    max_production_amount_cents: 19900,
    public_status: "production_ready"
  },
  orders: {
    total_orders: 8,
    pending_orders: 1,
    paid_orders: 5,
    fulfilled_orders: 3,
    failed_orders: 1,
    cancelled_orders: 0,
    refunded_orders: 1,
    partially_refunded_orders: 1,
    refunded_manual_orders: 1,
    payment_conversion_rate: 0.75,
    average_order_value_cents: 4900,
    report_type_counts: {
      single_chart: 5,
      synastry: 2,
      timeline: 1
    },
    content_review_block_rate: 0.125,
    payment_provider_counts: {
      stripe_checkout: 4,
      mock_checkout: 1,
      wechat_pay_reserved: 2,
      alipay_reserved: 1
    },
    privacy: {
      stores_full_birth_date: false,
      stores_birth_time: false,
      stores_location_detail: false,
      stores_video_frame: false
    }
  },
  risk: {
    payment_failure_rate: 0.25,
    refund_rate: 0.2,
    webhook_exception_count: 2,
    content_review_block_rate: 0.125,
    privacy_scan_violations: 0,
    unauthorized_access_attempts: 1
  },
  support: {
    total_tickets: 5,
    open_tickets: 1,
    resolved_tickets: 4,
    high_priority_tickets: 2,
    refund_request_tickets: 2,
    privacy_deletion_tickets: 1,
    sla_attention_required: 1
  },
  growth: {
    chart_to_purchase: 12,
    preview_to_payment: 9,
    payment_to_revisit: 4,
    entitlement_usage: 6,
    share_to_purchase: 3,
    repeat_purchase_intent: 2
  },
  privacy: {
    stores_full_birth_date: false,
    stores_birth_time: false,
    stores_location_detail: false,
    stores_video_frame: false
  }
} satisfies LaunchOperationsDashboard;

const reconciliation = {
  summary: {
    order_count: 8,
    payment_event_count: 9,
    gross_amount_cents: 39200,
    refunded_amount_cents: 4900,
    net_amount_cents: 34300,
    entitlement_gap_count: 1,
    duplicate_webhook_count: 1,
    refund_record_count: 2
  },
  by_provider: {
    stripe_checkout: {
      provider: "stripe_checkout",
      order_count: 4,
      payment_event_count: 4,
      refund_record_count: 1,
      gross_amount_cents: 19600,
      refunded_amount_cents: 1900,
      net_amount_cents: 17700
    },
    mock_checkout: {
      provider: "mock_checkout",
      order_count: 1,
      payment_event_count: 1,
      refund_record_count: 0,
      gross_amount_cents: 1900,
      refunded_amount_cents: 0,
      net_amount_cents: 1900
    },
    wechat_pay_reserved: {
      provider: "wechat_pay_reserved",
      order_count: 2,
      payment_event_count: 3,
      refund_record_count: 1,
      gross_amount_cents: 9800,
      refunded_amount_cents: 1900,
      net_amount_cents: 7900
    },
    alipay_reserved: {
      provider: "alipay_reserved",
      order_count: 1,
      payment_event_count: 1,
      refund_record_count: 0,
      gross_amount_cents: 7900,
      refunded_amount_cents: 1100,
      net_amount_cents: 6800
    }
  },
  provider_statements: {
    summary: {
      statement_count: 1,
      statement_row_count: 3,
      matched_row_count: 1,
      amount_mismatch_count: 1,
      orphan_provider_row_count: 1
    },
    statements: [
      {
        statement_id: "statement_20260609_wechat",
        provider: "wechat_pay_reserved",
        period_start: "2026-06-09",
        period_end: "2026-06-09",
        imported_at: "2026-06-09T00:00:00.000Z",
        imported_by: "ops_finance",
        row_count: 3,
        privacy_note: "Provider statements store provider transaction ids, order/refund ids, amounts, timestamps, and optional raw reference digests only."
      }
    ],
    discrepancies: [
      {
        type: "amount_mismatch",
        provider: "wechat_pay_reserved",
        provider_transaction_id: "wx_amount_mismatch",
        order_id: "order_0002",
        statement_amount_cents: 5100,
        internal_amount_cents: 4900,
        privacy_note: "Provider statement amount differs from internal finance records."
      },
      {
        type: "orphan_provider_row",
        provider: "alipay_reserved",
        provider_transaction_id: "ali_orphan",
        order_id: "order_missing",
        statement_amount_cents: 9900,
        privacy_note: "Provider statement row could not be matched."
      }
    ]
  },
  alerts: [
    {
      code: "PROVIDER_STATEMENT_AMOUNT_MISMATCH",
      severity: "warning",
      provider: "wechat_pay_reserved",
      count: 1,
      title: "Provider statement amount mismatch",
      detail: "1 provider statement row differs from internal finance records.",
      action: "Review the order, provider transaction, and refund state before settlement close.",
      privacy_note: "Alert hides raw provider references and user-sensitive context."
    },
    {
      code: "PROVIDER_STATEMENT_ORPHAN_ROWS",
      severity: "critical",
      provider: "alipay_reserved",
      count: 1,
      title: "Provider statement orphan rows",
      detail: "1 provider statement row cannot be matched to an internal order or refund.",
      action: "Open a finance review ticket and verify the provider transaction before fulfillment or refund handling.",
      privacy_note: "Alert hides raw provider references and user-sensitive context."
    }
  ],
  refunds: [
    {
      refund_id: "refund_0001",
      order_id: "order_0001",
      provider: "stripe_checkout",
      amount_cents: 1900,
      status: "succeeded",
      requested_by: "ops_admin:finance",
      ticket_id: "ticket_0001",
      created_at: "2026-06-08T00:00:00.000Z",
      privacy_note: "Refund record stores order/provider finance metadata only; raw birth data, phone, third-party identities, and full report content are not persisted."
    },
    {
      refund_id: "refund_0002",
      order_id: "order_0002",
      provider: "wechat_pay_reserved",
      amount_cents: 3000,
      status: "succeeded",
      requested_by: "ops_admin:support",
      ticket_id: "ticket_0002",
      created_at: "2026-06-08T00:01:00.000Z",
      privacy_note: "Refund record stores order/provider finance metadata only; raw birth data, phone, third-party identities, and full report content are not persisted."
    }
  ],
  entitlement_gaps: [
    {
      order_id: "order_gap_1",
      report_id: "report_gap_1",
      member_id: "member_gap_1",
      status: "paid"
    }
  ],
  privacy: {
    stores_full_birth_date: false,
    stores_birth_time: false,
    stores_location_detail: false,
    stores_video_frame: false
  }
} satisfies OpsPaymentReconciliationResponse;

describe("CommercialOpsPanel", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("renders finance summary, provider reconciliation, refunds, and access granted state", () => {
    render(<CommercialOpsPanel dashboard={dashboard} financeAccessGranted reconciliation={reconciliation} />);

    expect(screen.getByRole("heading", { name: "Commercial Operations" })).toBeInTheDocument();
    expect(screen.getByText("production_ready")).toBeInTheDocument();
    expect(screen.getByText("gross 392.00 CNY")).toBeInTheDocument();
    expect(screen.getByText("refunded 49.00 CNY")).toBeInTheDocument();
    expect(screen.getByText("net 343.00 CNY")).toBeInTheDocument();
    expect(screen.getByText("duplicate webhooks 1")).toBeInTheDocument();
    expect(screen.getByText("entitlement gaps 1")).toBeInTheDocument();
    expect(screen.getAllByText("wechat_pay_reserved").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("alipay_reserved").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("statements 1")).toBeInTheDocument();
    expect(screen.getByText("matched 1")).toBeInTheDocument();
    expect(screen.getByText("amount mismatch 1")).toBeInTheDocument();
    expect(screen.getByText("orphan rows 1")).toBeInTheDocument();
    expect(screen.getByText("statement_20260609_wechat")).toBeInTheDocument();
    expect(screen.getByText("Payment Alerts")).toBeInTheDocument();
    expect(screen.getByText(/Provider statement amount mismatch/)).toBeInTheDocument();
    expect(screen.getByText(/Provider statement orphan rows/)).toBeInTheDocument();
    expect(screen.getByText(/wx_amount_mismatch/)).toBeInTheDocument();
    expect(screen.getByText(/ali_orphan/)).toBeInTheDocument();
    expect(screen.getByText("refund_0001")).toBeInTheDocument();
    expect(screen.getByText("order_gap_1")).toBeInTheDocument();
    expect(screen.getByText("Finance access granted")).toBeInTheDocument();
    expect(screen.queryByText("Finance access restricted to ops_admin and support_agent.")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/2000-08-16|03:30|Shanghai|openid/);
  });

  test("renders a restricted state when finance reconciliation is unavailable", () => {
    render(<CommercialOpsPanel dashboard={dashboard} financeAccessGranted={false} />);

    expect(screen.getByText("Finance access restricted to ops_admin and support_agent.")).toBeInTheDocument();
    expect(screen.queryByText("gross 392.00 CNY")).not.toBeInTheDocument();
    expect(screen.queryByText("refund_0001")).not.toBeInTheDocument();
  });

  test("lets ops admins dry-run and send payment alert webhooks without leaking sensitive browser payloads", async () => {
    const alertResponse = {
      status: "delivered",
      payload: {
        event_type: "ops.payment_reconciliation_alerts",
        event_id: "ops_payment_alert_panel",
        created_at: "2026-06-09T01:00:00.000Z",
        summary: {
          alert_count: 2,
          critical_count: 1,
          warning_count: 1,
          info_count: 0
        },
        alerts: reconciliation.alerts,
        privacy_note: "Payment alert webhook payloads include sanitized alert summaries only."
      },
      delivery: {
        configured: true,
        attempted: true,
        http_status: 202,
        response_digest: "response_digest_only",
        endpoint_digest: "a".repeat(64),
        signature_algorithm: "HMAC-SHA256",
        signature_digest: "b".repeat(64),
        idempotency_key: "ops-payment-alert:panel"
      },
      audit_log: {
        audit_log_id: "audit_panel_alert",
        actor_id: "ops_finance",
        actor_role: "ops_admin",
        action: "ops_payment_alert_webhook_prepared",
        target_type: "payment_reconciliation_alerts",
        target_id: "ops_payment_alert_panel",
        metadata: {
          mode: "send",
          alert_count: 2,
          webhook_configured: true,
          delivery_attempted: true
        },
        created_at: "2026-06-09T01:00:00.000Z",
        privacy_note: "Admin audit logs store redacted metadata only."
      },
      privacy: {
        sensitive_fields_redacted: true,
        raw_provider_reference_hidden: true,
        raw_webhook_url_hidden: true,
        admin_required: true
      }
    } satisfies OpsPaymentAlertWebhookResponse;
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => alertResponse } as Response);

    render(<CommercialOpsPanel dashboard={dashboard} financeAccessGranted canManagePaymentAlerts reconciliation={reconciliation} />);

    fireEvent.change(screen.getByLabelText("Alert drill reason"), {
      target: { value: "Finance alert drill for 2000-08-16 03:30 Shanghai openid_x" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Dry-run payment alert" }));
    await waitFor(() => expect(screen.getByText("delivered")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Send payment alert" }));

    await waitFor(() => expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(2));
    const dryRunRequest = vi.mocked(globalThis.fetch).mock.calls[0]?.[1] as RequestInit;
    const sendRequest = vi.mocked(globalThis.fetch).mock.calls[1]?.[1] as RequestInit;
    expect(vi.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe("/api/ops/reconciliation/alerts");
    expect(vi.mocked(globalThis.fetch).mock.calls[1]?.[0]).toBe("/api/ops/reconciliation/alerts");
    expect(JSON.parse(String(dryRunRequest.body ?? "{}"))).toMatchObject({
      mode: "dry_run"
    });
    expect(JSON.parse(String(sendRequest.body ?? "{}"))).toMatchObject({
      mode: "send"
    });
    expect(String(dryRunRequest.body)).not.toMatch(/auth|2000-08-16|03:30|Shanghai|openid/);
    expect(String(sendRequest.body)).not.toMatch(/auth|2000-08-16|03:30|Shanghai|openid/);
    expect(screen.getByText("http 202")).toBeInTheDocument();
    expect(screen.getByText(/idempotency ops-payment-alert:panel/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/2000-08-16|03:30|Shanghai|openid|alerts.example|alert_signing_secret/);
  });

  test("hides payment alert webhook actions from support agents with finance read-only access", () => {
    render(<CommercialOpsPanel dashboard={dashboard} financeAccessGranted canManagePaymentAlerts={false} reconciliation={reconciliation} />);

    expect(screen.getByText("Payment Alerts")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send payment alert" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Alert drill reason")).not.toBeInTheDocument();
  });

  test("imports provider statements from the internal dashboard without sending admin credentials in the browser body", async () => {
    const importedReconciliation = {
      ...reconciliation,
      provider_statements: {
        ...reconciliation.provider_statements,
        summary: {
          statement_count: 2,
          statement_row_count: 4,
          matched_row_count: 2,
          amount_mismatch_count: 1,
          orphan_provider_row_count: 1
        },
        statements: [
          ...reconciliation.provider_statements.statements,
          {
            statement_id: "statement_imported_from_panel",
            provider: "alipay_reserved",
            period_start: "2026-06-10",
            period_end: "2026-06-10",
            imported_at: "2026-06-10T00:00:00.000Z",
            imported_by: "ops_finance",
            row_count: 1,
            privacy_note: "Provider statement stores finance metadata and raw reference digest only."
          }
        ]
      }
    } satisfies OpsPaymentReconciliationResponse;
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          statement: {
            statement_id: "statement_imported_from_panel",
            provider: "alipay_reserved",
            period_start: "2026-06-10",
            period_end: "2026-06-10",
            imported_at: "2026-06-10T00:00:00.000Z",
            imported_by: "ops_finance",
            row_count: 1,
            rows: [
              {
                provider_transaction_id: "ali_panel_match",
                order_id: "order_0001",
                type: "payment",
                amount_cents: 4900,
                occurred_at: "2026-06-10T00:00:00.000Z",
                raw_reference_digest: "c".repeat(64)
              }
            ],
            privacy_note: "Provider statement stores finance metadata and raw reference digest only."
          },
          reconciliation: {
            matched_row_count: 1,
            amount_mismatch_count: 0,
            orphan_provider_row_count: 0
          },
          privacy: reconciliation.privacy
        })
      } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => importedReconciliation } as Response);

    render(<CommercialOpsPanel dashboard={dashboard} financeAccessGranted reconciliation={reconciliation} />);

    fireEvent.change(screen.getByLabelText("Provider"), { target: { value: "alipay_reserved" } });
    fireEvent.change(screen.getByLabelText("Statement ID"), { target: { value: "statement_imported_from_panel" } });
    fireEvent.change(screen.getByLabelText("Period start"), { target: { value: "2026-06-10" } });
    fireEvent.change(screen.getByLabelText("Period end"), { target: { value: "2026-06-10" } });
    fireEvent.change(screen.getByLabelText("Statement rows JSON"), {
      target: {
        value: JSON.stringify([
          {
            provider_transaction_id: "ali_panel_match",
            order_id: "order_0001",
            type: "payment",
            amount_cents: 4900,
            occurred_at: "2026-06-10T00:00:00.000Z",
            raw_reference: "openid_2000-08-16_03:30_Shanghai"
          }
        ])
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Import provider statement" }));

    await waitFor(() => expect(screen.getAllByText("statement_imported_from_panel").length).toBeGreaterThanOrEqual(1));
    expect(screen.getByText("statements 2")).toBeInTheDocument();
    expect(screen.getByText("matched 2")).toBeInTheDocument();
    expect(vi.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe("/api/ops/reconciliation/import");
    expect(vi.mocked(globalThis.fetch).mock.calls[1]?.[0]).toBe("/api/ops/reconciliation");
    const importRequest = vi.mocked(globalThis.fetch).mock.calls[0]?.[1] as RequestInit;
    const importBody = JSON.parse(String(importRequest.body ?? "{}")) as Record<string, unknown>;
    expect(importRequest.headers).toEqual({ "content-type": "application/json" });
    expect(importRequest.credentials).toBe("same-origin");
    expect(importBody).not.toHaveProperty("auth");
    expect(importBody).toMatchObject({
      provider: "alipay_reserved",
      statement_id: "statement_imported_from_panel",
      period_start: "2026-06-10",
      period_end: "2026-06-10"
    });
    expect(document.body.textContent).not.toMatch(/2000-08-16|03:30|Shanghai|openid/);
  });

  test("previews provider statements without refreshing persisted reconciliation or clearing pasted rows", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        statement: {
          statement_id: "statement_preview_from_panel",
          provider: "wechat_pay_reserved",
          period_start: "2026-06-12",
          period_end: "2026-06-12",
          imported_at: "2026-06-12T00:00:00.000Z",
          imported_by: "ops_finance",
          row_count: 1,
          rows: [
            {
              provider_transaction_id: "wx_preview_panel",
              order_id: "order_missing",
              type: "payment",
              amount_cents: 8800,
              occurred_at: "2026-06-12T00:00:00.000Z",
              raw_reference_digest: "e".repeat(64)
            }
          ],
          privacy_note: "Provider statement preview stores no rows and keeps raw references as digest only."
        },
        reconciliation: {
          matched_row_count: 0,
          amount_mismatch_count: 0,
          orphan_provider_row_count: 1,
          alerts: [
            {
              code: "PROVIDER_STATEMENT_ORPHAN_ROWS",
              severity: "critical",
              provider: "wechat_pay_reserved",
              count: 1,
              title: "Provider statement orphan rows",
              detail: "1 provider statement row cannot be matched.",
              action: "Open a finance review ticket.",
              privacy_note: "Alert hides raw provider references."
            }
          ]
        },
        persistence: {
          persisted: false,
          audit_written: false,
          raw_reference_storage: "digest_only"
        },
        privacy: reconciliation.privacy
      })
    } as Response);

    render(<CommercialOpsPanel dashboard={dashboard} financeAccessGranted reconciliation={reconciliation} />);

    fireEvent.change(screen.getByLabelText("Statement ID"), { target: { value: "statement_preview_from_panel" } });
    fireEvent.change(screen.getByLabelText("Period start"), { target: { value: "2026-06-12" } });
    fireEvent.change(screen.getByLabelText("Period end"), { target: { value: "2026-06-12" } });
    fireEvent.change(screen.getByLabelText("Statement rows JSON"), {
      target: {
        value: JSON.stringify([
          {
            provider_transaction_id: "wx_preview_panel",
            order_id: "order_missing",
            type: "payment",
            amount_cents: 8800,
            occurred_at: "2026-06-12T00:00:00.000Z",
            raw_reference: "openid_2000-08-16_03:30_Shanghai"
          }
        ])
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Preview provider statement" }));

    await waitFor(() => expect(screen.getByLabelText("provider statement preview result")).toBeInTheDocument());
    expect(screen.getByText("preview statement_preview_from_panel")).toBeInTheDocument();
    expect(screen.getByText("preview orphan rows 1")).toBeInTheDocument();
    expect(screen.getByText("statements 1")).toBeInTheDocument();
    expect((screen.getByLabelText("Statement rows JSON") as HTMLTextAreaElement).value).toContain("wx_preview_panel");
    expect((screen.getByLabelText("Statement rows JSON") as HTMLTextAreaElement).value).toContain("[provider_identity_redacted]");
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe("/api/ops/reconciliation/preview");
    const previewRequest = vi.mocked(globalThis.fetch).mock.calls[0]?.[1] as RequestInit;
    const previewBody = JSON.parse(String(previewRequest.body ?? "{}")) as Record<string, unknown>;
    expect(previewBody).not.toHaveProperty("auth");
    expect(String(previewRequest.body)).toContain("openid_2000-08-16_03:30_Shanghai");
    expect(document.body.textContent).not.toMatch(/2000-08-16|03:30|Shanghai|openid/);
  });

  test("imports provider statement CSV from the internal dashboard and clears pasted sensitive references", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          statement: {
            statement_id: "statement_csv_from_panel",
            provider: "wechat_pay_reserved",
            period_start: "2026-06-11",
            period_end: "2026-06-11",
            imported_at: "2026-06-11T00:00:00.000Z",
            imported_by: "ops_finance",
            row_count: 1,
            rows: [
              {
                provider_transaction_id: "wx_csv_panel",
                order_id: "order_0001",
                type: "payment",
                amount_cents: 4900,
                occurred_at: "2026-06-11T00:00:00.000Z",
                raw_reference_digest: "d".repeat(64)
              }
            ],
            privacy_note: "Provider statement stores finance metadata and raw reference digest only."
          },
          reconciliation: {
            matched_row_count: 1,
            amount_mismatch_count: 0,
            orphan_provider_row_count: 0
          },
          privacy: reconciliation.privacy
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...reconciliation,
          provider_statements: {
            ...reconciliation.provider_statements,
            summary: {
              statement_count: 2,
              statement_row_count: 4,
              matched_row_count: 2,
              amount_mismatch_count: 1,
              orphan_provider_row_count: 1
            }
          }
        })
      } as Response);

    render(<CommercialOpsPanel dashboard={dashboard} financeAccessGranted reconciliation={reconciliation} />);

    fireEvent.click(screen.getByLabelText("CSV import"));
    fireEvent.change(screen.getByLabelText("Statement ID"), { target: { value: "statement_csv_from_panel" } });
    fireEvent.change(screen.getByLabelText("Period start"), { target: { value: "2026-06-11" } });
    fireEvent.change(screen.getByLabelText("Period end"), { target: { value: "2026-06-11" } });
    fireEvent.change(screen.getByLabelText("Statement rows CSV"), {
      target: {
        value: [
          "transaction_id,out_trade_no,type,total_amount,success_time,memo",
          "wx_csv_panel,order_0001,payment,49.00,2026-06-11 08:00:00,openid_2000-08-16_03:30_Shanghai"
        ].join("\n")
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Import provider statement" }));

    await waitFor(() => expect(screen.getAllByText("statement_csv_from_panel").length).toBeGreaterThanOrEqual(1));
    const importRequest = vi.mocked(globalThis.fetch).mock.calls[0]?.[1] as RequestInit;
    const importBody = JSON.parse(String(importRequest.body ?? "{}")) as Record<string, unknown>;
    expect(importBody).toMatchObject({
      provider: "wechat_pay_reserved",
      statement_id: "statement_csv_from_panel",
      period_start: "2026-06-11",
      period_end: "2026-06-11"
    });
    expect(importBody).toHaveProperty("csv");
    expect(importBody).not.toHaveProperty("rows");
    expect(importBody).not.toHaveProperty("auth");
    expect((screen.getByLabelText("Statement rows CSV") as HTMLTextAreaElement).value).toContain("provider_txn_example");
    expect(document.body.textContent).not.toMatch(/2000-08-16|03:30|Shanghai|openid/);
  });
});
