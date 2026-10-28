import { createChart } from "../../../../chartEngine.js";
import { StageScreen } from "../../../../components/phase6/StageScreen.js";
import { createImmersiveSession } from "../../../../phase6/immersive.js";
import type { BirthProfile } from "../../../../types.js";

export const dynamic = "force-dynamic";

const demoBirthProfile: BirthProfile = {
  display_name: "Immersive demo user",
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

export default function InternalPhase6Page() {
  const chart = createChart({ birth_profile: demoBirthProfile });
  const { session } = createImmersiveSession({
    chart_id: chart.chart_id,
    display_mode: "stage_screen",
    controller_label: "Stage host"
  });

  return <StageScreen chart={chart} session={session} enablePolling />;
}
