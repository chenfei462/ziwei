import type { Metadata } from "next";
import { cookies } from "next/headers.js";
import { DailyStargardenPanel } from "../../../../components/phase12/DailyStargardenPanel.js";
import { assertCanReadChartAsync, identityFromSessionCookieValues, memberCookieName, visitorCookieName } from "../../../../auth.js";
import { getMemberAchievements, listStarAtlas } from "../../../../phase12/daily.js";
import { productRepository } from "../../../../repositories/productRepository.js";
import { ChallengeAction } from "../ChallengeAction.js";

type DailyCardPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: DailyCardPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: "今日星垣卡",
    description: `生成命盘 ${id} 的今日星垣卡，加入 7 日星垣挑战，并保留隐私友好的脱敏分享边界。`
  };
}

export default async function DailyCardPage({ params }: DailyCardPageProps) {
  const { id } = await params;
  const chart = await productRepository.getChartAsync(id);
  if (!chart) {
    return (
      <main className="public-page">
        <section className="public-note">
          <h1>命盘不存在</h1>
          <p>该命盘不存在或已经过期。你可以重新生成自己的观察卡。</p>
          <a href="/chart/new">生成我的观察卡</a>
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
          <p>今日星垣卡需要从你自己的命盘生成。公开分享页只展示脱敏摘要。</p>
          <a href="/chart/new">生成我的观察卡</a>
        </section>
      </main>
    );
  }

  const memberId = identity.memberId ?? identity.visitorId;
  const initialAtlas = listStarAtlas({ member_id: memberId });
  const initialAchievements = getMemberAchievements(memberId);

  return (
    <main className="public-page daily-card-page">
      <header className="public-nav" aria-label="主导航">
        <a className="brand-mark" href="/">
          紫微星垣
        </a>
        <nav>
          <a href={`/chart/${chart.chart_id}`}>返回观察卡</a>
          <a href="/chart/new">重新生成</a>
          <a href="/legal/privacy">隐私说明</a>
        </nav>
      </header>

      <section className="public-page-heading">
        <p className="public-kicker">今日星垣卡 + 7 日挑战</p>
        <h1>今天你的星垣落在哪一宫？</h1>
        <p>生成一张不暴露生日、出生时间和精确地点的今日观察卡；每天完成一个轻量观察，连续 7 日看到阶段节奏变化。</p>
      </section>

      <section className="daily-card-layout">
        <DailyStargardenPanel
          chartId={chart.chart_id}
          chartSnapshot={chart.chart}
          initialAchievements={initialAchievements}
          initialAtlas={initialAtlas}
          initialDate={businessDateString()}
          memberId={memberId}
          variant="public"
        />
        <aside className="public-summary-panel">
          <h2>7 日星垣挑战</h2>
          <p>今日卡负责给出当天关键词；7 日挑战负责把观察沉淀成连续记录，而不是一次性结论。</p>
          <ChallengeAction chartId={chart.chart_id} />
          <div className="daily-card-privacy-note">
            <h3>分享边界</h3>
            <p>公开内容默认隐藏完整出生日期、出生时间、精确地点和真实身份，只保留关键词、观察任务和规则来源提示。</p>
          </div>
        </aside>
      </section>
    </main>
  );
}

function businessDateString(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
