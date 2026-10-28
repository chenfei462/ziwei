export default function CommercialCancelPage() {
  return (
    <main className="phase9-page">
      <section className="workspace-header">
        <div>
          <p className="eyebrow">支付结果</p>
          <h1>支付已取消</h1>
        </div>
        <div className="status-strip" aria-label="payment cancel status">
          <span>不会发放订单权益</span>
          <span>不会记录敏感支付数据</span>
        </div>
      </section>
      <section className="phase9-layout">
        <div className="phase9-panel">
          <p className="muted">订单仍处于未支付状态。你可以返回命盘继续查看，或在准备好后重新发起购买。</p>
          <a href="/chart/new">返回创建命盘</a>
        </div>
      </section>
    </main>
  );
}
