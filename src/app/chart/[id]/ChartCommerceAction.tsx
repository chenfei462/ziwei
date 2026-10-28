"use client";

import { ReceiptText } from "lucide-react";
import { useState } from "react";
import type { CheckoutSession, Order } from "../../../types.js";

type ChartCommerceActionProps = {
  reportId: string;
};

const consent = {
  agreed: true,
  service_terms: true,
  privacy_policy: true,
  refund_policy: true,
  cultural_entertainment_only: true
};

export function ChartCommerceAction({ reportId }: ChartCommerceActionProps) {
  const [status, setStatus] = useState<string>("报告权益可选");
  const [isLoading, setIsLoading] = useState(false);

  async function createOrder() {
    setIsLoading(true);
    try {
      const orderResponse = await fetch("/api/order/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          report_id: reportId,
          package_id: "single_report",
          tier_id: "standard_49",
          consent
        })
      });
      const order = (await orderResponse.json()) as Order & { error?: { message?: string } };
      if (!orderResponse.ok) throw new Error(order.error?.message ?? "订单创建失败。");

      const checkoutResponse = await fetch("/api/checkout/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          order_id: order.order_id,
          provider: "stripe_checkout",
          success_url: `${window.location.origin}/commercial/success`,
          cancel_url: `${window.location.origin}/commercial/cancel`
        })
      });
      const checkout = (await checkoutResponse.json()) as CheckoutSession & { error?: { message?: string } };
      if (!checkoutResponse.ok) throw new Error(checkout.error?.message ?? "支付会话创建失败。");
      setStatus(`订单已创建：${order.status}，支付模式：${checkout.provider_mode}`);
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "订单创建失败。");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="public-action-card">
      <button disabled={isLoading} onClick={createOrder} type="button">
        <ReceiptText aria-hidden="true" size={17} />
        {isLoading ? "创建订单中" : "创建付费报告订单"}
      </button>
      <p>{status}</p>
    </div>
  );
}
