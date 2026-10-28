import { ArrowRight, ChartNoAxesCombined, ReceiptText, Share2, Sparkles } from "lucide-react";

export default function HomePage() {
  return (
    <main className="public-page">
      <header className="public-nav" aria-label="主导航">
        <a className="brand-mark" href="/">
          紫微星垣
        </a>
        <nav>
          <a href="/chart/new">生成观察卡</a>
          <a href="/account">注册/登录</a>
          <a href="/legal/privacy">隐私说明</a>
        </nav>
      </header>

      <section className="public-hero">
        <div className="hero-copy">
          <p className="public-kicker">传统文化 AI 观察卡</p>
          <h1>生成你的星垣观察卡，看见性格结构、关系模式和阶段节奏。</h1>
          <p>
            先生成一张不暴露生日的星垣观察卡，看见今日关键词、关系模式、事业节奏和规则来源，再进入 7 日星垣挑战连续记录变化。
          </p>
          <div className="hero-actions">
            <a className="public-primary-link" href="/chart/new">
              <Sparkles aria-hidden="true" size={18} />
              生成我的观察卡
              <ArrowRight aria-hidden="true" size={17} />
            </a>
            <a className="public-secondary-link" href="#example-preview">
              查看示例
            </a>
          </div>
        </div>
        <aside className="hero-result-preview" id="example-preview" aria-label="观察卡结果预览">
          <p className="preview-eyebrow">结果预览</p>
          <h2>星垣观察卡</h2>
          <p>生成后优先看到一张可分享、可复盘、可继续打卡的今日观察卡。</p>
          <div className="hero-proof-row" aria-label="可信边界">
            <span>脱敏默认开启</span>
            <span>规则可追溯</span>
            <span>高风险表达过滤</span>
            <span>7 日复访路径</span>
          </div>
          <div className="preview-focus-grid">
            <span>
              <strong>今日关键词</strong>
              <small>边界感、主动整理、低风险行动</small>
            </span>
            <span>
              <strong>关系模式</strong>
              <small>沟通习惯、支持方式、互动边界</small>
            </span>
            <span>
              <strong>事业节奏</strong>
              <small>适合推进的任务类型和节奏提醒</small>
            </span>
            <span>
              <strong>规则来源</strong>
              <small>宫位依据、规则 trace、置信提示</small>
            </span>
          </div>
        </aside>
      </section>

      <section className="public-feature-grid" aria-label="主流程">
        <article>
          <ChartNoAxesCombined aria-hidden="true" size={22} />
          <h2>性格结构</h2>
          <p>从命宫、福德等重点宫位整理稳定倾向，避免把复杂信息压成单句判断。</p>
        </article>
        <article>
          <Sparkles aria-hidden="true" size={22} />
          <h2>关系模式</h2>
          <p>围绕互动边界、沟通习惯和支持方式生成可自我观察的关系提示。</p>
        </article>
        <article>
          <Share2 aria-hidden="true" size={22} />
          <h2>阶段节奏</h2>
          <p>把当下主题拆成今日星垣卡和 7 日观察路径，帮助连续记录变化。</p>
        </article>
        <article>
          <ReceiptText aria-hidden="true" size={22} />
          <h2>脱敏分享</h2>
          <p>公开分享页默认隐藏完整出生日期、时间、地点和任何不必要的个人资料。</p>
        </article>
      </section>

      <section className="public-note">
        <h2>边界说明</h2>
        <p>
          紫微星垣不提供医疗、投资、法律、婚恋成败或灾祸预测等专业判断。解读内容仅供娱乐和自我观察参考，不作为任何专业决策依据。
        </p>
        <div>
          <a href="/legal/terms">用户协议</a>
          <a href="/legal/privacy">隐私政策</a>
        </div>
      </section>
    </main>
  );
}
