import { getLaunchOperationsDashboard } from "../../phase10/launchOps.js";

export const dynamic = "force-dynamic";

export default function OpsPage() {
  const dashboard = getLaunchOperationsDashboard({
    auth: {
      token: "phase10_admin_token",
      role: "ops_admin"
    }
  });

  return (
    <main className="phase10-page">
      <section className="workspace-header">
        <div>
          <p className="eyebrow">Internal Ops</p>
          <h1>Operations Dashboard</h1>
        </div>
        <div className="status-strip" aria-label="ops status">
          <span>orders:{dashboard.orders.total_orders}</span>
          <span>tickets:{dashboard.support.total_tickets}</span>
          <span>privacy_scan:{dashboard.risk.privacy_scan_violations}</span>
        </div>
      </section>
      <section className="phase10-layout">
        <div className="phase10-panel">
          <div className="phase10-metric-row">
            <span>{dashboard.launch_config.public_status}</span>
            <span>failed {dashboard.orders.failed_orders}</span>
            <span>refund {dashboard.orders.refunded_manual_orders}</span>
            <span>unauthorized {dashboard.risk.unauthorized_access_attempts}</span>
          </div>
          <p className="muted">Internal dashboard uses sanitized report, order, entitlement, and support ticket data only.</p>
        </div>
      </section>
    </main>
  );
}
