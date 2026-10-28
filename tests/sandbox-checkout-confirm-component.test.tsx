// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SandboxCheckoutConfirm } from "../src/app/commercial/checkout-sandbox/SandboxCheckoutConfirm.js";

const paymentEvent = {
  payment_event_id: "wechat_pay_reserved:wx_evt_component",
  provider: "wechat_pay_reserved",
  event_type: "checkout.session.completed",
  checkout_session_id: "cs_component_confirm",
  order_id: "order_component_confirm",
  received_at: "2026-06-09T00:00:00.000Z",
  signature_verified: true,
  is_duplicate: false,
  order: {
    order_id: "order_component_confirm",
    status: "fulfilled"
  }
};

describe("sandbox checkout confirmation component", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("confirms sandbox payment through a protected API and shows the success path", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({ ok: true, json: async () => paymentEvent } as Response);

    render(<SandboxCheckoutConfirm sessionId="cs_component_confirm" successUrl="/commercial/success?order_id=order_component_confirm" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "确认沙箱支付" }));
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1), { timeout: 10_000 });
    expect(await screen.findByText("权益已发放", {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "返回支付成功页" }, { timeout: 10_000 })).toHaveAttribute(
      "href",
      "/commercial/success?order_id=order_component_confirm"
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/checkout/sandbox/confirm",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ session_id: "cs_component_confirm" })
      })
    );
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain("raw_body");
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain("signature_header");
  }, 30_000);

  test("keeps confirmation unavailable until a session id is present", () => {
    render(<SandboxCheckoutConfirm successUrl="/commercial/success" />);

    expect(screen.getByRole("button", { name: "确认沙箱支付" })).toBeDisabled();
    expect(screen.getByText("缺少结账会话，无法确认沙箱支付。")).toBeInTheDocument();
  });
});
