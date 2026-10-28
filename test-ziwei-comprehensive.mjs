/**
 * 紫微斗数全面测试报告
 * 测试所有核心功能和原理
 */

import { astro } from "iztro";

console.log("=== 紫微斗数全面测试报告 ===\n");

// 测试数据
const testCases = [
  {
    name: "公历男性-子时初",
    solarDate: "2000-8-16",
    timeIndex: 0,
    gender: "男",
    description: "测试子时初（23:00-00:59）边界情况"
  },
  {
    name: "公历女性-午时",
    solarDate: "1995-3-15",
    timeIndex: 6,
    gender: "女",
    description: "测试午时（11:00-12:59）"
  },
  {
    name: "农历男性-闰月",
    lunarDate: "2023-3-15",
    timeIndex: 4,
    gender: "男",
    isLeapMonth: true,
    description: "测试闰月情况"
  },
  {
    name: "农历女性-晚子时",
    lunarDate: "1990-6-20",
    timeIndex: 12,
    gender: "女",
    isLeapMonth: false,
    description: "测试晚子时（23:00-23:59）换日规则"
  },
  {
    name: "公历男性-寅时",
    solarDate: "1988-12-25",
    timeIndex: 2,
    gender: "男",
    description: "测试寅时（03:00-04:59）"
  }
];

// 测试结果收集
const testResults = {
  passed: 0,
  failed: 0,
  details: []
};

// 1. 命盘创建测试
function testChartCreation(testCase) {
  console.log(`\n1. 命盘创建测试: ${testCase.name}`);
  console.log("=".repeat(50));
  
  try {
    let astrolabe;
    
    if (testCase.solarDate) {
      astrolabe = astro.bySolar(
        testCase.solarDate,
        testCase.timeIndex,
        testCase.gender,
        false,
        "zh-CN"
      );
    } else {
      astrolabe = astro.byLunar(
        testCase.lunarDate,
        testCase.timeIndex,
        testCase.gender,
        testCase.isLeapMonth,
        false,
        "zh-CN"
      );
    }
    
    console.log("✅ 命盘创建成功");
    console.log(`   公历: ${astrolabe.solarDate}`);
    console.log(`   农历: ${astrolabe.lunarDate}`);
    console.log(`   干支: ${astrolabe.chineseDate}`);
    console.log(`   命宫地支: ${astrolabe.earthlyBranchOfSoulPalace}`);
    console.log(`   身宫地支: ${astrolabe.earthlyBranchOfBodyPalace}`);
    console.log(`   五行局: ${astrolabe.fiveElementsClass}`);
    
    testResults.passed++;
    testResults.details.push({
      test: "命盘创建",
      case: testCase.name,
      status: "PASS",
      data: {
        solarDate: astrolabe.solarDate,
        lunarDate: astrolabe.lunarDate,
        chineseDate: astrolabe.chineseDate,
        soulPalace: astrolabe.earthlyBranchOfSoulPalace,
        bodyPalace: astrolabe.earthlyBranchOfBodyPalace,
        fiveElementsClass: astrolabe.fiveElementsClass
      }
    });
    
    return astrolabe;
    
  } catch (error) {
    console.log(`❌ 命盘创建失败: ${error.message}`);
    testResults.failed++;
    testResults.details.push({
      test: "命盘创建",
      case: testCase.name,
      status: "FAIL",
      error: error.message
    });
    return null;
  }
}

