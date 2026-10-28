import type { Metadata } from "next";
import { cookies } from "next/headers.js";
import { getCommerceSubjectId, memberCookieName, normalizeIdentity, visitorCookieName } from "../../auth.js";
import { listOrders } from "../../phase9/commerce.js";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "订单记录",
  description: "查看订单状态、支付结果、退款状态和报告访问入口。"
};

export default async function OrdersPage() {
  const cookieStore = await cookies();
  const identity = normalizeIdentity({
    visitorId: cookieStore.get(visitorCookieName)?.value,
    memberId: cookieStore.get(memberCookieName)?.value
  });
  const memberId = getCommerceSubjectId(identity);
  const { orders } = listOrders(memberId);

  return (
    <main className="public-page">
      <header className="public-nav" aria-label="主导航">
        <a className="brand-mark" href="/">
          紫微星垣
        </a>
        <nav>
          <a href="/chart/new">创建命盘</a>
          <a href="/account">注册/登录</a>
          <a href="/member">会员中心</a>
          <a href="/support">客服</a>
        </nav>
      </header>
      <section className="public-page-heading">
        <p className="public-kicker">订单记录</p>
        <h1>查看支付、退款和报告状态</h1>
        <p>订单只保存报告引用、权益状态、支付事件和必要会员标识，不在订单页展示完整出生资料。</p>
      </section>
      <section className="public-list-panel">
        {orders.length ? (
          orders.map((order) => (
            <article key={order.order_id}>
              <h2>{order.tier_id}</h2>
              <p>
                {order.status} · {order.amount_cents / 100} {order.currency.toUpperCase()}
              </p>
              <a href={`/report/${order.report_id}`}>查看报告入口</a>
            </article>
          ))
        ) : (
          <article>
            <h2>暂无订单</h2>
            <p>完成命盘解读后，可以创建付费报告订单并在这里查看状态。</p>
            <a href="/chart/new">创建命盘</a>
          </article>
        )}
      </section>
    </main>
  );
}
