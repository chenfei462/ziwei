import type { Metadata } from "next";
import { SupportForm } from "./SupportForm.js";

export const metadata: Metadata = {
  title: "客服与反馈",
  description: "提交支付、报告、权益、退款、隐私删除和内容反馈问题。"
};

export default function SupportPage() {
  return (
    <main className="public-page public-form-page">
      <header className="public-nav" aria-label="主导航">
        <a className="brand-mark" href="/">
          紫微星垣
        </a>
        <nav>
          <a href="/chart/new">创建命盘</a>
          <a href="/account">注册/登录</a>
          <a href="/member">会员中心</a>
          <a href="/orders">订单</a>
          <a href="/legal/privacy">隐私政策</a>
        </nav>
      </header>
      <section className="public-page-heading">
        <p className="public-kicker">客服与反馈</p>
        <h1>处理订单、报告、权益和隐私问题</h1>
        <p>客服工单会持久保存并进入后台处理。请不要提交完整出生日期、出生时间、精确地点或真实身份证明。</p>
      </section>
      <SupportForm />
      <section className="public-note">
        <h2>处理范围</h2>
        <p>支持支付失败、权益未到账、退款申请、内容反馈、隐私删除、账号注销和一般问题。关键操作会写入后台审计记录，删除或注销完成前需要后台二次确认。</p>
        <p>正式上线后需在本页补充人工客服时间、企业主体、联系电话或企业微信二维码。未配置前客服仅作为工单入口。</p>
      </section>
    </main>
  );
}
