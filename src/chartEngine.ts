import { astro } from "iztro";
import { ApiError } from "./errors.js";
import { normalizeBirthProfile } from "./normalize.js";
import { getRuleProfileRecord } from "./phase11/ruleProfileData.js";
import { defaultRuleConfig, defaultRuleTable } from "./ruleTable.js";
import { saveChart } from "./store.js";
import type {
  BirthProfile,
  CalculationTrace,
  Chart,
  ChartCreateRequest,
  ChartCreateResponse,
  MajorPeriod,
  Palace,
  RuleConfig,
  Star,
  Transform,
  TransformType
} from "./types.js";

type IztroStar = {
  name?: string;
  type?: string;
  brightness?: string;
  mutagen?: string;
};

type IztroPalace = {
  index: number;
  name: string;
  heavenlyStem: string;
  earthlyBranch: string;
  majorStars?: IztroStar[];
  minorStars?: IztroStar[];
  adjectiveStars?: IztroStar[];
  decadal?: {
    range?: number[];
    heavenlyStem?: string;
    earthlyBranch?: string;
  };
};

type IztroAstrolabe = {
  solarDate: string;
  lunarDate: string;
  chineseDate: string;
  earthlyBranchOfSoulPalace: string;
  earthlyBranchOfBodyPalace: string;
  fiveElementsClass: string;
  palaces: IztroPalace[];
};

const palaceIdByName: Record<string, string> = {
  命宫: "life",
  命: "life",
  兄弟: "siblings",
  夫妻: "spouse",
  子女: "children",
  财帛: "wealth",
  疾厄: "health",
  迁移: "migration",
  仆役: "friends",
  交友: "friends",
  官禄: "career",
  事业: "career",
  田宅: "property",
  福德: "fortune",
  父母: "parents"
};

const transformMap: Record<string, TransformType> = {
  禄: "hua_lu",
  权: "hua_quan",
  科: "hua_ke",
  忌: "hua_ji"
};

export function createChart(request: ChartCreateRequest): ChartCreateResponse {
  const ruleProfile = resolveRuleProfile(request);
  const ruleConfig = normalizeRuleConfig({ ...ruleProfile.rule_config, ...request.rule_config });
  const normalizedBirth = normalizeBirthProfile(request.birth_profile);
  const trace: CalculationTrace[] = [
    {
      step: "resolve_rule_profile",
      output: {
        rule_profile_id: ruleProfile.profile_id,
        rule_version: ruleProfile.version.version_id,
        consultant_review_status: ruleProfile.consultant_review_status
      }
    },
    {
      step: "normalize_birth",
      input: {
        calendar_type: request.birth_profile.calendar_type,
        birth_time: request.birth_profile.birth_time,
        timezone: request.birth_profile.timezone
      },
      output: {
        time_index: normalizedBirth.time_index,
        engine_gender: normalizedBirth.engine_gender
      },
      warnings: request.birth_profile.gender_rule === "traditional_unspecified" ? ["GENDER_RULE_DEFAULTED_TO_MALE_FOR_ENGINE"] : []
    }
  ];

  const astrolabe = calculateAstrolabe(request.birth_profile, normalizedBirth, ruleConfig);
  trace.push({
    step: "calculate_astrolabe",
    output: {
      solar_date: astrolabe.solarDate,
      lunar_date: astrolabe.lunarDate,
      soul_palace_branch: astrolabe.earthlyBranchOfSoulPalace,
      body_palace_branch: astrolabe.earthlyBranchOfBodyPalace,
      five_elements_class: astrolabe.fiveElementsClass
    }
  });

  const chart = mapAstrolabeToChart(astrolabe, trace);
  const response: ChartCreateResponse = {
    chart_id: createChartId(),
    rule_profile_id: ruleProfile.profile_id,
    rule_version: ruleProfile.version.version_id,
    rule_config_used: ruleConfig,
    normalized_birth: normalizedBirth,
    chart,
    trace,
    warnings: buildWarnings(request.birth_profile),
    privacy: { ...defaultRuleTable.privacyDefaults }
  };

  saveChart(response);
  return response;
}

