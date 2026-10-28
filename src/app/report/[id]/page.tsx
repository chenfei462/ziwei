import type { Metadata } from "next";
import { cookies } from "next/headers.js";
import { Download, LockKeyhole, Share2 } from "lucide-react";
import { identityFromSessionCookieValues, memberCookieName, visitorCookieName } from "../../../auth.js";
import { productRepository } from "../../../repositories/productRepository.js";
import { assertCanReadReportAsync, canReadReportSummaryAsync } from "../../../reportAccess.js";
import type { ReportDraft } from "../../../types.js";
import { ReportPurchaseAction } from "./ReportPurchaseAction.js";

type ReportPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: ReportPageProps): Promise<Metadata> {
  const { id } = await params;
  const report = await productRepository.getReportDraftAsync(id);
  return {
    title: report ? `${report.title} | 紫微星垣` : "报告不存在 | 紫微星垣",
    description: "查看已保存的紫微斗数结构化报告、规则来源、免责声明、分享摘要和导出预览入口。"
  };
}

export default async function ReportDetailPage({ params }: ReportPageProps) {
  const { id } = await params;
  const report = await productRepository.getReportDraftAsync(id);
  if (!report) {
    return (
      <main className="public-page">
        <section className="public-note">
          <h1>报告不存在</h1>
          <p>该报告不存在或已经过期。你可以重新创建命盘并生成报告。</p>
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
  const canReadFullReport = await canReadFullReportDetail(report, identity);
  if (!canReadFullReport) {
    const canReadSummary = await canReadReportSummaryAsync(report, identity);
    if (!canReadSummary) {
      return (
        <main className="public-page">
          <section className="public-note">
            <h1>无权访问该报告</h1>
            <p>报告详情只允许命盘创建者或已获得报告权益的用户查看。公开分享页只展示脱敏摘要。</p>
            <a href="/member">查看会员权益</a>
          </section>
        </main>
      );
    }
    return <ReportSummaryPaywall report={report} />;
  }

  const traces = report.sections.flatMap((section) => section.trace.slice(0, 2));
  const lineage = report.lineage;
  const access = report.access;

  return (
    <main className="public-page">
      <ReportHeader />

      <section className="public-page-heading">
        <p className="public-kicker">报告详情</p>
        <h1>{report.title}</h1>
        <p>报告已保存为 {report.template_version} 版本。完整出生资料不在报告页面展示，内容仅供娱乐、自我观察和传统文化体验参考。</p>
        <p>AI 辅助内容会记录 prompt 版本、模型状态、安全审查和规则 trace。若生成失败，系统会回退到本地规则模板。</p>
      </section>

      <section className="public-section" aria-label="报告追溯信息">
        <h2>报告追溯</h2>
        <div className="public-tip-grid">
          <article>
            <h3>版本</h3>
            <p>报告 v{report.report_version ?? 1}，模板 {report.template_version}</p>
          </article>
          <article>
            <h3>规则</h3>
            <p>{report.rule_profile_id ?? "default"} / {report.rule_version ?? "unrecorded"}</p>
          </article>
          <article>
            <h3>AI Prompt</h3>
            <p>{lineage?.prompt_version ?? "legacy_prompt_unrecorded"}</p>
          </article>
          <article>
            <h3>访问层</h3>
            <p>{access?.required_tier ?? report.price_tier_hint}，公开分享仅开放脱敏摘要</p>
          </article>
        </div>
      </section>

      <section className="public-report-actions" aria-label="报告操作">
        <a href={`/api/report/export-preview?report_id=${encodeURIComponent(report.report_id)}&format=html`}>
          <Download aria-hidden="true" size={16} />
          导出预览
        </a>
        <a href={`/api/report/${encodeURIComponent(report.report_id)}/share`}>
          <Share2 aria-hidden="true" size={16} />
          生成分享摘要
        </a>
        <span>
          <LockKeyhole aria-hidden="true" size={16} />
          私密详情
        </span>
      </section>

      <section className="public-section">
        <h2>总览摘要</h2>
        <div className="public-tip-grid">
          {report.sections.slice(0, 4).map((section) => (
            <article key={section.section_id}>
              <h3>{section.title}</h3>
              <p>{section.basis}</p>
              <strong>{confidenceLabel(section.confidence)}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="public-section">
        <h2>宫位详情</h2>
        <div className="public-palace-grid">
          {report.sections.map((section) => (
            <article key={section.section_id}>
              <h3>{section.title}</h3>
              <p>{section.interpretation}</p>
              {section.scenario ? <p>{section.scenario}</p> : null}
              {section.advice ? <p>{section.advice}</p> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="public-section public-rule-section">
        <h2>规则来源</h2>
        <ul>
          {traces.map((trace) => (
            <li key={`${trace.rule_id}-${trace.title}`}>
              <strong>{trace.source_title}</strong>
              <span>{trace.modern_translation}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="public-note">
        <h2>免责声明</h2>
        <p>本报告避免医疗、投资、法律、婚恋成败和灾祸预测等高风险断言，仅用于娱乐、自我观察和传统文化体验参考。</p>
      </section>
    </main>
  );
}

async function canReadFullReportDetail(report: ReportDraft | undefined, identity: Parameters<typeof assertCanReadReportAsync>[1]): Promise<boolean> {
  if (!report) return false;
  try {
    await assertCanReadReportAsync(report, identity);
    return true;
  } catch {
    return false;
  }
}

function ReportHeader() {
  return (
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
  );
}

function ReportSummaryPaywall({ report }: { report: ReportDraft }) {
  const summary = report.share_summary;
  return (
    <main className="public-page">
      <ReportHeader />
      <section className="public-page-heading">
        <p className="public-kicker">免费摘要</p>
        <h1>{summary?.title ?? report.title}</h1>
        <p>{summary?.summary ?? "公开分享仅展示脱敏摘要，完整报告需本人权限或付费权益访问。"}</p>
        <p>公开分享仅展示脱敏摘要。完整报告包含六宫细节、生活场景、规则溯源、置信提示和导出预览，需要购买标准或高级报告权益后查看。</p>
      </section>
      <section className="public-section" aria-label="完整报告可解锁内容">
        <h2>解锁后可看</h2>
        <div className="public-tip-grid">
          <article>
            <h3>六宫细节</h3>
            <p>围绕命宫、官禄、财帛、夫妻、福德、迁移拆解结构重点和生活场景。</p>
          </article>
          <article>
            <h3>规则溯源</h3>
            <p>展示每段解释引用的规则记录、传统术语、现代转译和置信提示。</p>
          </article>
          <article>
            <h3>导出预览</h3>
            <p>先查看适合保存、转发或后续咨询的报告导出样式，再决定是否继续使用。</p>
          </article>
        </div>
      </section>
      <section className="public-section" aria-label="免费报告摘要追溯信息">
        <h2>可追溯信息</h2>
        <div className="public-tip-grid">
          <article>
            <h3>报告版本</h3>
            <p>v{report.report_version ?? 1}</p>
          </article>
          <article>
            <h3>规则版本</h3>
            <p>{report.rule_version ? "规则版本已记录" : "规则版本待补充"}</p>
          </article>
          <article>
            <h3>AI 转译记录</h3>
            <p>{report.lineage?.prompt_version ? "AI 转译版本已记录" : "使用本地规则模板"}</p>
          </article>
          <article>
            <h3>访问层</h3>
            <p>{tierLabel(report.access?.required_tier ?? report.price_tier_hint)}</p>
          </article>
        </div>
      </section>
      <section className="public-section" aria-label="购买完整报告">
        <h2>购买完整报告</h2>
        <ReportPurchaseAction reportId={report.report_id} />
      </section>
      <section className="public-report-actions" aria-label="报告分享">
        <a href={`/api/report/${encodeURIComponent(report.report_id)}/share`}>
          <Share2 aria-hidden="true" size={16} />
          生成脱敏分享
        </a>
      </section>
      <section className="public-note">
        <h2>免责声明</h2>
        <p>本报告避免医疗、投资、法律、婚恋成败和灾祸预测等高风险断言，仅用于娱乐、自我观察和传统文化体验参考。</p>
      </section>
    </main>
  );
}

function confidenceLabel(confidence: string): string {
  if (confidence === "strong_structure") return "结构较强";
  if (confidence === "medium_structure") return "结构中等";
  return "结构较弱";
}

function tierLabel(tier: string | undefined): string {
  if (tier === "standard_49") return "标准报告权益";
  if (tier === "premium_99") return "高级报告权益";
  return "报告权益";
}
