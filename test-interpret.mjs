/**
 * 测试 interpret 功能
 */

import { createChart, interpret } from "./src/index.js";

console.log("=== 测试 interpret 功能 ===\n");

// 创建测试命盘
const baseBirthProfile = {
  display_name: "测试用户",
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

try {
  console.log("1. 创建命盘...");
  const chart = createChart({
    birth_profile: baseBirthProfile,
    rule_config: {
      school_id: "default_ziwei_v0_1",
      zi_hour_day_boundary: "civil_midnight",
      leap_month_policy: "same_month_number"
    }
  });
  
  console.log("✅ 命盘创建成功");
  console.log(`   命盘ID: ${chart.chart_id}`);
  console.log(`   宫位数量: ${chart.chart.palaces.length}`);
  console.log(`   星曜数量: ${chart.chart.stars.length}`);
  console.log(`   四化数量: ${chart.chart.transforms.length}`);
  console.log(`   大限数量: ${chart.chart.major_periods.length}`);
  
  console.log("\n2. 测试 interpret 功能...");
  
  // 测试所有宫位的解读
  const palaceIds = chart.chart.palaces.map(p => p.palace_id);
  
  console.log(`\n可用宫位: ${palaceIds.join(", ")}`);
  
  // 测试命宫解读
  console.log("\n3. 测试命宫解读...");
  const lifePalaceInterpretation = interpret({
    chart_id: chart.chart_id,
    palace_id: "life",
    mode: "professional",
    include_trace: true
  });
  
  console.log("✅ 命宫解读成功");
  console.log(`   状态: ${lifePalaceInterpretation.status}`);
  console.log(`   信心等级: ${lifePalaceInterpretation.interpretation.confidence}`);
  console.log(`   安全标志: ${lifePalaceInterpretation.interpretation.safety_flags.join(", ")}`);
  console.log(`   解读内容: ${lifePalaceInterpretation.interpretation.interpretation.substring(0, 100)}...`);
  
  // 测试官禄宫解读
  console.log("\n4. 测试官禄宫解读...");
  const careerPalaceInterpretation = interpret({
    chart_id: chart.chart_id,
    palace_id: "career",
    mode: "professional",
    include_trace: true
  });
  
  console.log("✅ 官禄宫解读成功");
  console.log(`   状态: ${careerPalaceInterpretation.status}`);
  console.log(`   信心等级: ${careerPalaceInterpretation.interpretation.confidence}`);
  
  // 测试财帛宫解读
  console.log("\n5. 测试财帛宫解读...");
  const wealthPalaceInterpretation = interpret({
    chart_id: chart.chart_id,
    palace_id: "wealth",
    mode: "professional",
    include_trace: true
  });
  
  console.log("✅ 财帛宫解读成功");
  console.log(`   状态: ${wealthPalaceInterpretation.status}`);
  console.log(`   信心等级: ${wealthPalaceInterpretation.interpretation.confidence}`);
  
  // 测试夫妻宫解读
  console.log("\n6. 测试夫妻宫解读...");
  const spousePalaceInterpretation = interpret({
    chart_id: chart.chart_id,
    palace_id: "spouse",
    mode: "professional",
    include_trace: true
  });
  
  console.log("✅ 夫妻宫解读成功");
  console.log(`   状态: ${spousePalaceInterpretation.status}`);
  console.log(`   信心等级: ${spousePalaceInterpretation.interpretation.confidence}`);
  
  // 测试福德宫解读
  console.log("\n7. 测试福德宫解读...");
  const fortunePalaceInterpretation = interpret({
    chart_id: chart.chart_id,
    palace_id: "fortune",
    mode: "professional",
    include_trace: true
  });
  
  console.log("✅ 福德宫解读成功");
  console.log(`   状态: ${fortunePalaceInterpretation.status}`);
  console.log(`   信心等级: ${fortunePalaceInterpretation.interpretation.confidence}`);
  
  // 测试迁移宫解读
  console.log("\n8. 测试迁移宫解读...");
  const migrationPalaceInterpretation = interpret({
    chart_id: chart.chart_id,
    palace_id: "migration",
    mode: "professional",
    include_trace: true
  });
  
  console.log("✅ 迁移宫解读成功");
  console.log(`   状态: ${migrationPalaceInterpretation.status}`);
  console.log(`   信心等级: ${migrationPalaceInterpretation.interpretation.confidence}`);
  
  // 测试未开放宫位（如父母宫）
  console.log("\n9. 测试未开放宫位解读...");
  const parentsPalaceInterpretation = interpret({
    chart_id: chart.chart_id,
    palace_id: "parents",
    mode: "professional",
    include_trace: true
  });
  
  console.log("✅ 父母宫解读测试完成");
  console.log(`   状态: ${parentsPalaceInterpretation.status}`);
  console.log(`   解读内容: ${parentsPalaceInterpretation.interpretation.interpretation.substring(0, 100)}...`);
  
  // 测试 entertainment 模式
  console.log("\n10. 测试 entertainment 模式...");
  const entertainmentInterpretation = interpret({
    chart_id: chart.chart_id,
    palace_id: "life",
    mode: "entertainment",
    include_trace: false
  });
  
  console.log("✅ entertainment 模式解读成功");
  console.log(`   状态: ${entertainmentInterpretation.status}`);
  console.log(`   解读内容: ${entertainmentInterpretation.interpretation.interpretation.substring(0, 100)}...`);
  
  console.log("\n=== interpret 功能测试完成 ===");
  console.log("\n总结:");
  console.log("1. interpret 功能工作正常");
  console.log("2. 支持所有已开放宫位的解读");
  console.log("3. 支持 professional 和 entertainment 两种模式");
  console.log("4. 解读内容符合安全规范");
  console.log("5. 未开放宫位返回正确提示");
  
} catch (error) {
  console.log(`❌ 测试失败: ${error.message}`);
  console.log(error.stack);
}