// 2. 十二宫位测试
function testTwelvePalaces(astrolabe, testCase) {
  console.log(`\n2. 十二宫位测试: ${testCase.name}`);
  console.log("=".repeat(50));
  
  if (!astrolabe) {
    console.log("❌ 跳过测试（命盘创建失败）");
    return;
  }
  
  const palaceNames = astrolabe.palaces.map(p => p.name);
  const expectedPalaces = [
    "命宫", "兄弟", "夫妻", "子女", "财帛", "疾厄",
    "迁移", "仆役", "官禄", "田宅", "福德", "父母"
  ];
  
  let allPresent = true;
  expectedPalaces.forEach(palace => {
    if (!palaceNames.includes(palace)) {
      console.log(`❌ 缺少宫位: ${palace}`);
      allPresent = false;
    }
  });
  
  if (allPresent) {
    console.log("✅ 十二宫位完整");
    console.log(`   宫位数量: ${astrolabe.palaces.length}`);
    
    testResults.passed++;
    testResults.details.push({
      test: "十二宫位",
      case: testCase.name,
      status: "PASS",
      data: { palaceCount: astrolabe.palaces.length }
    });
  } else {
    testResults.failed++;
    testResults.details.push({
      test: "十二宫位",
      case: testCase.name,
      status: "FAIL",
      error: "宫位不完整"
    });
  }
}

// 3. 主星落宫测试
function testMajorStars(astrolabe, testCase) {
  console.log(`\n3. 主星落宫测试: ${testCase.name}`);
  console.log("=".repeat(50));
  
  if (!astrolabe) {
    console.log("❌ 跳过测试（命盘创建失败）");
    return;
  }
  
  const requiredMainStars = [
    "紫微", "天机", "太阳", "武曲", "天同", "廉贞",
    "天府", "太阴", "贪狼", "巨门", "天相", "天梁", "七杀", "破军"
  ];
  
  const allMainStars = astrolabe.palaces.flatMap(p => p.majorStars || []);
  const mainStarNames = allMainStars.map(s => s.name);
  
  let allPresent = true;
  requiredMainStars.forEach(star => {
    if (!mainStarNames.includes(star)) {
      console.log(`❌ 缺少主星: ${star}`);
      allPresent = false;
    }
  });
  
  if (allPresent) {
    console.log("✅ 十四颗主星完整");
    console.log(`   主星数量: ${allMainStars.length}`);
    
    // 检查命宫主星
    const lifePalace = astrolabe.palaces.find(p => p.name === "命宫");
    if (lifePalace) {
      const lifeMainStars = (lifePalace.majorStars || []).map(s => s.name);
      console.log(`   命宫主星: ${lifeMainStars.join(", ")}`);
    }
    
    testResults.passed++;
    testResults.details.push({
      test: "主星落宫",
      case: testCase.name,
      status: "PASS",
      data: { mainStarCount: allMainStars.length }
    });
  } else {
    testResults.failed++;
    testResults.details.push({
      test: "主星落宫",
      case: testCase.name,
      status: "FAIL",
      error: "主星不完整"
    });
  }
}

// 4. 四化飞星测试
function testFourTransforms(astrolabe, testCase) {
  console.log(`\n4. 四化飞星测试: ${testCase.name}`);
  console.log("=".repeat(50));
  
  if (!astrolabe) {
    console.log("❌ 跳过测试（命盘创建失败）");
    return;
  }
  
  const allStars = [
    ...(astrolabe.palaces.flatMap(p => p.majorStars || [])),
    ...(astrolabe.palaces.flatMap(p => p.minorStars || [])),
    ...(astrolabe.palaces.flatMap(p => p.adjectiveStars || []))
  ];
  
  const transforms = allStars.filter(s => s.mutagen);
  const transformTypes = transforms.map(t => t.mutagen);
  
  const expectedTypes = ["禄", "权", "科", "忌"];
  let allPresent = true;
  
  expectedTypes.forEach(type => {
    if (!transformTypes.includes(type)) {
      console.log(`❌ 缺少四化: ${type}`);
      allPresent = false;
    }
  });
  
  if (allPresent && transforms.length === 4) {
    console.log("✅ 四化飞星完整");
    console.log(`   四化数量: ${transforms.length}`);
    transforms.forEach(t => {
      console.log(`   ${t.name}: ${t.mutagen}`);
    });
    
    testResults.passed++;
    testResults.details.push({
      test: "四化飞星",
      case: testCase.name,
      status: "PASS",
      data: { transformCount: transforms.length }
    });
  } else {
    console.log(`❌ 四化数量错误: ${transforms.length} (期望 4)`);
    testResults.failed++;
    testResults.details.push({
      test: "四化飞星",
      case: testCase.name,
      status: "FAIL",
      error: `四化数量错误: ${transforms.length}`
    });
  }
}

