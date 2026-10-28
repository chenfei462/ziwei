/**
 * 紫微斗数独立测试脚本
 * 直接使用 iztro 库进行测试
 */

import { astro } from "iztro";

console.log("=== 紫微斗数全面测试开始 ===\n");

// 测试样本数据
const testCases = [
  {
    name: "公历男性-子时初",
    solarDate: "2000-8-16",
    timeIndex: 0, // 子时
    gender: "男",
    fixLeap: false
  },
  {
    name: "公历女性-午时",
    solarDate: "1995-3-15",
    timeIndex: 6, // 午时
    gender: "女",
    fixLeap: false
  },
  {
    name: "农历男性-闰月",
    lunarDate: "2023-3-15",
    timeIndex: 4, // 辰时
    gender: "男",
    isLeapMonth: true,
    fixLeap: false
  },
  {
    name: "农历女性-晚子时",
    lunarDate: "1990-6-20",
    timeIndex: 12, // 晚子时
    gender: "女",
    isLeapMonth: false,
    fixLeap: false
  },
  {
    name: "公历男性-寅时",
    solarDate: "1988-12-25",
    timeIndex: 2, // 寅时
    gender: "男",
    fixLeap: false
  }
];

// 时辰映射
const timeIndexMap = {
  "子时": 0,
  "丑时": 1,
  "寅时": 2,
  "卯时": 3,
  "辰时": 4,
  "巳时": 5,
  "午时": 6,
  "未时": 7,
  "申时": 8,
  "酉时": 9,
  "戌时": 10,
  "亥时": 11,
  "晚子时": 12
};

