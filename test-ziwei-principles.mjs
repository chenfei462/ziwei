/**
 * 紫微斗数原理验证测试
 * 验证核心算法和原理的准确性
 */

import { astro } from "iztro";

console.log("=== 紫微斗数原理验证测试 ===\n");

// 测试1: 命宫身宫定位原理
function testSoulBodyPalace() {
  console.log("1. 命宫身宫定位原理测试");
  console.log("=".repeat(50));
  
  // 命宫定位公式: 命宫 = 出生月数 + 出生时辰数 - 1 (从寅宫起算)
  // 身宫定位公式: 身宫 = 出生月数 + 出生时辰数 + 5 - 1 (从寅宫起算)
  
  const testCases = [
    { month: 7, hour: 0, expectedSoul: "申", expectedBody: "寅" }, // 2000-8-16 子时
    { month: 2, hour: 6, expectedSoul: "酉", expectedBody: "卯" }, // 1995-3-15 午时
    { month: 3, hour: 4, expectedSoul: "午", expectedBody: "子" }, // 2023-4-15 辰时
  ];
  
  testCases.forEach((testCase, index) => {
    const { month, hour, expectedSoul, expectedBody } = testCase;
    
    // 计算命宫地支索引 (从寅宫开始，寅=0，卯=1，...)
    const soulIndex = (month + hour - 1) % 12;
    const bodyIndex = (month + hour + 5 - 1) % 12;
    
    const branches = ["寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑"];
    const calculatedSoul = branches[soulIndex];
    const calculatedBody = branches[bodyIndex];
    
    console.log(`测试 ${index + 1}: 月=${month}, 时辰=${hour}`);
    console.log(`  命宫: 计算=${calculatedSoul}, 期望=${expectedSoul} ${calculatedSoul === expectedSoul ? "✅" : "❌"}`);
    console.log(`  身宫: 计算=${calculatedBody}, 期望=${expectedBody} ${calculatedBody === expectedBody ? "✅" : "❌"}`);
  });
  
  console.log("");
}

// 测试2: 五行局计算原理
function testFiveElementsClass() {
  console.log("2. 五行局计算原理测试");
  console.log("=".repeat(50));
  
  // 五行局基于命宫天干和地支的纳音五行
  // 测试不同命宫组合的五行局
  
  const testCases = [
    { soulStem: "丙", soulBranch: "申", expectedClass: "水二局" }, // 2000-8-16 子时
    { soulStem: "乙", soulBranch: "酉", expectedClass: "水二局" }, // 1995-3-15 午时
    { soulStem: "壬", soulBranch: "子", expectedClass: "木三局" }, // 2023-4-15 辰时
  ];
  
  testCases.forEach((testCase, index) => {
    console.log(`测试 ${index + 1}: 命宫天干=${testCase.soulStem}, 地支=${testCase.soulBranch}`);
    console.log(`  期望五行局: ${testCase.expectedClass}`);
    
    // 注意: 实际计算需要根据纳音五行表，这里仅展示原理
    console.log(`  原理: 五行局由命宫天干地支的纳音五行决定`);
  });
  
  console.log("");
}

// 测试3: 紫微星定位原理
function testZiweiPosition() {
  console.log("3. 紫微星定位原理测试");
  console.log("=".repeat(50));
  
  // 紫微星定位基于五行局和出生日数
  // 公式: 紫微星位置 = (出生日数 - 1) / 五行局数 + 命宫位置
  
  const testCases = [
    { day: 17, fiveElementsClass: "水二局", soulPalace: "申" },
    { day: 15, fiveElementsClass: "水二局", soulPalace: "酉" },
    { day: 15, fiveElementsClass: "金四局", soulPalace: "子" },
  ];
  
  testCases.forEach((testCase, index) => {
    console.log(`测试 ${index + 1}: 出生日=${testCase.day}, 五行局=${testCase.fiveElementsClass}, 命宫=${testCase.soulPalace}`);
    
    // 解析五行局数
    const classNumber = parseInt(testCase.fiveElementsClass.match(/\d+/)[0]);
    
    // 计算紫微星位置索引 (简化计算)
    const ziweiIndex = Math.floor((testCase.day - 1) / classNumber);
    
    const branches = ["寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑"];
    const soulIndex = branches.indexOf(testCase.soulPalace);
    const ziweiPosition = branches[(soulIndex + ziweiIndex) % 12];
    
    console.log(`  五行局数: ${classNumber}`);
    console.log(`  紫微星位置: ${ziweiPosition}`);
    console.log(`  原理: 紫微星位置由五行局和出生日数共同决定`);
  });
  
  console.log("");
}

// 测试4: 四化飞星原理
function testFourTransforms() {
  console.log("4. 四化飞星原理测试");
  console.log("=".repeat(50));
  
  // 四化基于年干
  // 甲干: 廉贞化禄, 破军化权, 武曲化科, 太阳化忌
  // 乙干: 天机化禄, 天梁化权, 紫微化科, 太阴化忌
  
  const yearStemTransforms = {
    "甲": { 禄: "廉贞", 权: "破军", 科: "武曲", 忌: "太阳" },
    "乙": { 禄: "天机", 权: "天梁", 科: "紫微", 忌: "太阴" },
    "丙": { 禄: "天同", 权: "天机", 科: "文昌", 忌: "廉贞" },
    "丁": { 禄: "太阴", 权: "天同", 科: "天机", 忌: "巨门" },
    "戊": { 禄: "贪狼", 权: "太阴", 科: "右弼", 忌: "天机" },
    "己": { 禄: "武曲", 权: "贪狼", 科: "天梁", 忌: "文曲" },
    "庚": { 禄: "太阳", 权: "武曲", 科: "太阴", 忌: "天同" },
    "辛": { 禄: "巨门", 权: "太阳", 科: "文曲", 忌: "文昌" },
    "壬": { 禄: "天同", 权: "天梁", 科: "左辅", 忌: "武曲" },
    "癸": { 禄: "破军", 权: "巨门", 科: "太阴", 忌: "贪狼" }
  };
  
  // 测试庚辰年 (2000年) 的四化
  const yearStem = "庚";
  const transforms = yearStemTransforms[yearStem];
  
  console.log(`${yearStem}年四化:`);
  console.log(`  化禄: ${transforms.禄}`);
  console.log(`  化权: ${transforms.权}`);
  console.log(`  化科: ${transforms.科}`);
  console.log(`  化忌: ${transforms.忌}`);
  
  console.log(`\n原理: 四化飞星基于出生年的天干，不同天干有不同的四化组合`);
  console.log("");
}

