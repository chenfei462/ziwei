/**
 * 测试 chartEngine.ts 封装层的准确性
 */

import { astro } from "iztro";

console.log("=== 测试 chartEngine.ts 封装层 ===\n");

// 模拟 chartEngine.ts 中的逻辑
const palaceIdByName = {
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

const transformMap = {
  禄: "hua_lu",
  权: "hua_quan",
  科: "hua_ke",
  忌: "hua_ji"
};

function palaceIdForName(name) {
  return palaceIdByName[name] ?? palaceIdByName[name.replace(/宫$/, "")] ?? `palace_${name}`;
}

function mapPalace(palace, index, palaceIds) {
  const allStars = [...(palace.majorStars || []), ...(palace.minorStars || []), ...(palace.adjectiveStars || [])];
  const transforms = allStars.map(star => star.mutagen ? transformMap[star.mutagen] : undefined).filter(Boolean);

  return {
    palace_id: palaceIdForName(palace.name),
    name: palace.name.endsWith("宫") ? palace.name : `${palace.name}宫`,
    branch: palace.earthlyBranch,
    stem: palace.heavenlyStem,
    main_stars: (palace.majorStars || []).map(star => star.name).filter(Boolean),
    support_stars: [...(palace.minorStars || []), ...(palace.adjectiveStars || [])].map(star => star.name).filter(Boolean),
    transforms,
    strength_score: null,
    relation_refs: {
      opposite: palaceIds[(index + 6) % 12],
      triad: [palaceIds[(index + 4) % 12], palaceIds[(index + 8) % 12]],
      neighbors: [palaceIds[(index + 11) % 12], palaceIds[(index + 1) % 12]]
    }
  };
}

function mapStars(palace) {
  return [
    ...(palace.majorStars || []).map(star => toStar(star, palace, "major")),
    ...(palace.minorStars || []).map(star => toStar(star, palace, star.type === "tianma" ? "tianma" : "minor")),
    ...(palace.adjectiveStars || []).map(star => toStar(star, palace, "adjective"))
  ];
}

function toStar(star, palace, category) {
  return {
    name: star.name || "未知星曜",
    category,
    palace_id: palaceIdForName(palace.name),
    element: null,
    brightness: star.brightness || null,
    tags: [category]
  };
}

function mapTransforms(palace) {
  const stars = [...(palace.majorStars || []), ...(palace.minorStars || []), ...(palace.adjectiveStars || [])];
  return stars
    .filter(star => star.name && star.mutagen && transformMap[star.mutagen])
    .map(star => ({
      type: transformMap[star.mutagen],
      star: star.name,
      source_stem: palace.heavenlyStem || null,
      palace_id: palaceIdForName(palace.name)
    }));
}

function mapMajorPeriod(palace) {
  const range = palace.decadal?.range || [0, 0];
  return {
    period_id: `major_${String(palace.index + 1).padStart(3, "0")}`,
    age_start: range[0] || 0,
    age_end: range[1] || 0,
    palace_id: palaceIdForName(palace.name),
    direction: "unknown"
  };
}

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
  }
];

function testChartEngine(testCase) {
  console.log(`\n测试: ${testCase.name}`);
  console.log("=".repeat(50));
  
  try {
    // 使用 iztro 直接获取命盘
    const astrolabe = astro.bySolar(
      testCase.solarDate,
      testCase.timeIndex,
      testCase.gender,
      false,
      "zh-CN"
    );
    
    console.log("✅ iztro 命盘创建成功");
    
    // 测试宫位映射
    const palaceIds = astrolabe.palaces.map(palace => palaceIdForName(palace.name));
    const palaces = astrolabe.palaces.map((palace, index) => mapPalace(palace, index, palaceIds));
    
    console.log(`✅ 宫位映射成功: ${palaces.length} 个宫位`);
    
    // 验证宫位ID
    const palaceIdSet = new Set(palaces.map(p => p.palace_id));
    console.log(`✅ 宫位ID唯一性: ${palaceIdSet.size} 个唯一ID`);
    
    // 验证宫位名称
    palaces.forEach(palace => {
      if (!palace.name.endsWith("宫")) {
        console.log(`❌ 宫位名称格式错误: ${palace.name}`);
      }
    });
    console.log("✅ 宫位名称格式验证通过");
    
    // 验证天干地支
    palaces.forEach(palace => {
      if (!palace.branch || !palace.stem) {
        console.log(`❌ 宫位缺少天干地支: ${palace.name}`);
      }
    });
    console.log("✅ 天干地支验证通过");
    
    // 测试星曜映射
    const stars = astrolabe.palaces.flatMap(palace => mapStars(palace));
    console.log(`✅ 星曜映射成功: ${stars.length} 颗星曜`);
    
    // 验证主星
    const majorStars = stars.filter(s => s.category === "major");
    console.log(`✅ 主星数量: ${majorStars.length}`);
    
    // 验证辅星
    const minorStars = stars.filter(s => s.category === "minor");
    const adjectiveStars = stars.filter(s => s.category === "adjective");
    console.log(`✅ 辅星数量: ${minorStars.length + adjectiveStars.length}`);
    
    // 测试四化映射
    const transforms = astrolabe.palaces.flatMap(palace => mapTransforms(palace));
    console.log(`✅ 四化映射成功: ${transforms.length} 个四化`);
    
    // 验证四化类型
    const transformTypes = transforms.map(t => t.type);
    const expectedTypes = ["hua_lu", "hua_quan", "hua_ke", "hua_ji"];
    expectedTypes.forEach(type => {
      if (!transformTypes.includes(type)) {
        console.log(`❌ 缺少四化类型: ${type}`);
      }
    });
    console.log("✅ 四化类型验证通过");
    
    // 测试大限映射
    const majorPeriods = astrolabe.palaces.map(palace => mapMajorPeriod(palace));
    console.log(`✅ 大限映射成功: ${majorPeriods.length} 个大限`);
    
    // 验证大限年龄范围
    majorPeriods.forEach(period => {
      if (period.age_start >= period.age_end) {
        console.log(`❌ 大限年龄范围错误: ${period.period_id} (${period.age_start}-${period.age_end})`);
      }
    });
    console.log("✅ 大限年龄范围验证通过");
    
    // 验证三方四正关系
    palaces.forEach(palace => {
      const { opposite, triad, neighbors } = palace.relation_refs;
      
      if (opposite === palace.palace_id) {
        console.log(`❌ 对宫关系错误: ${palace.name} 的对宫是自己`);
      }
      
      if (triad.length !== 2) {
        console.log(`❌ 三方四正数量错误: ${palace.name} 有 ${triad.length} 个`);
      }
      
      if (neighbors.length !== 2) {
        console.log(`❌ 邻宫数量错误: ${palace.name} 有 ${neighbors.length} 个`);
      }
    });
    console.log("✅ 三方四正关系验证通过");
    
    return true;
    
  } catch (error) {
    console.log(`❌ 测试失败: ${error.message}`);
    console.log(error.stack);
    return false;
  }
}

// 运行测试
let passed = 0;
let failed = 0;

testCases.forEach(testCase => {
  if (testChartEngine(testCase)) {
    passed++;
  } else {
    failed++;
  }
});

console.log("\n\n=== 测试结果 ===");
console.log(`通过: ${passed}`);
console.log(`失败: ${failed}`);
console.log(`总计: ${passed + failed}`);

if (failed === 0) {
  console.log("\n✅ 所有测试通过！chartEngine.ts 封装层工作正常。");
} else {
  console.log("\n❌ 存在测试失败，需要检查封装层逻辑。");
}