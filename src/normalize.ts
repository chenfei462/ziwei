import { ApiError } from "./errors.js";
import { normalizeDateForIztro, timeIndexFromBirthTime } from "./time.js";
import type { BirthProfile, NormalizedBirth } from "./types.js";

export function normalizeBirthProfile(profile: BirthProfile): NormalizedBirth {
  if (!profile.timezone?.trim()) {
    throw new ApiError("REQUIRED_TIMEZONE", "必须提供出生地时区。", { field: "timezone" });
  }

  const date = normalizeDateForIztro(profile.birth_date);
  const timeIndex = timeIndexFromBirthTime(profile.birth_time);
  const engineGender = profile.gender_rule === "traditional_female" ? "女" : "男";

  return {
    calendar_type: profile.calendar_type,
    solar_date: profile.calendar_type === "gregorian" ? date : null,
    lunar_date: profile.calendar_type === "lunar" ? date : null,
    local_time: profile.birth_time,
    timezone: profile.timezone,
    time_index: timeIndex,
    true_solar_time_applied: false,
    engine_gender: engineGender
  };
}
