import { createChart } from "../../../../chartEngine.js";
import { LaunchOpsPanel } from "../../../../components/phase10/LaunchOpsPanel.js";
import { createReportDraft } from "../../../../phase8/reporting.js";
import { createCheckoutSession, createOrder, processPaymentWebhook } from "../../../../phase9/commerce.js";
import { getLaunchOperationsDashboard } from "../../../../phase10/launchOps.js";
import type { BirthProfile } from "../../../../types.js";
import { headers } from "next/headers.js";

export const dynamic = "force-dynamic";

const profile: BirthProfile = {
  display_name: "Phase 10 launch buyer",
  calendar_type: "gregorian",
  birth_date: "2000-08-16",
  birth_time: "03:30",
  timezone: "Asia/Shanghai",
  location: {
    name: "Shanghai",
    longitude: 121.4737,
    latitude: 31.2304
  },
  is_leap_month: false,
  true_solar_time_enabled: false,
  gender_rule: "traditional_male"
};

const consent = {
  agreed: true,
  service_terms: true,
  privacy_policy: true,
  refund_policy: true,
  cultural_entertainment_only: true
} as const;

export default async function Phase10Page() {
  const headerStore = await headers();
  const chart = createChart({ birth_profile: profile });
  const report = createReportDraft({
    report_type: "single_chart",
    chart_id: chart.chart_id,
    chart: chart.chart,
    mode: "professional"
  });
  const order = createOrder({
    report_id: report.report_id,
    package_id: "single_report",
    tier_id: "standard_49",
    member_id: "member_phase10_demo",
    consent
  });
  const checkout = createCheckoutSession({
    order_id: order.order_id,
    provider: "stripe_checkout",
    success_url: "http://127.0.0.1:3000/commercial/success",
    cancel_url: "http://127.0.0.1:3000/commercial/cancel"
  });
  if (checkout.sandbox_webhook) {
    processPaymentWebhook({
      provider: "stripe_checkout",
      raw_body: checkout.sandbox_webhook.raw_body,
      signature: checkout.sandbox_webhook.signature_header
    });
  }
  const dashboard = getLaunchOperationsDashboard({
    auth: {
      token: headerStore.get("x-admin-token") ?? "",
      role: (headerStore.get("x-admin-role") ?? "ops_admin") as "ops_admin" | "support_agent" | "content_reviewer",
      actor_id: headerStore.get("x-admin-actor") ?? "internal_phase10_page",
      mfa_code: headerStore.get("x-admin-mfa-code") ?? ""
    }
  });

  return (
    <main className="phase10-page">
      <section className="workspace-header">
        <div>
          <p className="eyebrow">Phase 10 Launch Operations</p>
          <h1>Phase 10 Production Launch And Ops</h1>
        </div>
        <div className="status-strip" aria-label="Phase 10 status">
          <span>production_switch_gated</span>
          <span>ops_console_v0.1</span>
          <span>privacy_default_on</span>
        </div>
      </section>
      <section className="phase10-layout">
        <LaunchOpsPanel initialDashboard={dashboard} />
        <aside className="phase10-panel">
          <div className="panel-title-row">
            <h2>Launch Guardrails</h2>
          </div>
          <ul className="phase10-scope-list">
            <li>Production checkout requires live key, webhook secret, rollout percent, and rollback-off state.</li>
            <li>Ops actions require admin headers and only store sanitized order and ticket notes.</li>
            <li>Manual refund is an operational marker, not an automatic Stripe refund.</li>
            <li>Reports remain cultural entertainment test reports until consultant review is complete.</li>
          </ul>
        </aside>
      </section>
    </main>
  );
}

