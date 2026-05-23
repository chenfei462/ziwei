"use client";

import { BadgeCheck, Headset, ReceiptText, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import type { LaunchOperationsDashboard, OpsOrderListResponse, OpsRefundResponse, Order, SupportTicket } from "../../types.js";

type LaunchOpsPanelProps = {
  initialDashboard: LaunchOperationsDashboard;
};

const adminHeaders = {
  "x-admin-token": "phase10_admin_token",
  "x-admin-role": "ops_admin"
};

export function LaunchOpsPanel({ initialDashboard }: LaunchOpsPanelProps) {
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [ticket, setTicket] = useState<SupportTicket | undefined>();
  const [refund, setRefund] = useState<OpsRefundResponse | undefined>();
  const [supportMessage, setSupportMessage] = useState("Refund request after paid report access.");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    void loadOrders();
  }, [isHydrated]);

  async function loadOrders() {
    setError(undefined);
    try {
      const response = await fetch("/api/ops/orders?status=fulfilled", { headers: adminHeaders });
      const payload = (await response.json()) as OpsOrderListResponse | { error?: { message?: string } };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error?.message : "Ops order lookup failed.");
      }
      const orderPayload = payload as OpsOrderListResponse;
      setOrders(orderPayload.orders);
      setSelectedOrderId((current) => current || orderPayload.orders[0]?.order_id || "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ops order lookup failed.");
    }
  }

  async function refreshDashboard() {
    const response = await fetch("/api/launch/dashboard", { headers: adminHeaders });
    const payload = (await response.json()) as LaunchOperationsDashboard;
    if (response.ok) {
      setDashboard(payload);
    }
  }

  async function createTicket() {
    const order = orders.find((item) => item.order_id === selectedOrderId);
    if (!order || isLoading) return;
    setIsLoading(true);
    setError(undefined);
    try {
      const response = await fetch("/api/support/ticket", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          member_id: order.member_id,
          order_id: order.order_id,
          report_id: order.report_id,
          category: "refund_request",
          priority: "high",
          subject: "Manual refund review",
          message: supportMessage,
          consent: {
            agreed: true,
            no_sensitive_birth_data: true
          }
        })
      });
      const payload = (await response.json()) as SupportTicket | { error?: { message?: string } };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error?.message : "Support ticket failed.");
      }
      setTicket(payload as SupportTicket);
      setSupportMessage("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Support ticket failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function markRefund() {
    if (!selectedOrderId || !ticket || isLoading) return;
    setIsLoading(true);
    setError(undefined);
    try {
      const response = await fetch(`/api/ops/order/${selectedOrderId}/refund`, {
        method: "POST",
        headers: { ...adminHeaders, "content-type": "application/json" },
        body: JSON.stringify({
          ticket_id: ticket.ticket_id,
          reason: "manual refund after support review"
        })
      });
      const payload = (await response.json()) as OpsRefundResponse | { error?: { message?: string } };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error?.message : "Manual refund failed.");
      }
      const refundPayload = payload as OpsRefundResponse;
      setRefund(refundPayload);
      setOrders((current) => current.map((order) => (order.order_id === refundPayload.order.order_id ? refundPayload.order : order)));
      const ticketResponse = await fetch(`/api/support/ticket/${ticket.ticket_id}`, {
        method: "PATCH",
        headers: { ...adminHeaders, "content-type": "application/json" },
        body: JSON.stringify({
          status: "resolved",
          assignee: "ops_lead",
          note: "Refund marked."
        })
      });
      const ticketPayload = (await ticketResponse.json()) as SupportTicket;
      if (ticketResponse.ok) {
        setTicket(ticketPayload);
      }
      await refreshDashboard();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Manual refund failed.");
    } finally {
      setIsLoading(false);
    }
  }

  const selectedOrder = orders.find((order) => order.order_id === selectedOrderId);

  return (
    <section className="phase10-panel">
      <div className="panel-title-row">
        <BadgeCheck aria-hidden="true" size={18} />
        <h2>Launch Ops Console</h2>
      </div>
      <p className="muted">Production launch controls remain gated. This console uses sanitized order, ticket, entitlement, and risk data.</p>

      <div className="phase10-metric-row">
        <span>{dashboard.launch_config.public_status}</span>
        <span>rollout {dashboard.launch_config.rollout_percent}%</span>
        <span>refund_rate {Math.round(dashboard.risk.refund_rate * 100)}%</span>
        <span>privacy_scan {dashboard.risk.privacy_scan_violations}</span>
        <span>support_resolved {dashboard.support.resolved_tickets}</span>
      </div>

      <div className="phase10-grid">
        <label>
          Fulfilled order
          <select value={selectedOrderId} onChange={(event) => setSelectedOrderId(event.target.value)}>
            {orders.map((order) => (
              <option key={order.order_id} value={order.order_id}>
                {order.order_id}
              </option>
            ))}
          </select>
        </label>
        <label>
          Support message
          <textarea value={supportMessage} onChange={(event) => setSupportMessage(event.target.value)} />
        </label>
      </div>

      <div className="phase10-action-row">
        <button disabled={!isHydrated || isLoading} onClick={loadOrders} type="button">
          <ReceiptText aria-hidden="true" size={15} />
          Load ops orders
        </button>
        <button disabled={!isHydrated || !selectedOrder || isLoading} onClick={createTicket} type="button">
          <Headset aria-hidden="true" size={15} />
          Create support ticket
        </button>
        <button disabled={!isHydrated || !selectedOrder || !ticket || isLoading} onClick={markRefund} type="button">
          <RotateCcw aria-hidden="true" size={15} />
          Mark manual refund
        </button>
      </div>

      {error ? <p className="error-message">{error}</p> : null}

      {selectedOrder ? (
        <div className="phase10-result">
          <span>{selectedOrder.order_id}</span>
          <span>{selectedOrder.status}</span>
          <span>{selectedOrder.tier_id}</span>
          <span>{selectedOrder.amount_cents / 100} CNY</span>
        </div>
      ) : null}

      {ticket ? (
        <div className="phase10-result">
          <span>{ticket.ticket_id}</span>
          <span>{ticket.category}</span>
          <span>{ticket.status}</span>
        </div>
      ) : null}

      {refund ? (
        <div className="phase10-result">
          <span>{refund.order.status}</span>
          <span>{refund.note.action}</span>
          <span>{refund.note.note}</span>
        </div>
      ) : null}
    </section>
  );
}
