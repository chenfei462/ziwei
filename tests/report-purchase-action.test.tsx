// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ReportPurchaseAction } from "../src/app/report/[id]/ReportPurchaseAction.js";

const order = {
  order_id: "order_purchase_component",
  status: "created",
  tier_id: "standard_49",
  amount_cents: 4900
};

const checkout = {
  checkout_session_id: "cs_purchase_component",
  provider: "wechat_pay_reserved",
  provider_mode: "sandbox",
  checkout_url: "/commercial/checkout-sandbox?session_id=cs_purchase_component&order_id=order_purchase_component",
  provider_requirements: {
    webhook_secret_env: "WECHAT_PAY_API_V3_KEY",
    signature_header: "wechatpay-signature",
    idempotency_key_source: "provider_event_id"
  }
};

describe("report purchase action", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("creates an order, opens a China-market checkout session, and exposes the payment link", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => order } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => checkout } as Response);

    render(<ReportPurchaseAction reportId="report_purchase_component" />);

    expect(screen.getByRole("button", { name: /解锁标准报告 49 元/ })).toHaveTextContent("微信沙箱验证，正式收款需商户配置");
    expect(screen.getByRole("button", { name: /解锁高级报告 99 元/ })).toHaveTextContent("支付宝沙箱验证，正式收款需商户配置");
    fireEvent.click(screen.getByRole("button", { name: /解锁标准报告 49 元/ }));

    await waitFor(() => expect(screen.getByRole("link", { name: "前往支付" })).toHaveAttribute("href", checkout.checkout_url));
    expect(screen.getByText("沙箱模式")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/order/create",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"tier_id":"standard_49"')
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/checkout/session",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"provider":"wechat_pay_reserved"')
      })
    );
  });
});