function resolveRuleProfile(request: ChartCreateRequest) {
  return getRuleProfileRecord(request.rule_profile_id ?? request.rule_config?.school_id);
}

function normalizeRuleConfig(config?: RuleConfig): RuleConfig {
  const merged = { ...defaultRuleConfig, ...config };
  const supportedProfile =
    ["default_ziwei_v0_1", "experimental_sanhe_v0_1"].includes(merged.school_id) &&
    ["civil_midnight", "late_zi_next_day"].includes(merged.zi_hour_day_boundary) &&
    ["same_month_number", "split_leap_month"].includes(merged.leap_month_policy) &&
    (!merged.true_solar_time_policy || ["disabled", "optional"].includes(merged.true_solar_time_policy)) &&
    (!merged.four_transform_policy || ["default_stem", "experimental_stem_variant"].includes(merged.four_transform_policy)) &&
    (!merged.interpretation_style || ["balanced_modern", "classical_source_first"].includes(merged.interpretation_style));
  if (supportedProfile) {
    return merged;
  }
  if (merged.school_id !== "default_ziwei_v0_1") {
    throw new ApiError("UNSUPPORTED_SCHOOL", "当前阶段只支持默认排盘口径。", { field: "rule_config.school_id" });
  }
  if (merged.zi_hour_day_boundary !== "civil_midnight") {
    throw new ApiError("UNSUPPORTED_ZI_HOUR_BOUNDARY", "当前阶段只支持民用零点换日。", {
      field: "rule_config.zi_hour_day_boundary"
    });
  }
  if (merged.leap_month_policy !== "same_month_number") {
    throw new ApiError("UNSUPPORTED_LEAP_MONTH_POLICY", "当前阶段只支持闰月同月序口径。", {
      field: "rule_config.leap_month_policy"
    });
  }
  return merged;
}

function calculateAstrolabe(
  profile: BirthProfile,
  normalizedBirth: ReturnType<typeof normalizeBirthProfile>,
  ruleConfig: RuleConfig
): IztroAstrolabe {
  const fixLeap = ruleConfig.leap_month_policy === "split_leap_month";
  if (normalizedBirth.calendar_type === "gregorian") {
    return astro.bySolar(normalizedBirth.solar_date ?? profile.birth_date, normalizedBirth.time_index, normalizedBirth.engine_gender, fixLeap, "zh-CN") as IztroAstrolabe;
  }

  return astro.byLunar(
    normalizedBirth.lunar_date ?? profile.birth_date,
    normalizedBirth.time_index,
    normalizedBirth.engine_gender,
    profile.is_leap_month,
    fixLeap,
    "zh-CN"
  ) as IztroAstrolabe;
}

function mapAstrolabeToChart(astrolabe: IztroAstrolabe, trace: CalculationTrace[]): Chart {
  const palaceIds = astrolabe.palaces.map((palace) => palaceIdForName(palace.name));
  const palaces: Palace[] = astrolabe.palaces.map((palace, index) => mapPalace(palace, index, palaceIds));
  trace.push({ step: "map_palaces", output: { count: palaces.length } });

  const stars = astrolabe.palaces.flatMap((palace) => mapStars(palace));
  trace.push({ step: "map_stars", output: { count: stars.length } });

  const transforms = astrolabe.palaces.flatMap((palace) => mapTransforms(palace));
  trace.push({ step: "map_transforms", output: { count: transforms.length } });

  const majorPeriods = astrolabe.palaces.map((palace) => mapMajorPeriod(palace));
  trace.push({ step: "map_major_periods", output: { count: majorPeriods.length } });

  return {
    palaces,
    stars,
    transforms,
    major_periods: majorPeriods
  };
}