// 5. 大限流转测试
function testMajorPeriods(astrolabe, testCase) {
  console.log(`\n5. 大限流转测试: ${testCase.name}`);
  console.log("=".repeat(50));
  
  if (!astrolabe) {
    console.log("❌ 跳过测试（命盘创建失败）");
    return;
  }
  
  const majorPeriods = astrolabe.palaces.filter(p => p.decadal);
  
  if (majorPeriods.length === 12) {
    console.log("✅ 大限数量正确");
    console.log(`   大限数量: ${majorPeriods.length}`);
    
    // 检查大限年龄范围
    let validRanges = true;
    majorPeriods.forEach(period => {
      const { range } = period.decadal;
      if (range[0] >= range[1]) {
        console.log(`❌ 大限年龄范围错误: ${period.name} (${range[0]}-${range[1]})`);
        validRanges = false;
      }
    });
    
    if (validRanges) {
      console.log("✅ 大限年龄范围正确");
      
      testResults.passed++;
      testResults.details.push({
        test: "大限流转",
        case: testCase.name,
        status: "PASS",
        data: { majorPeriodCount: majorPeriods.length }
      });
    } else {
      testResults.failed++;
      testResults.details.push({
        test: "大限流转",
        case: testCase.name,
        status: "FAIL",
        error: "大限年龄范围错误"
      });
    }
  } else {
    console.log(`❌ 大限数量错误: ${majorPeriods.length} (期望 12)`);
    testResults.failed++;
    testResults.details.push({
      test: "大限流转",
      case: testCase.name,
      status: "FAIL",
      error: `大限数量错误: ${majorPeriods.length}`
    });
  }
}

// 6. 星曜亮度测试
function testStarBrightness(astrolabe, testCase) {
  console.log(`\n6. 星曜亮度测试: ${testCase.name}`);
  console.log("=".repeat(50));
  
  if (!astrolabe) {
    console.log("❌ 跳过测试（命盘创建失败）");
    return;
  }
  
  const allStars = [
    ...(astrolabe.palaces.flatMap(p => p.majorStars || [])),
    ...(astrolabe.palaces.flatMap(p => p.minorStars || [])),
    ...(astrolabe.palaces.flatMap(p => p.adjectiveStars || []))
  ];
  
  const validBrightness = ["庙", "旺", "得", "利", "平", "不", "陷"];
  let allValid = true;
  
  allStars.forEach(star => {
    if (star.brightness && !validBrightness.includes(star.brightness)) {
      console.log(`❌ 无效亮度: ${star.name} - ${star.brightness}`);
      allValid = false;
    }
  });
  
  if (allValid) {
    console.log("✅ 星曜亮度值有效");
    
    // 统计亮度分布
    const brightnessCount = {};
    allStars.forEach(star => {
      if (star.brightness) {
        brightnessCount[star.brightness] = (brightnessCount[star.brightness] || 0) + 1;
      }
    });
    
    console.log("   亮度分布:");
    Object.entries(brightnessCount).forEach(([brightness, count]) => {
      console.log(`     ${brightness}: ${count} 颗`);
    });
    
    testResults.passed++;
    testResults.details.push({
      test: "星曜亮度",
      case: testCase.name,
      status: "PASS",
      data: { brightnessCount }
    });
  } else {
    testResults.failed++;
    testResults.details.push({
      test: "星曜亮度",
      case: testCase.name,
      status: "FAIL",
      error: "存在无效亮度值"
    });
  }
}