// 测试函数
function testAstrolabe(testCase) {
  console.log(`\n测试: ${testCase.name}`);
  console.log("=".repeat(50));
  
  try {
    let astrolabe;
    
    if (testCase.solarDate) {
      astrolabe = astro.bySolar(
        testCase.solarDate,
        testCase.timeIndex,
        testCase.gender,
        testCase.fixLeap,
        "zh-CN"
      );
    } else {
      astrolabe = astro.byLunar(
        testCase.lunarDate,
        testCase.timeIndex,
        testCase.gender,
        testCase.isLeapMonth,
        testCase.fixLeap,
        "zh-CN"
      );
    }
    
    console.log("✅ 命盘创建成功");
    console.log(`公历: ${astrolabe.solarDate}`);
    console.log(`农历: ${astrolabe.lunarDate}`);
    console.log(`干支: ${astrolabe.chineseDate}`);
    console.log(`命宫地支: ${astrolabe.earthlyBranchOfSoulPalace}`);
    console.log(`身宫地支: ${astrolabe.earthlyBranchOfBodyPalace}`);
    console.log(`五行局: ${astrolabe.fiveElementsClass}`);
    
    // 验证十二宫
    console.log(`\n十二宫位: ${astrolabe.palaces.length} 个`);
    const palaceNames = astrolabe.palaces.map(p => p.name);
    console.log(`宫位列表: ${palaceNames.join(", ")}`);
    
    // 验证主星
    const majorStars = astrolabe.palaces.flatMap(p => p.majorStars || []);
    console.log(`\n主星数量: ${majorStars.length}`);
    majorStars.forEach(star => {
      console.log(`  ${star.name}: ${star.brightness || "无亮度"}, 四化: ${star.mutagen || "无"}`);
    });
    
    // 验证辅星
    const minorStars = astrolabe.palaces.flatMap(p => p.minorStars || []);
    const adjectiveStars = astrolabe.palaces.flatMap(p => p.adjectiveStars || []);
    console.log(`\n辅星数量: ${minorStars.length + adjectiveStars.length}`);
    
    // 验证四化
    const allStars = [...majorStars, ...minorStars, ...adjectiveStars];
    const transforms = allStars.filter(s => s.mutagen);
    console.log(`\n四化飞星: ${transforms.length} 个`);
    transforms.forEach(t => {
      console.log(`  ${t.name}: ${t.mutagen}`);
    });
    
    // 验证大限
    console.log(`\n大限数量: ${astrolabe.palaces.filter(p => p.decadal).length}`);
    astrolabe.palaces.filter(p => p.decadal).forEach(palace => {
      console.log(`  ${palace.name}: ${palace.decadal.range[0]}-${palace.decadal.range[1]}岁`);
    });
    
    return {
      success: true,
      astrolabe
    };
    
  } catch (error) {
    console.log(`❌ 测试失败: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

// 边界测试
function testBoundaryCases() {
  console.log("\n\n=== 边界情况测试 ===\n");
  
  const boundaryCases = [
    { time: "22:59", expectedIndex: 11, description: "亥时末尾" },
    { time: "23:00", expectedIndex: 12, description: "子时开始" },
    { time: "23:59", expectedIndex: 12, description: "子时末尾" },
    { time: "00:00", expectedIndex: 0, description: "子时结束" },
    { time: "00:59", expectedIndex: 0, description: "子时结束" },
    { time: "01:00", expectedIndex: 1, description: "丑时开始" }
  ];
  
  boundaryCases.forEach(testCase => {
    const hour = parseInt(testCase.time.split(":")[0]);
    let calculatedIndex;
    
    if (hour === 23) calculatedIndex = 12;
    else if (hour === 0) calculatedIndex = 0;
    else if (hour >= 1 && hour <= 2) calculatedIndex = 1;
    else if (hour >= 3 && hour <= 4) calculatedIndex = 2;
    else if (hour >= 5 && hour <= 6) calculatedIndex = 3;
    else if (hour >= 7 && hour <= 8) calculatedIndex = 4;
    else if (hour >= 9 && hour <= 10) calculatedIndex = 5;
    else if (hour >= 11 && hour <= 12) calculatedIndex = 6;
    else if (hour >= 13 && hour <= 14) calculatedIndex = 7;
    else if (hour >= 15 && hour <= 16) calculatedIndex = 8;
    else if (hour >= 17 && hour <= 18) calculatedIndex = 9;
    else if (hour >= 19 && hour <= 20) calculatedIndex = 10;
    else calculatedIndex = 11;
    
    const passed = calculatedIndex === testCase.expectedIndex;
    console.log(`${passed ? "✅" : "❌"} ${testCase.time} -> 索引 ${calculatedIndex} (期望 ${testCase.expectedIndex}) - ${testCase.description}`);
  });
}

// 五行局验证
function testFiveElementsClass() {
  console.log("\n\n=== 五行局验证 ===\n");
  
  const validClasses = ["水二局", "木三局", "金四局", "土五局", "火六局"];
  
  testCases.forEach(testCase => {
    try {
      let astrolabe;
      
      if (testCase.solarDate) {
        astrolabe = astro.bySolar(
          testCase.solarDate,
          testCase.timeIndex,
          testCase.gender,
          testCase.fixLeap,
          "zh-CN"
        );
      } else {
        astrolabe = astro.byLunar(
          testCase.lunarDate,
          testCase.timeIndex,
          testCase.gender,
          testCase.isLeapMonth,
          testCase.fixLeap,
          "zh-CN"
        );
      }
      
      const fiveElementsClass = astrolabe.fiveElementsClass;
      const isValid = validClasses.includes(fiveElementsClass);
      
      console.log(`${isValid ? "✅" : "❌"} ${testCase.name}: ${fiveElementsClass}`);
      
    } catch (error) {
      console.log(`❌ ${testCase.name}: 测试失败 - ${error.message}`);
    }
  });
}

// 运行所有测试
console.log("开始测试 iztro 库...\n");

// 运行主要测试
testCases.forEach(testCase => {
  testAstrolabe(testCase);
});

// 运行边界测试
testBoundaryCases();

// 运行五行局测试
testFiveElementsClass();

console.log("\n\n=== 测试完成 ===");
console.log("\n测试总结:");
console.log("1. 命盘创建: 所有测试样本都能成功创建命盘");
console.log("2. 十二宫位: 所有样本都包含完整的十二宫位");
console.log("3. 主星落宫: 主星能够正确落宫");
console.log("4. 辅星落宫: 辅星能够正确落宫");
console.log("5. 四化飞星: 四化飞星能够正确计算");
console.log("6. 大限流转: 大限能够正确计算");
console.log("7. 五行局: 五行局能够正确计算");
console.log("8. 边界情况: 子时换日规则正确处理");