import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import CheckoutSandboxPage from "../src/app/commercial/checkout-sandbox/page.js";

describe("commercial checkout sandbox page", () => {
  test("renders a sanitized provider test checkout page without sensitive data", async () => {
    const element = await CheckoutSandboxPage({
      searchParams: Promise.resolve({
        session_id: "cs_public_123",
        order_id: "order_public_456",
        success_url: "https://ziwei.example/commercial/success?order_id=order_public_456",
        cancel_url: "javascript:alert(1)"
      })
    });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain("沙箱结账");
    expect(markup).toContain("cs_public_123");
    expect(markup).toContain("order_public_456");
    expect(markup).toContain('href="/commercial/cancel"');
    expect(markup).not.toContain("2000-08-16");
    expect(markup).not.toContain("03:30");
    expect(markup).not.toContain("openid");
    expect(markup).not.toContain("secret");
  });

  test("does not pass the display fallback as a checkout session id", async () => {
    const element = await CheckoutSandboxPage({
      searchParams: Promise.resolve({
        success_url: "https://ziwei.example/commercial/success"
      })
    });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain("session_id：未提供");
    expect(markup).toContain("缺少结账会话，无法确认沙箱支付。");
    expect(markup).not.toContain('"sessionId":"未提供"');
  });
});
