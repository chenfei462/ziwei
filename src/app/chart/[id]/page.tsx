import type { Metadata } from "next";
import { cookies } from "next/headers.js";
import { assertCanReadChartAsync, identityFromSessionCookieValues, memberCookieName, visitorCookieName } from "../../../auth.js";
import { buildChartViewModel } from "../../../phase2/chartViewModel.js";
import { interpret } from "../../../interpret.js";
import { productRepository } from "../../../repositories/productRepository.js";
import { ReportPurchaseAction } from "../../report/[id]/ReportPurchaseAction.js";
import { ChartShareAction } from "./ChartShareAction.js";
import { ChallengeAction } from "./ChallengeAction.js";
import { ReadOnlyChartBoard } from "./ReadOnlyChartBoard.js";

type ChartPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: ChartPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: "星垣观察卡",
    description: `查看星垣观察卡 ${id} 的十二宫结构化摘要、AI 转译过程、规则来源、免责声明和隐私分享入口。`
  };
}

export default async function ChartPage({ params }: ChartPageProps) {
  const { id } = await params;
  const chart = await productRepository.getChartAsync(id);
  if (!chart) {
    return (
      <main className="public-page">
        <section className="public-note">
          <h1>命盘不存在</h1>
          <p>该命盘不存在或已经过期。你可以重新创建命盘。</p>
          <a href="/chart/new">创建命盘</a>
        </section>
      </main>
    );
  }

  const cookieStore = await cookies();
  const identity = identityFromSessionCookieValues({
    visitorCookie: cookieStore.get(visitorCookieName)?.value,
    memberCookie: cookieStore.get(memberCookieName)?.value
  });
  try {
    await assertCanReadChartAsync(productRepository.getChartOwnerAsync(id), identity);
  } catch {
    return (
      <main className="public-page">
        <section className="public-note">
          <h1>无权访问该命盘</h1>
          <p>该命盘属于其他访客或账号。你可以通过公开分享链接查看脱敏内容，或重新创建自己的命盘。</p>
          <a href="/chart/new">创建命盘</a>
        </section>
      </main>
    );
  }

  const viewModel = buildChartViewModel(chart.chart, { selectedPalaceId: "life" });
  const overviewPalaces = ["life", "career", "wealth", "fortune"];
  const interpretations = overviewPalaces.map((palaceId) =>
    interpret({ chart_id: chart.chart_id, palace_id: palaceId, mode: "entertainment", include_trace: true })
  );
  return (
    <main className="public-page">
      <header className="public-nav" aria-label="主导航">
        <a className="brand-mark" href="/">
          紫微星垣
        </a>
        <nav>
          <a href="/chart/new">再建一盘</a>
          <a href="/account">注册/登录</a>
          <a href="/member">会员中心</a>
          <a href="/orders">订单</a>
        </nav>
      </header>

      <section className="public-page-heading">
          <p className="public-kicker">星垣观察卡</p>
          <h1>十二宫结构化观察</h1>
        <p>完整出生资料仅用于私有排盘。以下内容仅供娱乐和自我观察参考，不作为专业决策依据。</p>
      </section>

      <section className="public-chart-layout">
        <div>
          <ReadOnlyChartBoard viewModel={viewModel} />
        </div>
        <aside className="public-summary-panel">
          <div className="result-trust-strip" aria-label="生成结果说明">
            <strong>生成结果说明</strong>
            <span>规则版本 {chart.rule_profile_id} / {chart.rule_version}</span>
            <span>置信提示随出生资料完整度调整</span>
            <span>隐私不展示完整出生资料</span>
          </div>
          <h2>总览摘要</h2>
          <p>
            本盘基于 {chart.rule_profile_id} / {chart.rule_version} 生成。出生时间或地点未知时，系统会按降级口径生成并降低置信度。
          </p>
          <ul>
            {interpretations.slice(0, 3).map((item) => (
              <li key={item.palace_id}>{item.interpretation.basis}</li>
            ))}
          </ul>
          <div className="daily-stargarden-card">
            <h3>今天你的星垣落在哪一宫？</h3>
            <p>先生成一张不暴露生日的今日观察卡，再用 7 日星垣挑战记录连续变化。</p>
            <a className="public-primary-link" href={`/chart/${chart.chart_id}/daily`}>
              生成今日星垣卡
            </a>
          </div>
          <div className="secondary-chart-actions" aria-label="观察卡次要动作">
            <a className="public-secondary-link" href="#complete-report">
              查看完整报告
            </a>
            <div id="share-card-action">
              <ChartShareAction
                buttonLabel="生成脱敏分享"
                chartId={chart.chart_id}
                summary={interpretations[0]?.interpretation.scenario ?? "一张隐私友好的今日星垣卡。"}
                title="今日星垣卡"
              />
            </div>
          </div>
          <div className="challenge-panel-shell" aria-label="7 日星垣挑战">
            <p className="muted">加入 7 日观察，完成今日打卡后会看到 1/7 或更高进度。</p>
            <ChallengeAction chartId={chart.chart_id} />
          </div>
          <div id="complete-report" className="report-unlock-panel">
            <h3>完整报告</h3>
            <p>想继续看六宫细节、规则溯源和导出预览时，再解锁标准或高级报告。</p>
            <ReportPurchaseAction
              reportRequest={{
                report_type: "single_chart",
                chart_id: chart.chart_id,
                chart: chart.chart,
                mode: "entertainment"
              }}
            />
          </div>
        </aside>
      </section>

      <section className="public-section ai-process-section">
        <h2>AI 转译过程</h2>
        <div className="ai-process-grid">
          {interpretations.slice(0, 3).map((item) => {
            const trace = item.trace[0];
            return (
              <article key={item.palace_id}>
                <p className="public-kicker">{labelForPalace(item.palace_id)}</p>
                <dl>
                  <div>
                    <dt>传统术语</dt>
                    <dd>{trace?.source.title ?? item.interpretation.basis}</dd>
                  </div>
                  <div>
                    <dt>规则来源</dt>
                    <dd>{trace?.rule_id ?? "本地规则 trace"}</dd>
                  </div>
                  <div>
                    <dt>现代解释</dt>
                    <dd>{trace?.source.modern_translation ?? item.interpretation.interpretation}</dd>
                  </div>
                  <div>
                    <dt>安全过滤</dt>
                    <dd>已过滤医疗、投资、法律、婚恋成败、灾祸预测等高风险表达。</dd>
                  </div>
                </dl>
                <strong>{confidenceLabel(item.interpretation.confidence)}</strong>
              </article>
            );
          })}
        </div>
      </section>

      <section className="public-section ai-process-section">
        <h2>AI 生成说明</h2>
        <div className="ai-generation-note">
          <p><strong>AI 参与</strong> 本页内容由本地规则 trace 生成，并由 AI/本地模板转写为现代语言。</p>
          <p><strong>依据范围</strong> 仅引用当前命盘命中的规则来源、宫位结构和追问主题。</p>
          <p><strong>版本</strong> 规则 {chart.rule_profile_id}/{chart.rule_version}；Prompt followup_v0.1；报告 v0.1</p>
          <p><strong>生成状态</strong> AI 改写成功；模型不可用时会回退本地规则模板。</p>
          <p><strong>安全边界</strong> 已过滤医疗、投资、法律、婚恋成败、灾祸预测等高风险表达。</p>
          <p><strong>隐私说明</strong> 公开页面不展示完整出生日期、出生时间、精确地点、真实身份或原始 prompt。</p>
        </div>
        <div className="ai-followup-row">
          <button type="button">基于规则追问：事业节奏</button>
          <button type="button">基于规则追问：关系模式</button>
          <button type="button">基于规则追问：财务习惯</button>
        </div>
      </section>

      <section className="public-section">
        <h2>重点提示</h2>
        <div className="public-tip-grid">
          {interpretations.map((item) => (
            <article key={item.palace_id}>
              <h3>{labelForPalace(item.palace_id)}</h3>
              <p>{item.interpretation.scenario}</p>
              <strong>{confidenceLabel(item.interpretation.confidence)}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="public-section">
        <h2>十二宫详情</h2>
        <div className="public-palace-grid">
          {chart.chart.palaces.map((palace) => {
            const detail = interpret({ chart_id: chart.chart_id, palace_id: palace.palace_id, mode: "entertainment", include_trace: true });
            return (
              <article key={palace.palace_id}>
                <h3>{palace.name}</h3>
                <p>{detail.interpretation.interpretation}</p>
                <dl>
                  <div>
                    <dt>主星</dt>
                    <dd>{palace.main_stars.join("、") || "无主星"}</dd>
                  </div>
                  <div>
                    <dt>四化</dt>
                    <dd>{palace.transforms.join("、") || "无四化"}</dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      </section>

      <section className="public-section public-rule-section">
        <h2>规则来源</h2>
        <ul>
          {interpretations.flatMap((item) => item.trace.slice(0, 2)).map((trace) => (
            <li key={`${trace.rule_id}-${trace.palace_id}`}>
              <strong>{trace.source.title}</strong>
              <span>{trace.source.modern_translation}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="public-note">
        <h2>免责声明</h2>
        <p>解读内容避免医疗、投资、法律、婚恋成败、灾祸预测等高风险断言。所有文本仅供娱乐和自我观察参考，不作为专业决策依据。</p>
      </section>
    </main>
  );
}

function labelForPalace(palaceId: string): string {
  const labels: Record<string, string> = {
    life: "命宫",
    career: "官禄宫",
    wealth: "财帛宫",
    fortune: "福德宫"
  };
  return labels[palaceId] ?? palaceId;
}

function confidenceLabel(confidence: string): string {
  if (confidence === "strong_structure") return "结构较强";
  if (confidence === "medium_structure") return "结构中等";
  return "结构较弱";
}
