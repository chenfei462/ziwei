export default function CommercialSuccessPage() {
  return (
    <main className="phase9-page">
      <section className="workspace-header">
        <div>
          <p className="eyebrow">Payment Result</p>
          <h1>Payment Success</h1>
        </div>
        <div className="status-strip" aria-label="payment result status">
          <span>webhook_required</span>
          <span>report_access_after_fulfillment</span>
        </div>
      </section>
      <section className="phase9-layout">
        <div className="phase9-panel">
          <p className="success-message">The sandbox checkout completed. Report access is granted after the signed payment webhook is processed.</p>
          <a href="/member">My reports</a>
        </div>
      </section>
    </main>
  );
}
