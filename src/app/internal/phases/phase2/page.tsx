import { createChart } from "../../../../chartEngine.js";
import { PrototypeShell } from "../../../../components/phase2/PrototypeShell.js";
import type { BirthProfile } from "../../../../types.js";

export const dynamic = "force-dynamic";

const demoBirthProfile: BirthProfile = {
  display_name: "演示用户",
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

export default function Page() {
  const initialChart = createChart({
    birth_profile: demoBirthProfile
  });

  return <PrototypeShell initialBirthProfile={demoBirthProfile} initialChart={initialChart} />;
}


