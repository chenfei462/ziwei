import { createChart } from "../../../../chartEngine.js";
import { MobileGrowthPanel } from "../../../../components/phase13/MobileGrowthPanel.js";
import { createDailyTheme, recordDailyCheckIn } from "../../../../phase12/daily.js";
import { listCommunityChallenges } from "../../../../phase13/growth.js";
import type { BirthProfile } from "../../../../types.js";

export const dynamic = "force-dynamic";

const profile: BirthProfile = {
  display_name: "Phase 13 mobile demo",
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

const memberId = "member_phase13_demo";

export default function Phase13Page() {
  const chart = createChart({ birth_profile: profile, rule_profile_id: "default_ziwei_v0_1" });
  for (const date of ["2027-08-15", "2027-08-16"]) {
    const daily = createDailyTheme({
      chart_id: chart.chart_id,
      date,
      mode: "entertainment"
    });
    recordDailyCheckIn({
      daily_theme_id: daily.daily_theme.daily_theme_id,
      member_id: memberId,
      completed_quest_ids: daily.daily_theme.quests.map((quest) => quest.quest_id),
      favorite_star_card_ids: ["star_zi_wei"],
      share_intent: true,
      feedback: "Seeded mobile growth demo check-in.",
      consent: {
        agreed: true,
        no_sensitive_birth_data: true,
        no_video_frame: true
      }
    });
  }
  const challenges = listCommunityChallenges({ member_id: memberId });

  return (
    <main className="phase13-page">
      <section className="workspace-header">
        <div>
          <p className="eyebrow">Phase 13 PWA And Community Growth</p>
          <h1>Phase 13 Mobile Growth</h1>
        </div>
        <div className="status-strip" aria-label="Phase 13 status">
          <span>pwa_mobile_v0.1</span>
          <span>share_landing_v0.1</span>
          <span>challenge_growth_v0.1</span>
        </div>
      </section>
      <section className="phase13-layout">
        <MobileGrowthPanel initialChallenges={challenges} memberId={memberId} />
        <aside className="phase13-panel">
          <div className="panel-title-row">
            <h2>Growth Guardrails</h2>
          </div>
          <ul className="phase10-scope-list">
            <li>PWA and mobile H5 remain the primary delivery surface; native apps are outside this phase.</li>
            <li>Share landing pages use detached snapshots and hide full birth date, birth time, location detail, and camera frames.</li>
            <li>Challenges are limited to low-risk observation tasks, atlas collection, and seasonal cards.</li>
            <li>Referral events record behavior types only and avoid sensitive birth profile fields.</li>
          </ul>
        </aside>
      </section>
    </main>
  );
}

