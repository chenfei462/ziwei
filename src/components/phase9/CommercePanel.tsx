"use client";

import { CreditCard, FileCheck2, ReceiptText, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import type { CheckoutSession, MemberEntitlement, Order, PaymentEvent, ReportDraft, ReportTierId } from "../../types.js";

type CommercePanelProps = {
  initialReport: ReportDraft;
  memberId?: string;
};

const consent = {
  agreed: true,
  service_terms: true,
  privacy_policy: true,
  refund_policy: true,
  cultural_entertainment_only: true
} as const;

export function CommercePanel({ initialReport, memberId = "member_demo" }: CommercePanelProps) {
  const [tierId, setTierId] = useState<ReportTierId>(initialReport.price_tier_hint);
  const [order, setOrder] = useState<Order | undefined>();
  const [checkout, setCheckout] = useState<CheckoutSession | undefined>();
  const [paymentEvent, setPaymentEvent] = useState<PaymentEvent | undefined>();
  const [entitlement, setEntitlement] = useState<MemberEntitlement | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  async function createOrder() {
    if (!isHydrated || isLoading) return;
    setIsLoading(true);
    setError(undefined);
    try {
      const response = await fetch("/api/order/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          report_id: initialReport.report_id,
          package_id: "single_report",
          tier_id: tierId,
          member_id: memberId,
          consent
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Order creation failed.");
      }
      setOrder(payload as Order);
      setCheckout(undefined);
      setPaymentEvent(undefined);
      setEntitlement(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Order creation failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function createCheckout() {
    if (!isHydrated || !order || isLoading) return;
    setIsLoading(true);
    setError(undefined);
    try {
      const response = await fetch("/api/checkout/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          order_id: order.order_id,
          provider: "stripe_checkout",
          success_url: `${window.location.origin}/commercial/success`,
          cancel_url: `${window.location.origin}/commercial/cancel`
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Checkout session failed.");
      }
      setCheckout(payload as CheckoutSession);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Checkout session failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function simulatePayment() {
    if (!isHydrated || !checkout?.sandbox_webhook || isLoading) return;
    setIsLoading(true);
    setError(undefined);
    try {
      const response = await fetch("/api/payment/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "stripe-signature": checkout.sandbox_webhook.signature_header
        },
        body: checkout.sandbox_webhook.raw_body
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Sandbox payment failed.");
      }
      const event = payload as PaymentEvent;
      setPaymentEvent(event);
      setOrder(event.order);

      const entitlementResponse = await fetch(`/api/entitlement/report/${initialReport.report_id}?member_id=${encodeURIComponent(memberId)}`);
      const entitlementPayload = await entitlementResponse.json();
      if (entitlementResponse.ok) {
        setEntitlement(entitlementPayload as MemberEntitlement);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sandbox payment failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="phase9-panel">
      <div className="panel-title-row">
        <CreditCard aria-hidden="true" size={18} />
        <h2>Commerce MVP</h2>
      </div>
      <p className="muted">Sandbox checkout keeps the phase 9 payment loop testable while preserving the Stripe provider boundary.</p>

      <div className="phase9-control-grid">
        <label>
          Report
          <input readOnly value={initialReport.title} />
        </label>
        <label>
          Tier
          <select onChange={(event) => setTierId(event.target.value as ReportTierId)} value={tierId}>
            <option value="starter_19">starter_19</option>
            <option value="standard_49">standard_49</option>
            <option value="premium_99">premium_99</option>
          </select>
        </label>
      </div>

      <div className="phase9-compliance">
        <span>service_terms</span>
        <span>privacy_policy</span>
        <span>refund_policy</span>
        <span>cultural_entertainment_only</span>
      </div>

      <div className="phase9-action-row">
        <button disabled={!isHydrated || isLoading} onClick={createOrder} type="button">
          <ReceiptText aria-hidden="true" size={15} />
          Create order
        </button>
        <button disabled={!isHydrated || !order || isLoading} onClick={createCheckout} type="button">
          <ShieldCheck aria-hidden="true" size={15} />
          Create checkout session
        </button>
        <button disabled={!isHydrated || !checkout?.sandbox_webhook || isLoading} onClick={simulatePayment} type="button">
          <FileCheck2 aria-hidden="true" size={15} />
          Simulate sandbox payment
        </button>
      </div>

      {error ? <p className="error-message">{error}</p> : null}

      {order ? (
        <div className="phase9-result">
          <span>{order.status}</span>
          <span>{order.tier_id}</span>
          <span>{order.amount_cents / 100} CNY</span>
        </div>
      ) : null}

      {checkout ? (
        <div className="phase9-result">
          <span>{checkout.provider}</span>
          <span>{checkout.provider_mode}</span>
          <span>{checkout.checkout_session_id}</span>
        </div>
      ) : null}

      {paymentEvent ? (
        <div className="phase9-result">
          <span>{paymentEvent.event_type}</span>
          <span>payment_order_{paymentEvent.order.status}</span>
          <span>{paymentEvent.signature_verified ? "signature_verified" : "signature_missing"}</span>
        </div>
      ) : null}

      {entitlement?.has_access ? (
        <div className="phase9-access">
          <strong>Access granted</strong>
          <span>My reports</span>
          <span>{entitlement.export_preview_credits} export previews</span>
          <small>{entitlement.privacy_note}</small>
        </div>
      ) : null}
    </section>
  );
}
