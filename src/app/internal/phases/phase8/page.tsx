import { ScrollText } from "lucide-react";
import { createChart } from "../../../../chartEngine.js";
import { CreatorWorkbench } from "../../../../components/phase8/CreatorWorkbench.js";
import { createSynastry, interpretTimeline } from "../../../../phase7/synastryTimeline.js";
import type { BirthProfile } from "../../../../types.js";

export const dynamic = "force-dynamic";

const primaryProfile: BirthProfile = {
  display_name: "Phase 8 primary demo",
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

const partnerProfile: BirthProfile = {
  display_name: "Phase 8 partner demo",
  calendar_type: "gregorian",
  birth_date: "1998-11-02",
  birth_time: "22:45",
  timezone: "Asia/Shanghai",
  location: {
    name: "Beijing",
    longitude: 116.4074,
    latitude: 39.9042
  },
  is_leap_month: false,
  true_solar_time_enabled: false,
  gender_rule: "traditional_female"
};

export default function Phase8Page() {
  const chart = createChart({ birth_profile: primaryProfile });
  const partnerChart = createChart({ birth_profile: partnerProfile });
  const synastry = createSynastry({
    mode: "entertainment",
    primary: {
      label: "Primary",
      chart_id: chart.chart_id,
      chart: chart.chart,
      consent: { agreed: true, no_sensitive_birth_data: true }
    },
    partner: {
      label: "Partner",
      chart_id: partnerChart.chart_id,
      chart: partnerChart.chart,
      consent: { agreed: true, no_sensitive_birth_data: true }
    }
  });
  const timeline = interpretTimeline({
    chart_id: chart.chart_id,
    chart: chart.chart,
    year: 2027,
    month: 5,
    mode: "entertainment",
    palace_id: "career"
  });

  return (
    <main className="phase8-page">
      <section className="workspace-header">
        <div>
          <p className="eyebrow">Phase 8 Reports And Creator Assets</p>
          <h1>Phase 8 Report Export And Creator Workbench</h1>
        </div>
        <div className="status-strip" aria-label="Phase 8 status">
          <span>report_templates_v0.1</span>
          <span>export_preview_only</span>
          <span>privacy_default_on</span>
        </div>
      </section>

      <section className="phase8-layout">
        <CreatorWorkbench chart={chart} synastry={synastry} timeline={timeline} />
        <aside className="phase8-panel">
          <div className="panel-title-row">
            <ScrollText aria-hidden="true" size={18} />
            <h2>Phase 8 Scope</h2>
          </div>
          <ul className="phase8-scope-list">
            <li>HTML report page and PDF preview metadata are supported.</li>
            <li>Real payment, invoice, refund, DOCX editor, and order backend are deferred.</li>
            <li>Exports are blocked when content review detects hard predictions or private birth details.</li>
            <li>Creator assets are generated as reusable live outlines, short video scripts, and shareable topic cards.</li>
          </ul>
        </aside>
      </section>
    </main>
  );
}

