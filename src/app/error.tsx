"use client";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <main className="public-page">
      <section className="public-note">
        <p className="eyebrow">500</p>
        <h1>服务暂时不可用</h1>
        <p>当前请求没有完成。我们会保留脱敏错误线索用于排查，请稍后重试，或返回首页继续使用核心流程。</p>
        {error.digest ? <p className="muted">错误编号：{error.digest}</p> : null}
        <div className="button-row">
          <button type="button" onClick={reset}>
            重试
          </button>
          <a href="/">回到首页</a>
        </div>
      </section>
    </main>
  );
}
