/**
 * 紫微斗数最终测试脚本
 * 验证所有核心功能
 */

import { astro } from "iztro";

console.log("=== 紫微斗数最终测试 ===\n");

// 测试样本
const testCases = [
  {
    name: "公历男性-子时初",
    solarDate: "2000-8-16",
    timeIndex: 0,
    gender: "男"
  },
  {
    name: "公历女性-午时",
    solarDate: "1995-3-15",
    timeIndex: 6,
    gender: "女"
  },
  {
    name: "农历男性-闰月",
    lunarDate: "2023-3-15",
    timeIndex: 4,
    gender: "男",
    isLeapMonth: true
  },
  {
    name: "农历女性-晚子时",
    lunarDate: "1990-6-20",
    timeIndex: 12,
    gender: "女",
    isLeapMonth: false
  },
  {
    name: "公历男性-寅时",
    solarDate: "1988-12-25",
    timeIndex: 2,
    gender: "男"
  }
];

let passed = 0;
let failed = 0;

function runTest(testName, testFn) {
  try {
    const result = testFn();
    if (result) {
      console.log(`✅ ${testName}: 通过`);
      passed++;
    } else {
      console.log(`❌ ${testName}: 失败`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ ${testName}: 错误 - ${error.message}`);
    failed++;
  }
}

// 1. 测试命盘创建
console.log("1. 命盘创建测试");
testCases.forEach(testCase => {
  runTest(testCase.name, () => {
    let astrolabe;
    if (testCase.solarDate) {
      astrolabe = astro.bySolar(testCase.solarDate, testCase.timeIndex, testCase.gender, false, "zh-CN");
    } else {
      astrolabe = astro.byLunar(testCase.lunarDate, testCase.timeIndex, testCase.gender, testCase.isLeapMonth, false, "zh-CN");
    }
    return astrolabe && astrolabe.palaces.length === 12;
  });
});

// 2. 测试十二宫位
console.log("\n2. 十二宫位测试");
testCases.forEach(testCase => {
  runTest(testCase.name, () => {
    let astrolabe;
    if (testCase.solarDate) {
      astrolabe = astro.bySolar(testCase.solarDate, testCase.timeIndex, testCase.gender, false, "zh-CN");
    } else {
      astrolabe = astro.byLunar(testCase.lunarDate, testCase.timeIndex, testCase.gender, testCase.isLeapMonth, false, "zh-CN");
    }
    const palaceNames = astrolabe.palaces.map(p => p.name);
    const expected = ["命宫", "兄弟", "夫妻", "子女", "财帛", "疾厄", "迁移", "仆役", "官禄", "田宅", "福德", "父母"];
    return expected.every(name => palaceNames.includes(name));
  });
});

// 3. 测试主星落宫
console.log("\n3. 主星落宫测试");
testCases.forEach(testCase => {
  runTest(testCase.name, () => {
    let astrolabe;
    if (testCase.solarDate) {
      astrolabe = astro.bySolar(testCase.solarDate, testCase.timeIndex, testCase.gender, false, "zh-CN");
    } else {
      astrolabe = astro.byLunar(testCase.lunarDate, testCase.timeIndex, testCase.gender, testCase.isLeapMonth, false, "zh-CN");
    }
    const majorStars = astrolabe.palaces.flatMap(p => p.majorStars || []);
    const required = ["紫微", "天机", "太阳", "武曲", "天同", "廉贞", "天府", "太阴", "贪狼", "巨门", "天相", "天梁", "七杀", "破军"];
    return required.every(star => majorStars.some(s => s.name === star));
  });
});

// 4. 测试四化飞星
console.log("\n4. 四化飞星测试");
testCases.forEach(testCase => {
  runTest(testCase.name, () => {
    let astrolabe;
    if (testCase.solarDate) {
      astrolabe = astro.bySolar(testCase.solarDate, testCase.timeIndex, testCase.gender, false, "zh-CN");
    } else {
      astrolabe = astro.byLunar(testCase.lunarDate, testCase.timeIndex, testCase.gender, testCase.isLeapMonth, false, "zh-CN");
    }
    const allStars = astrolabe.palaces.flatMap(p => [...(p.majorStars || []), ...(p.minorStars || []), ...(p.adjectiveStars || [])]);
    const transforms = allStars.filter(s => s.mutagen);
    return transforms.length === 4;
  });
});

// 5. 测试大限流转
console.log("\n5. 大限流转测试");
testCases.forEach(testCase => {
  runTest(testCase.name, () => {
    let astrolabe;
    if (testCase.solarDate) {
      astrolabe = astro.bySolar(testCase.solarDate, testCase.timeIndex, testCase.gender, false, "zh-CN");
    } else {
      astrolabe = astro.byLunar(testCase.lunarDate, testCase.timeIndex, testCase.gender, testCase.isLeapMonth, false, "zh-CN");
    }
    const majorPeriods = astrolabe.palaces.filter(p => p.decadal);
    return majorPeriods.length === 12;
  });
});

// 6. 测试星曜亮度
console.log("\n6. 星曜亮度测试");
testCases.forEach(testCase => {
  runTest(testCase.name, () => {
    let astrolabe;
    if (testCase.solarDate) {
      astrolabe = astro.bySolar(testCase.solarDate, testCase.timeIndex, testCase.gender, false, "zh-CN");
    } else {
      astrolabe = astro.byLunar(testCase.lunarDate, testCase.timeIndex, testCase.gender, testCase.isLeapMonth, false, "zh-CN");
    }
    const allStars = astrolabe.palaces.flatMap(p => [...(p.majorStars || []), ...(p.minorStars || []), ...(p.adjectiveStars || [])]);
    const validBrightness = ["庙", "旺", "得", "利", "平", "不", "陷"];
    return allStars.every(star => !star.brightness || validBrightness.includes(star.brightness));
  });
});

// 7. 测试三方四正
console.log("\n7. 三方四正测试");
testCases.forEach(testCase => {
  runTest(testCase.name, () => {
    let astrolabe;
    if (testCase.solarDate) {
      astrolabe = astro.bySolar(testCase.solarDate, testCase.timeIndex, testCase.gender, false, "zh-CN");
    } else {
      astrolabe = astro.byLunar(testCase.lunarDate, testCase.timeIndex, testCase.gender, testCase.isLeapMonth, false, "zh-CN");
    }
    const branches = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
    return astrolabe.palaces.every(palace => {
      const index = branches.indexOf(palace.earthlyBranch);
      const opposite = branches[(index + 6) % 12];
      const triad1 = branches[(index + 4) % 12];
      const triad2 = branches[(index + 8) % 12];
      return astrolabe.palaces.some(p => p.earthlyBranch === opposite) &&
             astrolabe.palaces.some(p => p.earthlyBranch === triad1) &&
             astrolabe.palaces.some(p => p.earthlyBranch === triad2);
    });
  });
});

// 输出结果
console.log("\n\n=== 测试结果 ===");
console.log(`通过: ${passed}`);
console.log(`失败: ${failed}`);
console.log(`总计: ${passed + failed}`);
console.log(`通过率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failed === 0) {
  console.log("\n✅ 所有测试通过！紫微斗数测算功能工作正常。");
} else {
  console.log("\n❌ 存在测试失败，需要检查功能。");
}

console.log("\n=== 测试完成 ===");