function mapPalace(palace: IztroPalace, index: number, palaceIds: string[]): Palace {
  const allStars = [...(palace.majorStars ?? []), ...(palace.minorStars ?? []), ...(palace.adjectiveStars ?? [])];
  const transforms = allStars.map((star) => (star.mutagen ? transformMap[star.mutagen] : undefined)).filter(isDefined);

  return {
    palace_id: palaceIdForName(palace.name),
    name: palace.name.endsWith("宫") ? palace.name : `${palace.name}宫`,
    branch: palace.earthlyBranch,
    stem: palace.heavenlyStem,
    main_stars: (palace.majorStars ?? []).map((star) => star.name).filter(isDefined),
    support_stars: [...(palace.minorStars ?? []), ...(palace.adjectiveStars ?? [])].map((star) => star.name).filter(isDefined),
    transforms,
    strength_score: null,
    relation_refs: {
      opposite: palaceIds[(index + 6) % 12],
      triad: [palaceIds[(index + 4) % 12], palaceIds[(index + 8) % 12]],
      neighbors: [palaceIds[(index + 11) % 12], palaceIds[(index + 1) % 12]]
    }
  };
}

function mapStars(palace: IztroPalace): Star[] {
  return [
    ...(palace.majorStars ?? []).map((star) => toStar(star, palace, "major")),
    ...(palace.minorStars ?? []).map((star) => toStar(star, palace, star.type === "tianma" ? "tianma" : "minor")),
    ...(palace.adjectiveStars ?? []).map((star) => toStar(star, palace, "adjective"))
  ];
}

function toStar(star: IztroStar, palace: IztroPalace, category: Star["category"]): Star {
  return {
    name: star.name ?? "未知星曜",
    category,
    palace_id: palaceIdForName(palace.name),
    element: null,
    brightness: star.brightness || null,
    tags: [category]
  };
}

function mapTransforms(palace: IztroPalace): Transform[] {
  const stars = [...(palace.majorStars ?? []), ...(palace.minorStars ?? []), ...(palace.adjectiveStars ?? [])];
  return stars
    .filter((star) => star.name && star.mutagen && transformMap[star.mutagen])
    .map((star) => ({
      type: transformMap[star.mutagen as keyof typeof transformMap],
      star: star.name as string,
      source_stem: palace.heavenlyStem || null,
      palace_id: palaceIdForName(palace.name)
    }));
}

function mapMajorPeriod(palace: IztroPalace): MajorPeriod {
  const range = palace.decadal?.range ?? [0, 0];
  return {
    period_id: `major_${String(palace.index + 1).padStart(3, "0")}`,
    age_start: range[0] ?? 0,
    age_end: range[1] ?? 0,
    palace_id: palaceIdForName(palace.name),
    direction: "unknown"
  };
}

function palaceIdForName(name: string): string {
  return palaceIdByName[name] ?? palaceIdByName[name.replace(/宫$/, "")] ?? `palace_${name}`;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function buildWarnings(profile: BirthProfile): Array<{ code: string; message: string }> {
  const warnings = [
    {
      code: "CONSULTANT_SAMPLE_REQUIRED",
      message: "排盘正确性仍需使用顾问确认样例盘持续校验。"
    }
  ];

  if (profile.gender_rule === "traditional_unspecified") {
    warnings.push({
      code: "GENDER_RULE_DEFAULTED_FOR_ENGINE",
      message: "传统算法字段未指定时，底层排盘库需要临时默认值；阶段评审需确认产品策略。"
    });
  }

  if (profile.true_solar_time_enabled) {
    warnings.push({
      code: "TRUE_SOLAR_TIME_NOT_APPLIED",
      message: "阶段 1 保留真太阳时字段，但默认不进行真太阳时换算。"
    });
  }

  return warnings;
}

function createChartId(): string {
  return `chart_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}_${Math.random().toString(36).slice(2, 8)}`;
}
