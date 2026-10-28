export default function CommercialSuccessPage() {
  return (
    <main className="phase9-page">
      <section className="workspace-header">
        <div>
          <p className="eyebrow">支付结果</p>
          <h1>支付成功</h1>
        </div>
        <div className="status-strip" aria-label="payment result status">
          <span>需要验签回调</span>
          <span>完成后开放报告权益</span>
        </div>
      </section>
      <section className="phase9-layout">
        <div className="phase9-panel">
          <p className="success-message">沙箱结账已完成。支付回调验签通过并写入订单后，系统会发放对应报告权益。</p>
          <a href="/member">查看我的报告</a>
        </div>
      </section>
    </main>
  );
}
