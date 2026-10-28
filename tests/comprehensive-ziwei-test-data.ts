/**
 * 紫微斗数全面测试数据集
 * 包含多种生辰样本，覆盖不同性别、时辰、农历/公历等情况
 */

export interface TestBirthProfile {
  display_name: string;
  calendar_type: "gregorian" | "lunar";
  birth_date: string;
  birth_time: string;
  timezone: string;
  location: {
    name: string;
    longitude: number;
    latitude: number;
  };
  is_leap_month: boolean;
  true_solar_time_enabled: boolean;
  gender_rule: "traditional_male" | "traditional_female";
  description: string;
}

// 基础测试样本
export const testSamples: TestBirthProfile[] = [
  // 1. 公历男性 - 子时初
  {
    display_name: "公历男性-子时初",
    calendar_type: "gregorian",
    birth_date: "2000-08-16",
    birth_time: "00:30",
    timezone: "Asia/Shanghai",
    location: { name: "上海", longitude: 121.4737, latitude: 31.2304 },
    is_leap_month: false,
    true_solar_time_enabled: false,
    gender_rule: "traditional_male",
    description: "测试子时初（23:00-00:59）边界情况"
  },
  // 2. 公历女性 - 午时
  {
    display_name: "公历女性-午时",
    calendar_type: "gregorian",
    birth_date: "1995-03-15",
    birth_time: "12:30",
    timezone: "Asia/Shanghai",
    location: { name: "北京", longitude: 116.4074, latitude: 39.9042 },
    is_leap_month: false,
    true_solar_time_enabled: false,
    gender_rule: "traditional_female",
    description: "测试午时（11:00-12:59）"
  },
  // 3. 农历男性 - 闰月
  {
    display_name: "农历男性-闰月",
    calendar_type: "lunar",
    birth_date: "2023-03-15",
    birth_time: "08:30",
    timezone: "Asia/Shanghai",
    location: { name: "广州", longitude: 113.2644, latitude: 23.1291 },
    is_leap_month: true,
    true_solar_time_enabled: false,
    gender_rule: "traditional_male",
    description: "测试闰月情况"
  },
  // 4. 农历女性 - 晚子时
  {
    display_name: "农历女性-晚子时",
    calendar_type: "lunar",
    birth_date: "1990-06-20",
    birth_time: "23:30",
    timezone: "Asia/Shanghai",
    location: { name: "成都", longitude: 104.0657, latitude: 30.6595 },
    is_leap_month: false,
    true_solar_time_enabled: false,
    gender_rule: "traditional_female",
    description: "测试晚子时（23:00-23:59）换日规则"
  },
  // 5. 公历男性 - 辰时（真太阳时启用）
  {
    display_name: "公历男性-辰时-真太阳时",
    calendar_type: "gregorian",
    birth_date: "1988-12-25",
    birth_time: "08:30",
    timezone: "Asia/Shanghai",
    location: { name: "西安", longitude: 108.9402, latitude: 34.2613 },
    is_leap_month: false,
    true_solar_time_enabled: true,
    gender_rule: "traditional_male",
    description: "测试真太阳时启用情况"
  },
  // 6. 农历男性 - 寅时
  {
    display_name: "农历男性-寅时",
    calendar_type: "lunar",
    birth_date: "1985-09-10",
    birth_time: "04:30",
    timezone: "Asia/Shanghai",
    location: { name: "武汉", longitude: 114.3054, latitude: 30.5931 },
    is_leap_month: false,
    true_solar_time_enabled: false,
    gender_rule: "traditional_male",
    description: "测试寅时（03:00-04:59）"
  },
  // 7. 公历女性 - 酉时
  {
    display_name: "公历女性-酉时",
    calendar_type: "gregorian",
    birth_date: "1992-05-08",
    birth_time: "18:30",
    timezone: "Asia/Shanghai",
    location: { name: "南京", longitude: 118.7969, latitude: 32.0603 },
    is_leap_month: false,
    true_solar_time_enabled: false,
    gender_rule: "traditional_female",
    description: "测试酉时（17:00-18:59）"
  },
  // 8. 农历男性 - 丑时
  {
    display_name: "农历男性-丑时",
    calendar_type: "lunar",
    birth_date: "1978-11-28",
    birth_time: "02:30",
    timezone: "Asia/Shanghai",
    location: { name: "重庆", longitude: 106.5516, latitude: 29.5630 },
    is_leap_month: false,
    true_solar_time_enabled: false,
    gender_rule: "traditional_male",
    description: "测试丑时（01:00-02:59）"
  },
  // 9. 公历女性 - 亥时
  {
    display_name: "公历女性-亥时",
    calendar_type: "gregorian",
    birth_date: "2005-01-12",
    birth_time: "22:30",
    timezone: "Asia/Shanghai",
    location: { name: "天津", longitude: 117.1909, latitude: 39.1252 },
    is_leap_month: false,
    true_solar_time_enabled: false,
    gender_rule: "traditional_female",
    description: "测试亥时（21:00-22:59）"
  },
  // 10. 农历男性 - 巳时
  {
    display_name: "农历男性-巳时",
    calendar_type: "lunar",
    birth_date: "1999-04-12",
    birth_time: "10:30",
    timezone: "Asia/Shanghai",
    location: { name: "杭州", longitude: 120.1551, latitude: 30.2741 },
    is_leap_month: false,
    true_solar_time_enabled: false,
    gender_rule: "traditional_male",
    description: "测试巳时（09:00-10:59）"
  }
];