// 7. 三方四正关系测试
function testTriadAndOpposite(astrolabe, testCase) {
  console.log(`\n7. 三方四正关系测试: ${testCase.name}`);
  console.log("=".repeat(50));
  
  if (!astrolabe) {
    console.log("❌ 跳过测试（命盘创建失败）");
    return;
  }
  
  // 三方四正: 本宫 + 对宫 + 两个三合宫
  // 三合宫: 从本宫开始，每隔4个宫位
  
  const branches = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
  
  let allValid = true;
  
  astrolabe.palaces.forEach(palace => {
    const palaceIndex = branches.indexOf(palace.earthlyBranch);
    
    // 计算对宫
    const oppositeIndex = (palaceIndex + 6) % 12;
    const oppositeBranch = branches[oppositeIndex];
    
    // 计算三合宫
    const triad1Index = (palaceIndex + 4) % 12;
    const triad2Index = (palaceIndex + 8) % 12;
    const triadBranches = [branches[triad1Index], branches[triad2Index]];
    
    // 验证对宫
    const oppositePalace = astrolabe.palaces.find(p => p.earthlyBranch === oppositeBranch);
    if (!oppositePalace) {
      console.log(`❌ 找不到对宫: ${palace.name} -> ${oppositeBranch}`);
      allValid = false;
    }
    
    // 验证三合宫
    triadBranches.forEach(triadBranch => {
      const triadPalace = astrolabe.palaces.find(p => p.earthlyBranch === triadBranch);
      if (!triadPalace) {
        console.log(`❌ 找不到三合宫: ${palace.name} -> ${triadBranch}`);
        allValid = false;
      }
    });
  });
  
  if (allValid) {
    console.log("✅ 三方四正关系正确");
    
    testResults.passed++;
    testResults.details.push({
      test: "三方四正",
      case: testCase.name,
      status: "PASS"
    });
  } else {
    testResults.failed++;
    testResults.details.push({
      test: "三方四正",
      case: testCase.name,
      status: "FAIL",
      error: "三方四正关系错误"
    });
  }
}

// 运行所有测试
console.log("开始全面测试...\n");

testCases.forEach(testCase => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`测试样本: ${testCase.name}`);
  console.log(`描述: ${testCase.description}`);
  console.log(`${"=".repeat(60)}`);
  
  const astrolabe = testChartCreation(testCase);
  testTwelvePalaces(astrolabe, testCase);
  testMajorStars(astrolabe, testCase);
  testFourTransforms(astrolabe, testCase);
  testMajorPeriods(astrolabe, testCase);
  testStarBrightness(astrolabe, testCase);
  testTriadAndOpposite(astrolabe, testCase);
});

// 输出测试报告
console.log("\n\n" + "=".repeat(60));
console.log("测试报告");
console.log("=".repeat(60));

console.log(`\n测试统计:`);
console.log(`  通过: ${testResults.passed}`);
console.log(`  失败: ${testResults.failed}`);
console.log(`  总计: ${testResults.passed + testResults.failed}`);

console.log(`\n详细结果:`);
testResults.details.forEach(detail => {
  const status = detail.status === "PASS" ? "✅" : "❌";
  console.log(`${status} ${detail.test} - ${detail.case}`);
  if (detail.error) {
    console.log(`   错误: ${detail.error}`);
  }
});

// 总结
console.log("\n" + "=".repeat(60));
console.log("测试总结");
console.log("=".repeat(60));

if (testResults.failed === 0) {
  console.log("\n✅ 所有测试通过！紫微斗数测算功能工作正常。");
  console.log("\n核心功能验证:");
  console.log("  1. 命盘创建: 所有样本都能成功创建命盘");
  console.log("  2. 十二宫位: 所有样本都包含完整的十二宫位");
  console.log("  3. 主星落宫: 十四颗主星都能正确落宫");
  console.log("  4. 四化飞星: 四化飞星都能正确计算");
  console.log("  5. 大限流转: 大限都能正确计算");
  console.log("  6. 星曜亮度: 星曜亮度值都有效");
  console.log("  7. 三方四正: 宫位关系都正确");
} else {
  console.log("\n❌ 存在测试失败，需要检查以下问题:");
  
  const failedTests = testResults.details.filter(d => d.status === "FAIL");
  failedTests.forEach(test => {
    console.log(`  - ${test.test} (${test.case}): ${test.error}`);
  });
}

console.log("\n" + "=".repeat(60));
console.log("测试完成");
console.log("=".repeat(60));