import { headers } from "next/headers.js";
import { InternalGrowthPanel } from "../../../components/phase10/InternalGrowthPanel.js";
import { LaunchOpsPanel } from "../../../components/phase10/LaunchOpsPanel.js";
import { getInternalGrowthInsights, getLaunchOperationsDashboard, getOpsOverview } from "../../../phase10/launchOps.js";

export const dynamic = "force-dynamic";

export default async function InternalOpsPage() {
  const headerStore = await headers();
  const auth = {
    token: headerStore.get("x-admin-token") ?? "",
    role: (headerStore.get("x-admin-role") ?? "support_agent") as "ops_admin" | "support_agent" | "content_reviewer",
    actor_id: headerStore.get("x-admin-actor") ?? "internal_ops_page",
    mfa_code: headerStore.get("x-admin-mfa-code") ?? ""
  };
  let dashboard: ReturnType<typeof getLaunchOperationsDashboard>;
  let growthInsights: ReturnType<typeof getInternalGrowthInsights>;
  let overview: ReturnType<typeof getOpsOverview>;
  try {
    dashboard = getLaunchOperationsDashboard({ auth });
    growthInsights = getInternalGrowthInsights({ auth });
    overview = getOpsOverview({ auth });
  } catch {
    return (
      <main className="phase10-page">
        <section className="workspace-header">
          <div>
            <p className="eyebrow">Internal Ops</p>
            <h1>Operations Dashboard</h1>
          </div>
        </section>
        <section className="phase10-layout">
          <div className="phase10-panel">
            <p className="error-message">后台只允许管理员访问。请通过受保护的运维入口携带管理员凭据。</p>
          </div>
        </section>
      </main>
    );
  }

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
          <span>deletion:{overview.modules.data_deletion_requests}</span>
          <span>reports:{overview.modules.reports}</span>
          <span>shares:{overview.modules.shares}</span>
          <span>audit:{overview.modules.admin_audit_logs}</span>
          <span>privacy_scan:{dashboard.risk.privacy_scan_violations}</span>
        </div>
      </section>
      <section className="phase10-layout">
        <LaunchOpsPanel initialDashboard={dashboard} />
        <div className="phase10-panel">
          <div className="panel-title-row">
            <h2>Operations Readiness</h2>
          </div>
          <div className="phase10-metric-row">
            <span>{dashboard.launch_config.public_status}</span>
            <span>failed {dashboard.orders.failed_orders}</span>
            <span>refund {dashboard.orders.refunded_manual_orders}</span>
            <span>partial {dashboard.orders.partially_refunded_orders}</span>
            <span>reviews {overview.modules.content_reviews}</span>
            <span>unauthorized {dashboard.risk.unauthorized_access_attempts}</span>
          </div>
          <ul className="phase10-scope-list">
            <li>Ops actions use server-side admin authorization and same-origin protected route handlers.</li>
            <li>Sensitive record reveal requires an ops_admin role, a concrete reason, and second confirmation.</li>
            <li>Audit log metadata is redacted before display and persisted for administrator accountability.</li>
          </ul>
          <p className="muted">Internal dashboard uses sanitized user, report, share, content review, order, entitlement, reconciliation, and support ticket data only.</p>
        </div>
      </section>
      <section className="phase10-layout phase10-layout-secondary">
        <InternalGrowthPanel insights={growthInsights} />
        <div className="phase10-panel">
          <div className="panel-title-row">
            <h2>Growth Notes</h2>
          </div>
          <ul className="phase10-scope-list">
            <li>Channel mix is computed from channel events only and does not infer exact cost or true channel ROI.</li>
            <li>Proxy conversion uses shared member overlap, launch event counts, and recorded launch value only.</li>
            <li>Any dominant-channel or duplicate-event anomaly stays visible here before traffic changes are made.</li>
          </ul>
          <p className="muted">No birth date, birth time, location, report body, or private order text is exposed in this view.</p>
        </div>
      </section>
    </main>
  );
}
