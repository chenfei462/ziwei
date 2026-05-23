import type { RuleConfig } from "./types.js";

export const defaultRuleConfig: RuleConfig = {
  school_id: "default_ziwei_v0_1",
  zi_hour_day_boundary: "civil_midnight",
  leap_month_policy: "same_month_number",
  true_solar_time_policy: "disabled",
  four_transform_policy: "default_stem",
  interpretation_style: "balanced_modern"
};

export const defaultRuleTable = {
  version: "v0.1",
  palaceOrder: ["命宫", "兄弟", "夫妻", "子女", "财帛", "疾厄", "迁移", "仆役", "官禄", "田宅", "福德", "父母"],
  branchOrderFromYin: ["寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑"],
  requiredMajorStars: [
    "紫微",
    "天机",
    "太阳",
    "武曲",
    "天同",
    "廉贞",
    "天府",
    "太阴",
    "贪狼",
    "巨门",
    "天相",
    "天梁",
    "七杀",
    "破军"
  ],
  supportStarsMvp: ["左辅", "右弼", "文昌", "文曲", "天魁", "天钺", "禄存", "天马", "擎羊", "陀罗", "火星", "铃星"],
  transformMap: {
    禄: "hua_lu",
    权: "hua_quan",
    科: "hua_ke",
    忌: "hua_ji"
  },
  privacyDefaults: {
    share_birth_date: false,
    share_birth_time: false,
    share_location: false
  }
} as const;
