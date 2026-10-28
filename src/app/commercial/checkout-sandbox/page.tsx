import type { Metadata } from "next";
import { SandboxCheckoutConfirm } from "./SandboxCheckoutConfirm.js";

type CheckoutSandboxPageProps = {
  searchParams: Promise<{
    session_id?: string;
    order_id?: string;
    success_url?: string;
    cancel_url?: string;
  }>;
};

export const metadata: Metadata = {
  title: "沙箱结账",
  description: "用于本地和预发的支付 provider 接入验证页。"
};

export default async function CheckoutSandboxPage({ searchParams }: CheckoutSandboxPageProps) {
  const params = await searchParams;
  const successUrl = safeReturnPath(params.success_url, "/commercial/success");
  const cancelUrl = safeReturnPath(params.cancel_url, "/commercial/cancel");
  const sessionId = sanitizeId(params.session_id);
  const orderId = sanitizeId(params.order_id);

  return (
    <main className="public-page">
      <header className="public-nav" aria-label="主导航">
        <a className="brand-mark" href="/">
          紫微星垣
        </a>
        <nav>
          <a href="/orders">订单</a>
          <a href="/support">客服</a>
        </nav>
      </header>
      <section className="public-page-heading">
        <p className="public-kicker">沙箱结账</p>
        <h1>支付接入验证</h1>
        <p>该页面只用于本地和预发接入验证。生产环境必须接入微信支付或支付宝真实网关，并以服务端 webhook 验签结果发放权益。</p>
      </section>
      <section className="public-list-panel">
        <article>
          <h2>结账会话</h2>
          <p>session_id：{sessionId ?? "未提供"}</p>
          <p>order_id：{orderId ?? "未提供"}</p>
          <p>不会在页面展示手机号、出生资料、微信身份标识、支付密钥或完整报告正文。</p>
          <SandboxCheckoutConfirm sessionId={sessionId} successUrl={successUrl} />
          <a href={cancelUrl}>取消支付</a>
        </article>
      </section>
    </main>
  );
}

function safeReturnPath(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  try {
    const url = new URL(value, "http://local");
    if (url.protocol !== "http:" && url.protocol !== "https:") return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}

function sanitizeId(value: string | undefined): string | undefined {
  const sanitized = String(value ?? "")
    .replace(/[^a-zA-Z0-9_:-]/g, "")
    .slice(0, 96);
  return sanitized || undefined;
}
