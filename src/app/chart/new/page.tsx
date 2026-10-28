import type { Metadata } from "next";
import { PublicChartForm } from "./PublicChartForm.js";

export const metadata: Metadata = {
  title: "生成观察卡",
  description: "填写必要资料，生成隐私友好的星垣观察卡，并可继续生成今日星垣卡与 7 日挑战。"
};

export default function NewChartPage() {
  return (
    <main className="public-page public-form-page">
      <header className="public-nav" aria-label="主导航">
        <a className="brand-mark" href="/">
          紫微星垣
        </a>
        <nav>
          <a href="/account">注册/登录</a>
          <a href="/legal/privacy">隐私说明</a>
        </nav>
      </header>
      <section className="public-page-heading">
        <p className="public-kicker">生成观察卡</p>
        <h1>填写基础资料</h1>
        <p>这些资料仅用于生成你的私有观察卡。公开分享页默认隐藏完整出生日期、时间、精确地点和真实身份信息。</p>
      </section>
      <PublicChartForm />
    </main>
  );
}
