"use client";

import { ReceiptText } from "lucide-react";
import { useState } from "react";
import type { CheckoutSession, Order, PaymentProvider, ReportDraft, ReportDraftRequest, ReportTierId } from "../../../types.js";

type ReportPurchaseActionProps = {
  reportId?: string;
  reportRequest?: ReportDraftRequest;
};

const consent = {
  agreed: true,
  service_terms: true,
  privacy_policy: true,
  refund_policy: true,
  cultural_entertainment_only: true
} as const;

const tierOptions: Array<{ tierId: ReportTierId; label: string; paymentNote: string; provider: PaymentProvider }> = [
  { tierId: "standard_49", label: "解锁标准报告 49 元", paymentNote: "微信沙箱验证，正式收款需商户配置", provider: "wechat_pay_reserved" },
  { tierId: "premium_99", label: "解锁高级报告 99 元", paymentNote: "支付宝沙箱验证，正式收款需商户配置", provider: "alipay_reserved" }
];

export function ReportPurchaseAction({ reportId, reportRequest }: ReportPurchaseActionProps) {
  const [checkout, setCheckout] = useState<CheckoutSession | undefined>();
  const [generatedReportId, setGeneratedReportId] = useState<string | undefined>();
  const [status, setStatus] = useState(
    reportId ? "选择报告版本后创建安全结账页。" : "选择报告版本后生成报告摘要并创建安全结账页。"
  );
  const [isLoading, setIsLoading] = useState<ReportTierId | undefined>();

  async function startCheckout(tierId: ReportTierId, provider: PaymentProvider) {
    setIsLoading(tierId);
    setCheckout(undefined);
    setStatus(reportId || generatedReportId ? "正在创建订单。" : "正在生成报告摘要。");
    try {
      const resolvedReportId = await resolveReportId();
      setStatus("正在创建订单。");
      const orderResponse = await fetch("/api/order/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          report_id: resolvedReportId,
          package_id: "single_report",
          tier_id: tierId,
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
          provider,
          success_url: `${window.location.origin}/commercial/success?order_id=${encodeURIComponent(order.order_id)}`,
          cancel_url: `${window.location.origin}/commercial/cancel?order_id=${encodeURIComponent(order.order_id)}`
        })
      });
      const nextCheckout = (await checkoutResponse.json()) as CheckoutSession & { error?: { message?: string } };
      if (!checkoutResponse.ok) throw new Error(nextCheckout.error?.message ?? "支付会话创建失败。");
      setCheckout(nextCheckout);
      setStatus(nextCheckout.provider_mode === "sandbox" ? "沙箱模式" : "生产支付模式");
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "支付会话创建失败。");
    } finally {
      setIsLoading(undefined);
    }
  }

  async function resolveReportId(): Promise<string> {
    if (generatedReportId) return generatedReportId;
    if (reportId) return reportId;
    if (!reportRequest) throw new Error("缺少报告生成请求。");

    const draftResponse = await fetch("/api/report/draft", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(reportRequest)
    });
    const draft = (await draftResponse.json()) as ReportDraft & { error?: { message?: string } };
    if (!draftResponse.ok) throw new Error(draft.error?.message ?? "报告摘要生成失败。");
    setGeneratedReportId(draft.report_id);
    return draft.report_id;
  }

  const activeReportId = generatedReportId ?? reportId;

  return (
    <div className="public-action-card">
      <div className="public-action-row" aria-label="购买完整报告">
        {tierOptions.map((option) => (
          <button
            disabled={Boolean(isLoading)}
            key={option.tierId}
            onClick={() => void startCheckout(option.tierId, option.provider)}
            type="button"
          >
            <ReceiptText aria-hidden="true" size={17} />
            {isLoading === option.tierId ? "创建中" : option.label}
            <span>{option.paymentNote}</span>
          </button>
        ))}
      </div>
      <p>{status}</p>
      {checkout ? (
        <a className="public-primary-link" href={checkout.checkout_url}>
          前往支付
        </a>
      ) : null}
      {activeReportId ? <a href={`/report/${activeReportId}`}>查看完整报告</a> : null}
    </div>
  );
}
