export default function NotFoundPage() {
  return (
    <main className="public-page">
      <section className="public-note">
        <p className="eyebrow">404</p>
        <h1>页面不存在或已下线</h1>
        <p>你访问的内容可能已经迁移、过期或不再作为公开入口开放。请从正式首页重新进入建盘、报告、会员、订单或客服流程。</p>
        <a href="/">回到首页</a>
      </section>
    </main>
  );
}
