import { createChart } from "../../../../chartEngine.js";
import { CommercePanel } from "../../../../components/phase9/CommercePanel.js";
import { createReportDraft } from "../../../../phase8/reporting.js";
import type { BirthProfile } from "../../../../types.js";

export const dynamic = "force-dynamic";

const profile: BirthProfile = {
  display_name: "Phase 9 buyer demo",
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

export default function Phase9Page() {
  const chart = createChart({ birth_profile: profile });
  const report = createReportDraft({
    report_type: "single_chart",
    chart_id: chart.chart_id,
    chart: chart.chart,
    mode: "professional"
  });

  return (
    <main className="phase9-page">
      <section className="workspace-header">
        <div>
          <p className="eyebrow">Phase 9 Commerce Loop</p>
          <h1>Phase 9 Payments Orders And Membership</h1>
        </div>
        <div className="status-strip" aria-label="Phase 9 status">
          <span>stripe_checkout</span>
          <span>sandbox_webhook_signed</span>
          <span>privacy_default_on</span>
        </div>
      </section>

      <section className="phase9-layout">
        <CommercePanel initialReport={report} memberId="member_phase9_demo" />
        <aside className="phase9-panel">
          <div className="panel-title-row">
            <h2>Compliance Baseline</h2>
          </div>
          <ul className="phase9-scope-list">
            <li>Purchase confirmation includes service, privacy, refund, and entertainment-only notices.</li>
            <li>Orders store report references and member identifiers, not full birth profiles.</li>
            <li>Refunds remain manual support actions in this stage.</li>
            <li>WeChat Pay, Alipay, invoices, coupons, and multi-merchant operations are reserved for later stages.</li>
          </ul>
        </aside>
      </section>
    </main>
  );
}

