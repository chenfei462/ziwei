import type { Metadata } from "next";
import { AccountUpgradeForm } from "./AccountUpgradeForm.js";

export const metadata: Metadata = {
  title: "注册/登录 | 紫微星垣",
  description: "使用手机号验证码登录，把匿名体验升级为正式账号，并迁移已创建的命盘、报告、订单和会员权益。"
};

export default function AccountPage() {
  return (
    <main className="public-page public-form-page">
      <header className="public-nav" aria-label="主导航">
        <a className="brand-mark" href="/">
          紫微星垣
        </a>
        <nav>
          <a href="/chart/new">创建命盘</a>
          <a href="/member">会员中心</a>
          <a href="/orders">订单</a>
          <a href="/support">客服</a>
        </nav>
      </header>
      <section className="public-page-heading">
        <p className="public-kicker">账号</p>
        <h1>匿名体验可以继续，登录后方便找回和复看</h1>
        <p>你可以先匿名创建命盘；完成手机号验证码登录后，当前设备下的命盘、报告、订单和权益会归并到账号身份。</p>
      </section>
      <AccountUpgradeForm />
      <section className="public-note">
        <h2>账号与隐私边界</h2>
        <p>账号记录只保存手机号或邮箱的哈希值，不保存明文联系方式。登录会话使用 HttpOnly cookie；配置生产密钥后会话 cookie 会进行服务端签名校验。</p>
      </section>
    </main>
  );
}
