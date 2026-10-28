"use client";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import type { PaymentEvent } from "../../../types.js";

type SandboxCheckoutConfirmProps = {
  sessionId?: string;
  successUrl: string;
};

export function SandboxCheckoutConfirm({ sessionId, successUrl }: SandboxCheckoutConfirmProps) {
  const [event, setEvent] = useState<PaymentEvent | undefined>();
  const [status, setStatus] = useState(sessionId ? "服务端确认后发放报告权益。" : "缺少结账会话，无法确认沙箱支付。");
  const [isLoading, setIsLoading] = useState(false);

  async function confirmCheckout() {
    if (!sessionId || isLoading) return;
    setIsLoading(true);
    setStatus("正在确认支付结果。");
    try {
      const response = await fetch("/api/checkout/sandbox/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_id: sessionId })
      });
      const payload = (await response.json()) as PaymentEvent & { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "沙箱支付确认失败。");
      setEvent(payload);
      setStatus(payload.order.status === "fulfilled" ? "权益已发放" : `订单状态：${payload.order.status}`);
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "沙箱支付确认失败。");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="public-action-card">
      <button disabled={!sessionId || isLoading} onClick={() => void confirmCheckout()} type="button">
        <CheckCircle2 aria-hidden="true" size={17} />
        {isLoading ? "确认中" : "确认沙箱支付"}
      </button>
      <p>{status}</p>
      {event?.order.status === "fulfilled" ? (
        <a className="public-primary-link" href={successUrl}>
          返回支付成功页
        </a>
      ) : null}
    </div>
  );
}
