import { getCommercialDashboard } from "../../../phase9/commerce.js";

export const dynamic = "force-dynamic";

export default function CommercialDashboardPage() {
  const dashboard = getCommercialDashboard();

  return (
    <main className="phase9-page">
      <section className="workspace-header">
        <div>
          <p className="eyebrow">Commercial Dashboard</p>
          <h1>Commerce Metrics</h1>
        </div>
        <div className="status-strip" aria-label="commercial dashboard status">
          <span>orders:{dashboard.total_orders}</span>
          <span>fulfilled:{dashboard.fulfilled_orders}</span>
          <span>privacy_default_on</span>
        </div>
      </section>
      <section className="phase9-layout">
        <div className="phase9-panel">
          <div className="phase9-result">
            <span>conversion {Math.round(dashboard.payment_conversion_rate * 100)}%</span>
            <span>aov {dashboard.average_order_value_cents / 100} CNY</span>
            <span>failed {dashboard.failed_orders}</span>
            <span>manual_refund {dashboard.refunded_manual_orders}</span>
          </div>
          <p className="muted">Dashboard events do not include full birth date, birth time, location detail, camera frames, or background images.</p>
        </div>
      </section>
    </main>
  );
}
