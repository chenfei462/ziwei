import type { Metadata } from "next";
import { cookies } from "next/headers.js";
import { getCommerceSubjectId, memberCookieName, normalizeIdentity, visitorCookieName } from "../../auth.js";
import { getMemberEntitlements } from "../../phase9/commerce.js";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "会员中心",
  description: "查看报告权益、会员状态、隐私政策、客服和数据删除入口。"
};

export default async function MemberPage() {
  const cookieStore = await cookies();
  const identity = normalizeIdentity({
    visitorId: cookieStore.get(visitorCookieName)?.value,
    memberId: cookieStore.get(memberCookieName)?.value
  });
  const memberId = getCommerceSubjectId(identity);
  const member = getMemberEntitlements(memberId);

  return (
    <main className="public-page">
      <header className="public-nav" aria-label="主导航">
        <a className="brand-mark" href="/">
          紫微星垣
        </a>
        <nav>
          <a href="/chart/new">创建命盘</a>
          <a href="/account">注册/登录</a>
          <a href="/orders">订单</a>
          <a href="/support">客服</a>
        </nav>
      </header>
      <section className="public-page-heading">
        <p className="public-kicker">会员中心</p>
        <h1>报告权益和隐私管理</h1>
        <p>当前身份：{memberId}。已购买报告、会员权益和客服处理记录会持久保存，并且只允许当前身份访问。</p>
      </section>
      <section className="public-member-grid">
        <article>
          <h2>权益</h2>
          <p>已购报告：{member.purchased_report_ids.length}</p>
          <p>轻会员：{member.light_membership_active ? "已开通" : "未开通"}</p>
          <a href="/orders">查看订单</a>
        </article>
        <article>
          <h2>报告入口</h2>
          {member.entitlements.length ? (
            member.entitlements.map((item) => (
              <a key={item.entitlement_id} href={`/report/${item.report_id}`}>
                {item.report_id}
              </a>
            ))
          ) : (
            <p>暂无可访问报告。</p>
          )}
        </article>
        <article>
          <h2>隐私和删除</h2>
          <p>公开分享页不展示完整出生资料。你可以通过客服提交隐私删除、账号注销、退款、权益补发或内容反馈请求；删除和注销处理会进入后台状态机并保留审计轨迹。</p>
          <a href="/support">提交请求</a>
          <a href="/legal/privacy">查看隐私政策</a>
        </article>
      </section>
    </main>
  );
}
