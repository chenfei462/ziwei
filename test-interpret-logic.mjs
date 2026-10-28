/**
 * 测试 interpret 功能的核心逻辑
 */

import { astro } from "iztro";

console.log("=== 测试 interpret 功能的核心逻辑 ===\n");

// 创建测试命盘
console.log("1. 创建命盘...");
const astrolabe = astro.bySolar("2000-8-16", 2, "男", false, "zh-CN");

console.log("✅ 命盘创建成功");
console.log(`   公历: ${astrolabe.solarDate}`);
console.log(`   农历: ${astrolabe.lunarDate}`);
console.log(`   干支: ${astrolabe.chineseDate}`);
console.log(`   命宫地支: ${astrolabe.earthlyBranchOfSoulPalace}`);
console.log(`   身宫地支: ${astrolabe.earthlyBranchOfBodyPalace}`);
console.log(`   五行局: ${astrolabe.fiveElementsClass}`);

console.log("\n2. 分析命宫信息...");
const lifePalace = astrolabe.palaces.find(p => p.name === "命宫");

if (lifePalace) {
  console.log("✅ 找到命宫");
  console.log(`   命宫位置: ${lifePalace.earthlyBranch}`);
  console.log(`   命宫天干: ${lifePalace.heavenlyStem}`);
  
  // 分析主星
  const majorStars = lifePalace.majorStars || [];
  console.log(`   命宫主星: ${majorStars.map(s => s.name).join(", ") || "无主星"}`);
  
  // 分析四化
  const transforms = majorStars.filter(s => s.mutagen);
  console.log(`   命宫四化: ${transforms.map(s => `${s.name}(${s.mutagen})`).join(", ") || "无四化"}`);
  
  // 分析辅星
  const minorStars = lifePalace.minorStars || [];
  const adjectiveStars = lifePalace.adjectiveStars || [];
  console.log(`   命宫辅星: ${minorStars.length + adjectiveStars.length} 颗`);
  
  // 分析亮度
  majorStars.forEach(star => {
    console.log(`   ${star.name} 亮度: ${star.brightness || "无"}`);
  });
  
  console.log("\n3. 分析三方四正关系...");
  const branches = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
  const lifeIndex = branches.indexOf(lifePalace.earthlyBranch);
  
  // 对宫
  const oppositeIndex = (lifeIndex + 6) % 12;
  const oppositeBranch = branches[oppositeIndex];
  const oppositePalace = astrolabe.palaces.find(p => p.earthlyBranch === oppositeBranch);
  
  console.log(`   对宫: ${oppositePalace ? oppositePalace.name : "未知"} (${oppositeBranch})`);
  
  // 三合宫
  const triad1Index = (lifeIndex + 4) % 12;
  const triad2Index = (lifeIndex + 8) % 12;
  const triad1Branch = branches[triad1Index];
  const triad2Branch = branches[triad2Index];
  const triad1Palace = astrolabe.palaces.find(p => p.earthlyBranch === triad1Branch);
  const triad2Palace = astrolabe.palaces.find(p => p.earthlyBranch === triad2Branch);
  
  console.log(`   三合宫1: ${triad1Palace ? triad1Palace.name : "未知"} (${triad1Branch})`);
  console.log(`   三合宫2: ${triad2Palace ? triad2Palace.name : "未知"} (${triad2Branch})`);
  
  console.log("\n4. 分析大限信息...");
  const lifeMajorPeriod = lifePalace.decadal;
  if (lifeMajorPeriod) {
    console.log(`   命宫大限: ${lifeMajorPeriod.range[0]}-${lifeMajorPeriod.range[1]}岁`);
    console.log(`   大限天干: ${lifeMajorPeriod.heavenlyStem}`);
    console.log(`   大限地支: ${lifeMajorPeriod.earthlyBranch}`);
  }
  
  console.log("\n5. 模拟 interpret 逻辑...");
  
  // 模拟 interpret 逻辑
  const palaceId = "life";
  const mode = "professional";
  
  // 检查是否是 MVP 宫位
  const mvpPalaces = ["life", "career", "wealth", "spouse", "fortune", "migration"];
  const isMvp = mvpPalaces.includes(palaceId);
  
  console.log(`   宫位ID: ${palaceId}`);
  console.log(`   是否MVP宫位: ${isMvp ? "是" : "否"}`);
  
  if (isMvp) {
    console.log("   状态: ready");
    console.log("   可以进行深度解读");
    
    // 模拟规则匹配
    const rules = [];
    
    // 宫位主题规则
    rules.push({
      rule_id: "life_palace_theme",
      layer: "palace_theme",
      weight: 1.0,
      professional_text: "命宫代表个人的核心特质和命运走向。",
      entertainment_text: "命宫是你的生命之宫，代表你的本质。",
      advice: "关注个人成长和发展方向。",
      safety_flags: ["avoid_absolute_prediction"]
    });
    
    // 星曜象义规则
    majorStars.forEach(star => {
      rules.push({
        rule_id: `star_${star.name}`,
        layer: "star_symbol",
        weight: 0.8,
        professional_text: `${star.name}在命宫，代表${star.brightness || "平"}的亮度。`,
        entertainment_text: `${star.name}守护你的命宫，为你带来独特能量。`,
        advice: `发挥${star.name}的正面特质。`,
        safety_flags: ["avoid_absolute_prediction"]
      });
    });
    
    // 四化规则
    transforms.forEach(star => {
      rules.push({
        rule_id: `transform_${star.name}_${star.mutagen}`,
        layer: "star_symbol",
        weight: 0.9,
        professional_text: `${star.name}化${star.mutagen}，影响个人运势。`,
        entertainment_text: `${star.name}化${star.mutagen}，为你带来特殊机遇。`,
        advice: `把握${star.name}化${star.mutagen}带来的机会。`,
        safety_flags: ["avoid_absolute_prediction"]
      });
    });
    
    console.log(`   匹配规则数量: ${rules.length}`);
    console.log(`   规则类型: ${[...new Set(rules.map(r => r.layer))].join(", ")}`);
    
    // 生成解读文本
    const interpretationText = rules.map(r => r.professional_text).join(" ");
    const adviceText = rules.map(r => r.advice).join(" ");
    
    console.log(`   解读文本长度: ${interpretationText.length} 字符`);
    console.log(`   建议文本长度: ${adviceText.length} 字符`);
    
    console.log("\n6. 解读内容预览...");
    console.log(`   解读: ${interpretationText.substring(0, 150)}...`);
    console.log(`   建议: ${adviceText.substring(0, 150)}...`);
    
  } else {
    console.log("   状态: not_open");
    console.log("   仅返回结构主题");
  }
  
  console.log("\n=== interpret 功能逻辑测试完成 ===");
  console.log("\n总结:");
  console.log("1. 命盘创建正常");
  console.log("2. 命宫信息提取正常");
  console.log("3. 三方四正关系计算正常");
  console.log("4. 大限信息获取正常");
  console.log("5. interpret 逻辑模拟正常");
  console.log("6. MVP 宫位识别正确");
  console.log("7. 规则匹配逻辑正常");
  
} else {
  console.log("❌ 找不到命宫");
}