// 边界测试样本
export const boundaryTestSamples: TestBirthProfile[] = [
  // 子时边界 - 22:59
  {
    display_name: "子时边界-22:59",
    calendar_type: "gregorian",
    birth_date: "2000-01-01",
    birth_time: "22:59",
    timezone: "Asia/Shanghai",
    location: { name: "上海", longitude: 121.4737, latitude: 31.2304 },
    is_leap_month: false,
    true_solar_time_enabled: false,
    gender_rule: "traditional_male",
    description: "测试亥时末尾边界（22:59）"
  },
  // 子时边界 - 23:00
  {
    display_name: "子时边界-23:00",
    calendar_type: "gregorian",
    birth_date: "2000-01-01",
    birth_time: "23:00",
    timezone: "Asia/Shanghai",
    location: { name: "上海", longitude: 121.4737, latitude: 31.2304 },
    is_leap_month: false,
    true_solar_time_enabled: false,
    gender_rule: "traditional_male",
    description: "测试子时开始边界（23:00）"
  },
  // 子时边界 - 00:00
  {
    display_name: "子时边界-00:00",
    calendar_type: "gregorian",
    birth_date: "2000-01-02",
    birth_time: "00:00",
    timezone: "Asia/Shanghai",
    location: { name: "上海", longitude: 121.4737, latitude: 31.2304 },
    is_leap_month: false,
    true_solar_time_enabled: false,
    gender_rule: "traditional_male",
    description: "测试子时结束边界（00:00）"
  },
  // 子时边界 - 00:59
  {
    display_name: "子时边界-00:59",
    calendar_type: "gregorian",
    birth_date: "2000-01-02",
    birth_time: "00:59",
    timezone: "Asia/Shanghai",
    location: { name: "上海", longitude: 121.4737, latitude: 31.2304 },
    is_leap_month: false,
    true_solar_time_enabled: false,
    gender_rule: "traditional_male",
    description: "测试子时结束边界（00:59）"
  },
  // 子时边界 - 01:00
  {
    display_name: "子时边界-01:00",
    calendar_type: "gregorian",
    birth_date: "2000-01-02",
    birth_time: "01:00",
    timezone: "Asia/Shanghai",
    location: { name: "上海", longitude: 121.4737, latitude: 31.2304 },
    is_leap_month: false,
    true_solar_time_enabled: false,
    gender_rule: "traditional_male",
    description: "测试丑时开始边界（01:00）"
  }
];

// 异常测试样本
export const invalidTestSamples = [
  {
    name: "无效时间格式",
    profile: {
      display_name: "无效时间",
      calendar_type: "gregorian" as const,
      birth_date: "2000-01-01",
      birth_time: "25:00",
      timezone: "Asia/Shanghai",
      location: { name: "上海", longitude: 121.4737, latitude: 31.2304 },
      is_leap_month: false,
      true_solar_time_enabled: false,
      gender_rule: "traditional_male" as const
    }
  },
  {
    name: "无效日期格式",
    profile: {
      display_name: "无效日期",
      calendar_type: "gregorian" as const,
      birth_date: "2000-13-01",
      birth_time: "12:00",
      timezone: "Asia/Shanghai",
      location: { name: "上海", longitude: 121.4737, latitude: 31.2304 },
      is_leap_month: false,
      true_solar_time_enabled: false,
      gender_rule: "traditional_male" as const
    }
  },
  {
    name: "空时区",
    profile: {
      display_name: "空时区",
      calendar_type: "gregorian" as const,
      birth_date: "2000-01-01",
      birth_time: "12:00",
      timezone: "",
      location: { name: "上海", longitude: 121.4737, latitude: 31.2304 },
      is_leap_month: false,
      true_solar_time_enabled: false,
      gender_rule: "traditional_male" as const
    }
  }
];

// 验证数据 - 用于交叉验证的已知正确结果
export const verificationData = {
  // 2000年8月16日 03:30 上海 男性（公历）
  "2000-08-16-03:30-male": {
    expected: {
      solarDate: "2000-8-16",
      lunarDate: "2000-7-17", // 农历对应日期
      timeIndex: 2, // 寅时
      soulPalaceBranch: "寅", // 命宫地支
      bodyPalaceBranch: "午", // 身宫地支
      fiveElementsClass: "水二局", // 五行局
      mainStarsInLifePalace: ["紫微", "天府"], // 命宫主星
      transforms: ["化禄", "化权", "化科", "化忌"] // 四化
    }
  }
};