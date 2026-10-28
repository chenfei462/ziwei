import { createChart } from "../../../../chartEngine.js";
import { DailyStargardenPanel } from "../../../../components/phase12/DailyStargardenPanel.js";
import { getMemberAchievements, listStarAtlas } from "../../../../phase12/daily.js";
import type { BirthProfile } from "../../../../types.js";

export const dynamic = "force-dynamic";

const profile: BirthProfile = {
  display_name: "Phase 12 daily demo",
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

const memberId = "member_phase12_demo";
const initialDate = "2027-08-16";

export default function Phase12Page() {
  const chart = createChart({ birth_profile: profile, rule_profile_id: "default_ziwei_v0_1" });
  const atlas = listStarAtlas({ member_id: memberId });
  const achievements = getMemberAchievements(memberId);

  return (
    <main className="phase12-page">
      <section className="workspace-header">
        <div>
          <p className="eyebrow">Phase 12 Daily Stargarden</p>
          <h1>Phase 12 Daily Stargarden</h1>
        </div>
        <div className="status-strip" aria-label="Phase 12 status">
          <span>today_stargarden_v0.1</span>
          <span>star_atlas_v0.1</span>
          <span>share_card_v0.3</span>
        </div>
      </section>
      <section className="phase12-layout">
        <DailyStargardenPanel
          chartId={chart.chart_id}
          chartSnapshot={chart.chart}
          initialAchievements={achievements}
          initialAtlas={atlas}
          initialDate={initialDate}
          memberId={memberId}
        />
        <aside className="phase12-panel">
          <div className="panel-title-row">
            <h2>Daily Guardrails</h2>
          </div>
          <ul className="phase10-scope-list">
            <li>Daily themes are symbolic observations and never concrete event forecasts.</li>
            <li>Quests stay low-risk, reversible, and limited to daily self-observation.</li>
            <li>Atlas and seasonal cards link back to source-aware knowledge nodes.</li>
            <li>Cards and logs hide full birth date, birth time, location detail, and camera frames.</li>
          </ul>
        </aside>
      </section>
    </main>
  );
}

