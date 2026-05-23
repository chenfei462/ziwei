import { createChart } from "../../chartEngine.js";
import { SynastryPanel } from "../../components/phase7/SynastryPanel.js";
import { TimelinePanel } from "../../components/phase7/TimelinePanel.js";
import type { BirthProfile } from "../../types.js";

export const dynamic = "force-dynamic";

const primaryProfile: BirthProfile = {
  display_name: "甲方演示",
  calendar_type: "gregorian",
  birth_date: "2000-08-16",
  birth_time: "03:30",
  timezone: "Asia/Shanghai",
  location: {
    name: "上海",
    longitude: 121.4737,
    latitude: 31.2304
  },
  is_leap_month: false,
  true_solar_time_enabled: false,
  gender_rule: "traditional_male"
};

const partnerProfile: BirthProfile = {
  display_name: "乙方演示",
  calendar_type: "gregorian",
  birth_date: "1998-11-02",
  birth_time: "22:45",
  timezone: "Asia/Shanghai",
  location: {
    name: "北京",
    longitude: 116.4074,
    latitude: 39.9042
  },
  is_leap_month: false,
  true_solar_time_enabled: false,
  gender_rule: "traditional_female"
};

export default function Phase7Page() {
  const primaryChart = createChart({ birth_profile: primaryProfile });
  const partnerChart = createChart({ birth_profile: partnerProfile });

  return (
    <main className="phase7-page">
      <section className="workspace-header">
        <div>
          <p className="eyebrow">Phase 7 Synastry And Timeline</p>
          <h1>阶段 7 合盘与流年扩展</h1>
        </div>
        <div className="status-strip" aria-label="阶段 7 状态">
          <span>synastry_v0.1</span>
          <span>timeline_v0.1</span>
          <span>privacy_default_on</span>
        </div>
      </section>
      <section className="phase7-grid">
        <SynastryPanel partnerChart={partnerChart} primaryChart={primaryChart} />
        <TimelinePanel chart={primaryChart} />
      </section>
    </main>
  );
}
