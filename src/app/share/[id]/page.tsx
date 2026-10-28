import type { Metadata } from "next";
import { getShareLandingSnapshotAsync } from "../../../phase13/growth.js";
import type { ShareLandingResponse } from "../../../types.js";

export const dynamic = "force-dynamic";

type ShareLandingPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: ShareLandingPageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const response = await getShareLandingSnapshotAsync(id);
    return {
      title: `${response.snapshot.title} | 紫微星垣`,
      description: response.snapshot.summary,
      openGraph: {
        title: response.snapshot.title,
        description: response.snapshot.summary,
        images: [
          {
            url: "/share-card-preview.png",
            width: 1200,
            height: 630,
            alt: "紫微星垣今日星垣卡分享预览"
          }
        ],
        type: "article",
        url: `/share/${id}`
      },
      twitter: {
        card: "summary_large_image",
        title: response.snapshot.title,
        description: response.snapshot.summary,
        images: ["/share-card-preview.png"]
      }
    };
  } catch {
    return {
      title: "分享不存在 | 紫微星垣",
      description: "该分享不存在或已经过期。"
    };
  }
}

export default async function ShareLandingPage({ params, searchParams }: ShareLandingPageProps) {
  const { id } = await params;
  let response: ShareLandingResponse;
  try {
    response = await getShareLandingSnapshotAsync(id);
  } catch {
    return (
      <main className="public-page">
        <section className="public-note">
          <h1>分享不存在</h1>
          <p>该分享不存在或已经过期。公开页面不会展示完整出生资料。</p>
          <a href="/chart/new">创建我的观察卡</a>
        </section>
      </main>
    );
  }
  const shareCtaHref = buildShareCtaHref(id, await searchParams);

  return (
    <main className="public-page share-page">
      <header className="public-nav" aria-label="主导航">
        <a className="brand-mark" href="/">
          紫微星垣
        </a>
        <nav>
          <a href="/chart/new">创建我的观察卡</a>
          <a href="/account">注册/登录</a>
        </nav>
      </header>
      <article className="share-card">
        <p className="public-kicker">星垣观察卡</p>
        <h1>{response.snapshot.title}</h1>
        <p>{response.snapshot.summary}</p>
        <div className="share-chip-row">
          {response.snapshot.keywords.map((keyword) => (
            <span key={keyword}>{keyword}</span>
          ))}
          {privacyChips.map((chip) => (
            <span key={chip}>{chip}</span>
          ))}
          {readableSafetyChips(response.snapshot.safety_flags).map((chip) => (
            <span key={chip}>{chip}</span>
          ))}
        </div>
        <p className="muted">公开分享默认隐藏完整出生日期、出生时间、精确地点和真实身份。</p>
        <p className="share-privacy-footnote">紫微星垣会隐藏完整出生资料，只保留安全归因参数用于回流。</p>
        <div className="share-cta-row">
          <a className="public-primary-link" href={shareCtaHref}>
            生成我的隐私观察卡
          </a>
          <a className="public-secondary-link" href={shareCtaHref}>
            加入 7 日观察
          </a>
        </div>
      </article>
      <section className="public-note">
        <h2>边界说明</h2>
        <p>分享内容仅供娱乐和自我观察参考，不展示完整出生日期、出生时间、精确地点、真实身份或专业决策建议。</p>
      </section>
    </main>
  );
}

function buildShareCtaHref(id: string, searchParams?: Record<string, string | string[] | undefined>): string {
  const query = new URLSearchParams({ share_id: id });
  for (const key of ["channel", "campaign"] as const) {
    const rawValue = searchParams?.[key];
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    const safeValue = normalizeAttribution(value);
    if (safeValue) query.set(key, safeValue);
  }
  return `/chart/new?${query.toString()}`;
}

function normalizeAttribution(value: string | undefined): string | undefined {
  const normalized = value?.trim().slice(0, 64);
  if (!normalized || !/^[a-zA-Z0-9_-]+$/.test(normalized)) return undefined;
  return normalized;
}

const privacyChips = ["已隐藏生日", "已隐藏时间", "已隐藏地点"] as const;

function readableSafetyChips(flags: string[]): string[] {
  const chips = new Set<string>();
  for (const flag of flags) {
    if (flag.includes("daily")) chips.add("仅自我观察");
    if (flag.includes("absolute")) chips.add("避免绝对化");
    if (flag.includes("major")) chips.add("重大决策提醒");
    if (flag.includes("mini")) chips.add("小程序审核友好");
    if (flag.includes("review")) chips.add("内容安全过滤");
  }
  chips.add("隐私脱敏分享");
  return Array.from(chips);
}
