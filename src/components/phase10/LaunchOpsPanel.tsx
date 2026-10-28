"use client";

import { BadgeCheck, Eye, FileSearch, GitBranch, Headset, ReceiptText, RotateCcw, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { opsSensitiveRecordTypes } from "../../types.js";
import type {
  AdminAuditLog,
  LaunchOperationsDashboard,
  OpsAdminAuditListResponse,
  OpsOrderListResponse,
  OpsRuleProfileListResponse,
  OpsRuleProfilePromotionResponse,
  OpsRuleProfileSummary,
  OpsRefundResponse,
  OpsSensitiveRecordRevealResponse,
  OpsSensitiveRecordType,
  Order,
  SupportTicket
} from "../../types.js";

type LaunchOpsPanelProps = {
  initialDashboard: LaunchOperationsDashboard;
};

export function LaunchOpsPanel({ initialDashboard }: LaunchOpsPanelProps) {
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [ticket, setTicket] = useState<SupportTicket | undefined>();
  const [refund, setRefund] = useState<OpsRefundResponse | undefined>();
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [sensitiveReveal, setSensitiveReveal] = useState<OpsSensitiveRecordRevealResponse | undefined>();
  const [ruleProfiles, setRuleProfiles] = useState<OpsRuleProfileSummary[]>([]);
  const [activeRuleProfileId, setActiveRuleProfileId] = useState("");
  const [selectedRuleProfileId, setSelectedRuleProfileId] = useState("");
  const [rulePromotionReason, setRulePromotionReason] = useState("");
  const [rulePromotionConfirmed, setRulePromotionConfirmed] = useState(false);
  const [rulePromotionAudit, setRulePromotionAudit] = useState<AdminAuditLog | undefined>();
  const [sensitiveRecordType, setSensitiveRecordType] = useState<OpsSensitiveRecordType>("order");
  const [sensitiveRecordId, setSensitiveRecordId] = useState("");
  const [revealReason, setRevealReason] = useState("");
  const [revealTicketId, setRevealTicketId] = useState("");
  const [secondConfirmed, setSecondConfirmed] = useState(false);
  const [supportMessage, setSupportMessage] = useState("Refund request after paid report access.");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isHydrated, setIsHydrated] = useState(false);

  const opsFetchOptions = {
    credentials: "same-origin" as const
  };

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    void loadOrders();
  }, [isHydrated]);

  useEffect(() => {
    if (!sensitiveRecordId && selectedOrderId) {
      setSensitiveRecordId(selectedOrderId);
    }
  }, [selectedOrderId, sensitiveRecordId]);

  async function loadOrders() {
    setError(undefined);
    try {
      const response = await fetch("/api/ops/orders?status=fulfilled", opsFetchOptions);
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
    const response = await fetch("/api/ops/launch/dashboard", opsFetchOptions);
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
      const response = await fetch(`/api/ops/order/${order.order_id}/support-ticket`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
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
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
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
      const ticketResponse = await fetch(`/api/ops/support/ticket/${ticket.ticket_id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
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

  async function loadAuditLogs() {
    setError(undefined);
    try {
      const response = await fetch("/api/ops/audit-logs", opsFetchOptions);
      const payload = (await response.json()) as OpsAdminAuditListResponse | { error?: { message?: string } };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error?.message : "Audit log lookup failed.");
      }
      setAuditLogs((payload as OpsAdminAuditListResponse).logs);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Audit log lookup failed.");
    }
  }

  async function revealSensitiveRecord() {
    if (!sensitiveRecordId.trim() || !revealReason.trim() || !secondConfirmed || isLoading) return;
    setIsLoading(true);
    setError(undefined);
    try {
      const response = await fetch("/api/ops/sensitive-record", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          record_type: sensitiveRecordType,
          record_id: sensitiveRecordId.trim(),
          reason: revealReason.trim(),
          second_confirmed: secondConfirmed,
          ...(revealTicketId.trim() ? { ticket_id: revealTicketId.trim() } : {})
        })
      });
      const payload = (await response.json()) as OpsSensitiveRecordRevealResponse | { error?: { message?: string } };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error?.message : "Sensitive record reveal failed.");
      }
      setSensitiveReveal(payload as OpsSensitiveRecordRevealResponse);
      await loadAuditLogs();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sensitive record reveal failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadRuleProfiles() {
    setError(undefined);
    try {
      const response = await fetch("/api/ops/rule-profiles", opsFetchOptions);
      const payload = (await response.json()) as OpsRuleProfileListResponse | { error?: { message?: string } };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error?.message : "Rule profile lookup failed.");
      }
      const rulePayload = payload as OpsRuleProfileListResponse;
      setRuleProfiles(rulePayload.profiles);
      setActiveRuleProfileId(rulePayload.active_default_profile_id);
      setSelectedRuleProfileId((current) => current || rulePayload.active_default_profile_id || rulePayload.profiles[0]?.profile_id || "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Rule profile lookup failed.");
    }
  }

  async function promoteRuleProfile() {
    if (!selectedRuleProfileId || !rulePromotionReason.trim() || !rulePromotionConfirmed || isLoading) return;
    setIsLoading(true);
    setError(undefined);
    try {
      const response = await fetch("/api/ops/rule-profiles/default", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          profile_id: selectedRuleProfileId,
          reason: rulePromotionReason.trim(),
          second_confirmed: rulePromotionConfirmed
        })
      });
      const payload = (await response.json()) as OpsRuleProfilePromotionResponse | { error?: { message?: string } };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error?.message : "Rule profile promotion failed.");
      }
      const promoted = payload as OpsRuleProfilePromotionResponse;
      setActiveRuleProfileId(promoted.active_default_profile_id);
      setRulePromotionAudit(promoted.audit_log);
      setRuleProfiles((current) =>
        current.map((profile) => ({
          ...profile,
          is_active_default: profile.profile_id === promoted.active_default_profile_id
        }))
      );
      setRulePromotionReason("");
      setRulePromotionConfirmed(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Rule profile promotion failed.");
    } finally {
      setIsLoading(false);
    }
  }

  const selectedOrder = orders.find((order) => order.order_id === selectedOrderId);
  const revealDisabled = !isHydrated || isLoading || !sensitiveRecordId.trim() || !revealReason.trim() || !secondConfirmed;
  const selectedRuleProfile = ruleProfiles.find((profile) => profile.profile_id === selectedRuleProfileId);
  const rulePromotionDisabled =
    !isHydrated ||
    isLoading ||
    !selectedRuleProfileId ||
    !selectedRuleProfile?.can_promote_to_default ||
    !rulePromotionReason.trim() ||
    !rulePromotionConfirmed;

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

      <div className="phase10-subsection">
        <div className="panel-title-row">
          <GitBranch aria-hidden="true" size={18} />
          <h3>Rule Version Control</h3>
        </div>
        <p className="muted">Rule defaults affect new chart creation. Promotion requires an ops_admin role, consultant-confirmed status, second confirmation, and audit logging.</p>

        <div className="phase10-action-row">
          <button disabled={!isHydrated || isLoading} onClick={loadRuleProfiles} type="button">
            <GitBranch aria-hidden="true" size={15} />
            Load rule profiles
          </button>
          <button disabled={rulePromotionDisabled} onClick={promoteRuleProfile} type="button">
            <ShieldCheck aria-hidden="true" size={15} />
            Promote rule default
          </button>
        </div>

        <div className="phase10-grid">
          <label>
            Rule profile
            <select value={selectedRuleProfileId} onChange={(event) => setSelectedRuleProfileId(event.target.value)}>
              {ruleProfiles.length > 0 ? (
                ruleProfiles.map((profile) => (
                  <option key={profile.profile_id} value={profile.profile_id}>
                    {profile.profile_id}
                  </option>
                ))
              ) : (
                <option value="">Load profiles first</option>
              )}
            </select>
          </label>
          <label>
            Promotion reason
            <textarea value={rulePromotionReason} onChange={(event) => setRulePromotionReason(event.target.value)} />
          </label>
          <label className="phase10-confirm-row">
            <input checked={rulePromotionConfirmed} onChange={(event) => setRulePromotionConfirmed(event.target.checked)} type="checkbox" />
            Confirm rule promotion
          </label>
        </div>

        <div aria-label="Rule profile list" className="phase10-audit-list">
          {ruleProfiles.length > 0 ? (
            ruleProfiles.map((profile) => (
              <div className="phase10-audit-row" key={profile.profile_id}>
                <span>{profile.profile_id}</span>
                <span>{profile.version_id}</span>
                <span>{profile.consultant_review_status}</span>
                <span>{profile.is_active_default || profile.profile_id === activeRuleProfileId ? "active_default" : "candidate"}</span>
                <span>{profile.can_promote_to_default ? "promotable" : "blocked"}</span>
              </div>
            ))
          ) : (
            <p className="muted">No rule profiles loaded.</p>
          )}
        </div>

        {rulePromotionAudit ? (
          <div className="phase10-result">
            <span>{rulePromotionAudit.audit_log_id}</span>
            <span>{rulePromotionAudit.action}</span>
            <span>{rulePromotionAudit.target_id ?? "none"}</span>
          </div>
        ) : null}
      </div>

      <div className="phase10-subsection">
        <div className="panel-title-row">
          <ShieldCheck aria-hidden="true" size={18} />
          <h3>Sensitive Record Review</h3>
        </div>
        <p className="muted">Full detail access requires an ops_admin role, a specific reason, second confirmation, and an immutable audit log.</p>

        <div className="phase10-grid">
          <label>
            Sensitive record type
            <select value={sensitiveRecordType} onChange={(event) => setSensitiveRecordType(event.target.value as OpsSensitiveRecordType)}>
              {opsSensitiveRecordTypes.map((recordType) => (
                <option key={recordType} value={recordType}>
                  {recordType}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sensitive record ID
            <input value={sensitiveRecordId} onChange={(event) => setSensitiveRecordId(event.target.value)} placeholder="order_ / chart_ / report_" />
          </label>
          <label>
            Reveal reason
            <textarea value={revealReason} onChange={(event) => setRevealReason(event.target.value)} />
          </label>
          <label>
            Support ticket ID
            <input value={revealTicketId} onChange={(event) => setRevealTicketId(event.target.value)} placeholder="optional ticket_" />
          </label>
          <label className="phase10-confirm-row">
            <input checked={secondConfirmed} onChange={(event) => setSecondConfirmed(event.target.checked)} type="checkbox" />
            Second confirmation
          </label>
        </div>

        <div className="phase10-action-row">
          <button disabled={!isHydrated || isLoading} onClick={loadAuditLogs} type="button">
            <FileSearch aria-hidden="true" size={15} />
            Load audit logs
          </button>
          <button disabled={revealDisabled} onClick={revealSensitiveRecord} type="button">
            <Eye aria-hidden="true" size={15} />
            Reveal sensitive detail
          </button>
        </div>

        {sensitiveReveal ? (
          <div aria-label="Sensitive reveal result" className="phase10-sensitive-detail">
            <div className="phase10-result">
              <span>{sensitiveReveal.record_type}</span>
              <span>{sensitiveReveal.record_id}</span>
              <span>{sensitiveReveal.audit_log.audit_log_id}</span>
            </div>
            <pre>{JSON.stringify(sensitiveReveal.record, null, 2)}</pre>
          </div>
        ) : null}

        <div aria-label="Admin audit logs" className="phase10-audit-list">
          {auditLogs.length > 0 ? (
            auditLogs.map((log) => (
              <div className="phase10-audit-row" key={log.audit_log_id}>
                <span>{log.audit_log_id}</span>
                <span>{log.action}</span>
                <span>
                  {log.target_type}:{log.target_id ?? "none"}
                </span>
                <span>{formatAuditMetadata(log.metadata)}</span>
              </div>
            ))
          ) : (
            <p className="muted">No audit logs loaded.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function formatAuditMetadata(metadata: AdminAuditLog["metadata"]): string {
  return Object.entries(metadata)
    .map(([key, value]) => `${key}:${String(value)}`)
    .join(" | ");
}