// 测试5: 大限流转原理
function testMajorPeriods() {
  console.log("5. 大限流转原理测试");
  console.log("=".repeat(50));
  
  // 大限从命宫开始，阳男阴女顺行，阴男阳女逆行
  // 每个大限10年
  
  const testCases = [
    { gender: "男", yearStem: "庚", expectedDirection: "顺行" }, // 庚为阳干，阳男顺行
    { gender: "女", yearStem: "庚", expectedDirection: "逆行" }, // 庚为阳干，阳女逆行
    { gender: "男", yearStem: "乙", expectedDirection: "逆行" }, // 乙为阴干，阴男逆行
    { gender: "女", yearStem: "乙", expectedDirection: "顺行" }, // 乙为阴干，阴女顺行
  ];
  
  testCases.forEach((testCase, index) => {
    const { gender, yearStem, expectedDirection } = testCase;
    
    // 判断阴阳
    const yangStems = ["甲", "丙", "戊", "庚", "壬"];
    const isYang = yangStems.includes(yearStem);
    
    // 判断大限方向
    let direction;
    if ((isYang && gender === "男") || (!isYang && gender === "女")) {
      direction = "顺行";
    } else {
      direction = "逆行";
    }
    
    console.log(`测试 ${index + 1}: ${yearStem}年${gender}`);
    console.log(`  天干阴阳: ${isYang ? "阳" : "阴"}`);
    console.log(`  大限方向: ${direction} ${direction === expectedDirection ? "✅" : "❌"}`);
  });
  
  console.log(`\n原理: 大限从命宫开始，根据性别和天干阴阳决定顺逆方向`);
  console.log("");
}

// 测试6: 星曜亮度原理
function testStarBrightness() {
  console.log("6. 星曜亮度原理测试");
  console.log("=".repeat(50));
  
  // 星曜亮度基于星曜所在宫位的地支
  // 不同星曜在不同地支有不同的亮度
  
  const brightnessLevels = ["庙", "旺", "得", "利", "平", "不", "陷"];
  
  console.log("亮度等级 (从强到弱):");
  brightnessLevels.forEach((level, index) => {
    console.log(`  ${index + 1}. ${level}`);
  });
  
  console.log(`\n原理: 星曜亮度由星曜和地支的组合决定，影响星曜的吉凶程度`);
  console.log("");
}

// 测试7: 三方四正原理
function testTriadAndOpposite() {
  console.log("7. 三方四正原理测试");
  console.log("=".repeat(50));
  
  // 三方四正: 本宫 + 对宫 + 两个三合宫
  // 三合宫: 从本宫开始，每隔4个宫位
  
  const branches = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
  
  const testCases = [
    { palace: "子", expectedOpposite: "午", expectedTriad: ["辰", "申"] },
    { palace: "丑", expectedOpposite: "未", expectedTriad: ["巳", "酉"] },
    { palace: "寅", expectedOpposite: "申", expectedTriad: ["午", "戌"] },
  ];
  
  testCases.forEach((testCase, index) => {
    const { palace, expectedOpposite, expectedTriad } = testCase;
    const palaceIndex = branches.indexOf(palace);
    
    // 计算对宫
    const oppositeIndex = (palaceIndex + 6) % 12;
    const opposite = branches[oppositeIndex];
    
    // 计算三合宫
    const triad1Index = (palaceIndex + 4) % 12;
    const triad2Index = (palaceIndex + 8) % 12;
    const triad = [branches[triad1Index], branches[triad2Index]];
    
    console.log(`测试 ${index + 1}: ${palace}宫`);
    console.log(`  对宫: ${opposite} ${opposite === expectedOpposite ? "✅" : "❌"}`);
    console.log(`  三合宫: ${triad.join(", ")} ${JSON.stringify(triad.sort()) === JSON.stringify(expectedTriad.sort()) ? "✅" : "❌"}`);
  });
  
  console.log(`\n原理: 三方四正是紫微斗数分析宫位关系的重要概念`);
  console.log("");
}

// 运行所有测试
testSoulBodyPalace();
testFiveElementsClass();
testZiweiPosition();
testFourTransforms();
testMajorPeriods();
testStarBrightness();
testTriadAndOpposite();

console.log("=== 原理验证测试完成 ===");
console.log("\n总结:");
console.log("1. 命宫身宫定位: 基于出生月数和时辰");
console.log("2. 五行局计算: 基于命宫天干地支的纳音五行");
console.log("3. 紫微星定位: 基于五行局和出生日数");
console.log("4. 四化飞星: 基于出生年天干");
console.log("5. 大限流转: 根据性别和天干阴阳决定顺逆");
console.log("6. 星曜亮度: 基于星曜和地支组合");
console.log("7. 三方四正: 宫位间隔关系");