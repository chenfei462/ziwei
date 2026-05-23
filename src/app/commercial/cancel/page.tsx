export default function CommercialCancelPage() {
  return (
    <main className="phase9-page">
      <section className="workspace-header">
        <div>
          <p className="eyebrow">Payment Result</p>
          <h1>Checkout Cancelled</h1>
        </div>
        <div className="status-strip" aria-label="payment cancel status">
          <span>no_order_fulfillment</span>
          <span>no_sensitive_data_logged</span>
        </div>
      </section>
      <section className="phase9-layout">
        <div className="phase9-panel">
          <p className="muted">The order remains unpaid. You can return to the commerce MVP and create a new checkout session.</p>
          <a href="/phase9">Back to commerce</a>
        </div>
      </section>
    </main>
  );
}
