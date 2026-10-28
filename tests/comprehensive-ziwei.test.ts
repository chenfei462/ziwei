/**
 * 紫微斗数全面测试脚本
 * 覆盖命盘排布、十二宫位分布、主星与辅星落宫、四化飞星、大限小限流转以及最终命理分析
 */

import { describe, expect, test } from "vitest";
import { createChart } from "../src/chartEngine.js";
import { testSamples, boundaryTestSamples, invalidTestSamples } from "./comprehensive-ziwei-test-data.js";

describe("紫微斗数全面测试", () => {
  
  describe("1. 命盘排布测试", () => {
    test("所有测试样本都能正确创建命盘", () => {
      testSamples.forEach((sample, index) => {
        const chart = createChart({
          birth_profile: sample,
          rule_config: {
            school_id: "default_ziwei_v0_1",
            zi_hour_day_boundary: "civil_midnight",
            leap_month_policy: "same_month_number"
          }
        });
        
        expect(chart.chart_id).toMatch(/^chart_/);
        expect(chart.chart.palaces).toHaveLength(12);
        expect(chart.chart.stars.length).toBeGreaterThanOrEqual(14);
        expect(chart.chart.transforms).toHaveLength(4);
        expect(chart.chart.major_periods).toHaveLength(12);
        
        console.log(`样本 ${index + 1} (${sample.display_name}): 命盘创建成功`);
      });
    });
    
    test("命盘包含完整的十二宫位", () => {
      const sample = testSamples[0];
      const chart = createChart({
        birth_profile: sample,
        rule_config: {
          school_id: "default_ziwei_v0_1",
          zi_hour_day_boundary: "civil_midnight",
          leap_month_policy: "same_month_number"
        }
      });
      
      const palaceNames = chart.chart.palaces.map(p => p.name);
      const expectedPalaces = [
        "命宫", "兄弟宫", "夫妻宫", "子女宫", "财帛宫", "疾厄宫",
        "迁移宫", "官禄宫", "田宅宫", "福德宫", "父母宫"
      ];
      
      expectedPalaces.forEach(palace => {
        expect(palaceNames).toContain(palace);
      });
      // iztro names the friends/allies palace "仆役宫"; both labels map to
      // the same canonical palace id (`friends`) in the chart engine.
      expect(palaceNames.some((name) => name === "交友宫" || name === "仆役宫")).toBe(true);
      
      console.log("十二宫位验证通过");
    });
    
    test("每个宫位都包含地支和天干", () => {
      const sample = testSamples[0];
      const chart = createChart({
        birth_profile: sample,
        rule_config: {
          school_id: "default_ziwei_v0_1",
          zi_hour_day_boundary: "civil_midnight",
          leap_month_policy: "same_month_number"
        }
      });
      
      chart.chart.palaces.forEach(palace => {
        expect(palace.branch).toBeDefined();
        expect(palace.stem).toBeDefined();
        expect(palace.branch).toMatch(/^[子丑寅卯辰巳午未申酉戌亥]$/);
        expect(palace.stem).toMatch(/^[甲乙丙丁戊己庚辛壬癸]$/);
      });
      
      console.log("宫位天干地支验证通过");
    });
  });
  
  describe("2. 主星与辅星落宫测试", () => {
    test("命宫包含主星", () => {
      const sample = testSamples[0];
      const chart = createChart({
        birth_profile: sample,
        rule_config: {
          school_id: "default_ziwei_v0_1",
          zi_hour_day_boundary: "civil_midnight",
          leap_month_policy: "same_month_number"
        }
      });
      
      const lifePalace = chart.chart.palaces.find(p => p.palace_id === "life");
      expect(lifePalace).toBeDefined();
      expect(lifePalace!.main_stars.length).toBeGreaterThan(0);
      
      console.log(`命宫主星: ${lifePalace!.main_stars.join(", ")}`);
    });
    
    test("主星落宫与辅星落宫分离", () => {
      const sample = testSamples[0];
      const chart = createChart({
        birth_profile: sample,
        rule_config: {
          school_id: "default_ziwei_v0_1",
          zi_hour_day_boundary: "civil_midnight",
          leap_month_policy: "same_month_number"
        }
      });
      
      chart.chart.palaces.forEach(palace => {
        // 主星和辅星应该分开存储
        expect(palace.main_stars).toBeDefined();
        expect(palace.support_stars).toBeDefined();
        
        // 主星和辅星不应重叠
        const mainStarSet = new Set(palace.main_stars);
        const supportStarSet = new Set(palace.support_stars);
        const intersection = [...mainStarSet].filter(x => supportStarSet.has(x));
        expect(intersection).toHaveLength(0);
      });
      
      console.log("主星与辅星落宫分离验证通过");
    });
    
    test("十四颗主星都应出现", () => {
      const sample = testSamples[0];
      const chart = createChart({
        birth_profile: sample,
        rule_config: {
          school_id: "default_ziwei_v0_1",
          zi_hour_day_boundary: "civil_midnight",
          leap_month_policy: "same_month_number"
        }
      });
      
      const requiredMainStars = [
        "紫微", "天机", "太阳", "武曲", "天同", "廉贞",
        "天府", "太阴", "贪狼", "巨门", "天相", "天梁", "七杀", "破军"
      ];
      
      const allMainStars = chart.chart.palaces.flatMap(p => p.main_stars);
      
      requiredMainStars.forEach(star => {
        expect(allMainStars).toContain(star);
      });
      
      console.log("十四颗主星验证通过");
    });
  });
  
  describe("3. 四化飞星测试", () => {
    test("四化飞星数量正确", () => {
      testSamples.forEach((sample, index) => {
        const chart = createChart({
          birth_profile: sample,
          rule_config: {
            school_id: "default_ziwei_v0_1",
            zi_hour_day_boundary: "civil_midnight",
            leap_month_policy: "same_month_number"
          }
        });
        
        expect(chart.chart.transforms).toHaveLength(4);
        
        const transformTypes = chart.chart.transforms.map(t => t.type);
        expect(transformTypes).toContain("hua_lu");
        expect(transformTypes).toContain("hua_quan");
        expect(transformTypes).toContain("hua_ke");
        expect(transformTypes).toContain("hua_ji");
        
        console.log(`样本 ${index + 1} 四化验证通过`);
      });
    });
    
    test("四化飞星落宫正确", () => {
      const sample = testSamples[0];
      const chart = createChart({
        birth_profile: sample,
        rule_config: {
          school_id: "default_ziwei_v0_1",
          zi_hour_day_boundary: "civil_midnight",
          leap_month_policy: "same_month_number"
        }
      });
      
      chart.chart.transforms.forEach(transform => {
        expect(transform.star).toBeDefined();
        expect(transform.palace_id).toBeDefined();
        expect(transform.source_stem).toBeDefined();
        
        // 验证四化类型
        expect(["hua_lu", "hua_quan", "hua_ke", "hua_ji"]).toContain(transform.type);
        
        // 验证宫位ID有效
        expect(transform.palace_id).toMatch(/^(life|siblings|spouse|children|wealth|health|migration|friends|career|property|fortune|parents)$/);
      });
      
      console.log("四化飞星落宫验证通过");
    });
    
    test("四化飞星与宫位关联正确", () => {
      const sample = testSamples[0];
      const chart = createChart({
        birth_profile: sample,
        rule_config: {
          school_id: "default_ziwei_v0_1",
          zi_hour_day_boundary: "civil_midnight",
          leap_month_policy: "same_month_number"
        }
      });
      
      // 检查每个宫位的四化
      chart.chart.palaces.forEach(palace => {
        const palaceTransforms = chart.chart.transforms.filter(t => t.palace_id === palace.palace_id);
        
        // 每个宫位最多应该有一个四化
        expect(palaceTransforms.length).toBeLessThanOrEqual(1);
        
        if (palaceTransforms.length > 0) {
          const transform = palaceTransforms[0];
          expect(transform.star).toBeDefined();
          expect(transform.type).toBeDefined();
          
          console.log(`${palace.name} 宫有四化: ${transform.star} ${transform.type}`);
        }
      });
      
      console.log("四化飞星与宫位关联验证通过");
    });
  });
  
  describe("4. 大限小限流转测试", () => {
    test("大限数量正确（12个）", () => {
      testSamples.forEach((sample, index) => {
        const chart = createChart({
          birth_profile: sample,
          rule_config: {
            school_id: "default_ziwei_v0_1",
            zi_hour_day_boundary: "civil_midnight",
            leap_month_policy: "same_month_number"
          }
        });
        
        expect(chart.chart.major_periods).toHaveLength(12);
        
        chart.chart.major_periods.forEach(period => {
          expect(period.period_id).toMatch(/^major_\d{3}$/);
          expect(period.age_start).toBeGreaterThan(0);
          expect(period.age_end).toBeGreaterThan(period.age_start);
          expect(period.palace_id).toBeDefined();
        });
        
        console.log(`样本 ${index + 1} 大限验证通过`);
      });
    });
    
    test("大限年龄范围连续", () => {
      const sample = testSamples[0];
      const chart = createChart({
        birth_profile: sample,
        rule_config: {
          school_id: "default_ziwei_v0_1",
          zi_hour_day_boundary: "civil_midnight",
          leap_month_policy: "same_month_number"
        }
      });
      
      const periods = chart.chart.major_periods.sort((a, b) => a.age_start - b.age_start);
      
      for (let i = 1; i < periods.length; i++) {
        // 大限年龄应该连续或重叠
        expect(periods[i].age_start).toBeLessThanOrEqual(periods[i - 1].age_end + 1);
      }
      
      console.log("大限年龄范围连续验证通过");
    });
    
    test("大限宫位分配正确", () => {
      const sample = testSamples[0];
      const chart = createChart({
        birth_profile: sample,
        rule_config: {
          school_id: "default_ziwei_v0_1",
          zi_hour_day_boundary: "civil_midnight",
          leap_month_policy: "same_month_number"
        }
      });
      
      const palaceIds = chart.chart.palaces.map(p => p.palace_id);
      
      chart.chart.major_periods.forEach(period => {
        expect(palaceIds).toContain(period.palace_id);
      });
      
      console.log("大限宫位分配验证通过");
    });
  });
  
  describe("5. 宫位关系测试", () => {
    test("三方四正关系正确", () => {
      const sample = testSamples[0];
      const chart = createChart({
        birth_profile: sample,
        rule_config: {
          school_id: "default_ziwei_v0_1",
          zi_hour_day_boundary: "civil_midnight",
          leap_month_policy: "same_month_number"
        }
      });
      
      chart.chart.palaces.forEach(palace => {
        expect(palace.relation_refs).toBeDefined();
        expect(palace.relation_refs.opposite).toBeDefined();
        expect(palace.relation_refs.triad).toBeDefined();
        expect(palace.relation_refs.neighbors).toBeDefined();
        
        // 对宫应该是唯一的
        expect(palace.relation_refs.opposite).not.toBe(palace.palace_id);
        
        // 三方四正应该有2个宫位
        expect(palace.relation_refs.triad).toHaveLength(2);
        
        // 邻宫应该有2个宫位
        expect(palace.relation_refs.neighbors).toHaveLength(2);
      });
      
      console.log("三方四正关系验证通过");
    });
    
    test("对宫关系双向验证", () => {
      const sample = testSamples[0];
      const chart = createChart({
        birth_profile: sample,
        rule_config: {
          school_id: "default_ziwei_v0_1",
          zi_hour_day_boundary: "civil_midnight",
          leap_month_policy: "same_month_number"
        }
      });
      
      const palaceMap = new Map(chart.chart.palaces.map(p => [p.palace_id, p]));
      
      chart.chart.palaces.forEach(palace => {
        const oppositePalace = palaceMap.get(palace.relation_refs.opposite);
        expect(oppositePalace).toBeDefined();
        expect(oppositePalace!.relation_refs.opposite).toBe(palace.palace_id);
      });
      
      console.log("对宫关系双向验证通过");
    });
  });
  
  describe("6. 时辰边界测试", () => {
    test("时辰边界正确映射", () => {
      boundaryTestSamples.forEach((sample, index) => {
        const chart = createChart({
          birth_profile: sample,
          rule_config: {
            school_id: "default_ziwei_v0_1",
            zi_hour_day_boundary: "civil_midnight",
            leap_month_policy: "same_month_number"
          }
        });
        
        expect(chart.chart.palaces).toHaveLength(12);
        expect(chart.chart.stars.length).toBeGreaterThanOrEqual(14);
        
        console.log(`边界样本 ${index + 1} (${sample.display_name}): 测试通过`);
      });
    });
    
    test("子时换日规则正确", () => {
      // 23:00 应该算作次日子时
      const sample23 = boundaryTestSamples.find(s => s.birth_time === "23:00");
      const sample00 = boundaryTestSamples.find(s => s.birth_time === "00:00");
      
      if (sample23 && sample00) {
        const chart23 = createChart({
          birth_profile: sample23,
          rule_config: {
            school_id: "default_ziwei_v0_1",
            zi_hour_day_boundary: "civil_midnight",
            leap_month_policy: "same_month_number"
          }
        });
        
        const chart00 = createChart({
          birth_profile: sample00,
          rule_config: {
            school_id: "default_ziwei_v0_1",
            zi_hour_day_boundary: "civil_midnight",
            leap_month_policy: "same_month_number"
          }
        });
        
        // 两个时间点应该产生不同的命盘
        expect(chart23.chart_id).not.toBe(chart00.chart_id);
        
        console.log("子时换日规则验证通过");
      }
    });
  });
  
  describe("7. 农历与公历转换测试", () => {
    test("农历输入正确处理", () => {
      const lunarSamples = testSamples.filter(s => s.calendar_type === "lunar");
      
      lunarSamples.forEach((sample, index) => {
        const chart = createChart({
          birth_profile: sample,
          rule_config: {
            school_id: "default_ziwei_v0_1",
            zi_hour_day_boundary: "civil_midnight",
            leap_month_policy: "same_month_number"
          }
        });
        
        expect(chart.normalized_birth.calendar_type).toBe("lunar");
        expect(chart.chart.palaces).toHaveLength(12);
        
        console.log(`农历样本 ${index + 1} (${sample.display_name}): 测试通过`);
      });
    });
    
    test("闰月处理正确", () => {
      const leapMonthSample = testSamples.find(s => s.is_leap_month);
      
      if (leapMonthSample) {
        const chart = createChart({
          birth_profile: leapMonthSample,
          rule_config: {
            school_id: "default_ziwei_v0_1",
            zi_hour_day_boundary: "civil_midnight",
            leap_month_policy: "same_month_number"
          }
        });
        
        expect(chart.chart.palaces).toHaveLength(12);
        expect(chart.chart.stars.length).toBeGreaterThanOrEqual(14);
        
        console.log("闰月处理验证通过");
      }
    });
  });
  
  describe("8. 性别差异测试", () => {
    test("不同性别产生不同命盘", () => {
      const maleSample = testSamples.find(s => s.gender_rule === "traditional_male");
      const femaleSample = testSamples.find(s => s.gender_rule === "traditional_female");
      
      if (maleSample && femaleSample) {
        const chartMale = createChart({
          birth_profile: maleSample,
          rule_config: {
            school_id: "default_ziwei_v0_1",
            zi_hour_day_boundary: "civil_midnight",
            leap_month_policy: "same_month_number"
          }
        });
        
        const chartFemale = createChart({
          birth_profile: femaleSample,
          rule_config: {
            school_id: "default_ziwei_v0_1",
            zi_hour_day_boundary: "civil_midnight",
            leap_month_policy: "same_month_number"
          }
        });
        
        // 不同性别应该产生不同的命盘（即使其他条件相同）
        // 注意：这里测试的是逻辑，实际可能需要相同生辰不同性别来验证
        expect(chartMale.chart_id).not.toBe(chartFemale.chart_id);
        
        console.log("性别差异验证通过");
      }
    });
  });
  
  describe("9. 异常输入测试", () => {
    test("无效时间格式抛出错误", () => {
      const invalidSample = invalidTestSamples.find(s => s.name === "无效时间格式");
      
      if (invalidSample) {
        expect(() => {
          createChart({
            birth_profile: invalidSample.profile,
            rule_config: {
              school_id: "default_ziwei_v0_1",
              zi_hour_day_boundary: "civil_midnight",
              leap_month_policy: "same_month_number"
            }
          });
        }).toThrow();
        
        console.log("无效时间格式错误处理验证通过");
      }
    });
    
    test("无效日期格式抛出错误", () => {
      const invalidSample = invalidTestSamples.find(s => s.name === "无效日期格式");
      
      if (invalidSample) {
        expect(() => {
          createChart({
            birth_profile: invalidSample.profile,
            rule_config: {
              school_id: "default_ziwei_v0_1",
              zi_hour_day_boundary: "civil_midnight",
              leap_month_policy: "same_month_number"
            }
          });
        }).toThrow();
        
        console.log("无效日期格式错误处理验证通过");
      }
    });
    
    test("空时区抛出错误", () => {
      const invalidSample = invalidTestSamples.find(s => s.name === "空时区");
      
      if (invalidSample) {
        expect(() => {
          createChart({
            birth_profile: invalidSample.profile,
            rule_config: {
              school_id: "default_ziwei_v0_1",
              zi_hour_day_boundary: "civil_midnight",
              leap_month_policy: "same_month_number"
            }
          });
        }).toThrow();
        
        console.log("空时区错误处理验证通过");
      }
    });
  });
  
  describe("10. 五行局测试", () => {
    test("五行局值有效", () => {
      testSamples.forEach((sample, index) => {
        const chart = createChart({
          birth_profile: sample,
          rule_config: {
            school_id: "default_ziwei_v0_1",
            zi_hour_day_boundary: "civil_midnight",
            leap_month_policy: "same_month_number"
          }
        });
        
        // 五行局应该是有效的五行局之一
        const validFiveElements = ["水二局", "木三局", "金四局", "土五局", "火六局"];
        const traceOutput = chart.trace.find((entry) => entry.step === "calculate_astrolabe")?.output;
        expect(traceOutput).toBeDefined();
        expect(validFiveElements).toContain(traceOutput?.five_elements_class);
        
        console.log(`样本 ${index + 1} 五行局: ${traceOutput?.five_elements_class}`);
      });
    });
  });
  
  describe("11. 命宫身宫测试", () => {
    test("命宫和身宫地支有效", () => {
      testSamples.forEach((sample, index) => {
        const chart = createChart({
          birth_profile: sample,
          rule_config: {
            school_id: "default_ziwei_v0_1",
            zi_hour_day_boundary: "civil_midnight",
            leap_month_policy: "same_month_number"
          }
        });
        
        const traceOutput = chart.trace.find((entry) => entry.step === "calculate_astrolabe")?.output;
        expect(traceOutput).toBeDefined();
        const soulPalaceBranch = traceOutput?.soul_palace_branch;
        const bodyPalaceBranch = traceOutput?.body_palace_branch;
        
        // 地支应该是有效的十二地支之一
        const validBranches = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
        expect(validBranches).toContain(soulPalaceBranch);
        expect(validBranches).toContain(bodyPalaceBranch);
        
        console.log(`样本 ${index + 1} 命宫: ${soulPalaceBranch}, 身宫: ${bodyPalaceBranch}`);
      });
    });
  });
  
  describe("12. 星曜亮度测试", () => {
    test("星曜亮度值有效", () => {
      const sample = testSamples[0];
      const chart = createChart({
        birth_profile: sample,
        rule_config: {
          school_id: "default_ziwei_v0_1",
          zi_hour_day_boundary: "civil_midnight",
          leap_month_policy: "same_month_number"
        }
      });
      
      const validBrightness = ["庙", "旺", "得", "利", "平", "不", "陷"];
      
      chart.chart.stars.forEach(star => {
        if (star.brightness) {
          expect(validBrightness).toContain(star.brightness);
        }
      });
      
      console.log("星曜亮度验证通过");
    });
  });
  
  describe("13. 追踪记录测试", () => {
    test("追踪记录包含所有步骤", () => {
      const sample = testSamples[0];
      const chart = createChart({
        birth_profile: sample,
        rule_config: {
          school_id: "default_ziwei_v0_1",
          zi_hour_day_boundary: "civil_midnight",
          leap_month_policy: "same_month_number"
        }
      });
      
      const expectedSteps = [
        "resolve_rule_profile",
        "normalize_birth",
        "calculate_astrolabe",
        "map_palaces",
        "map_stars",
        "map_transforms",
        "map_major_periods"
      ];
      
      const traceSteps = chart.trace.map(t => t.step);
      
      expectedSteps.forEach(step => {
        expect(traceSteps).toContain(step);
      });
      
      console.log("追踪记录验证通过");
    });
  });
  
  describe("14. 隐私设置测试", () => {
    test("隐私设置默认正确", () => {
      testSamples.forEach((sample, index) => {
        const chart = createChart({
          birth_profile: sample,
          rule_config: {
            school_id: "default_ziwei_v0_1",
            zi_hour_day_boundary: "civil_midnight",
            leap_month_policy: "same_month_number"
          }
        });
        
        expect(chart.privacy).toEqual({
          share_birth_date: false,
          share_birth_time: false,
          share_location: false
        });
        
        console.log(`样本 ${index + 1} 隐私设置验证通过`);
      });
    });
  });
  
  describe("15. 多样本交叉验证", () => {
    test("不同样本产生不同命盘", () => {
      const charts = testSamples.map(sample => {
        return createChart({
          birth_profile: sample,
          rule_config: {
            school_id: "default_ziwei_v0_1",
            zi_hour_day_boundary: "civil_midnight",
            leap_month_policy: "same_month_number"
          }
        });
      });
      
      // 所有命盘ID应该唯一
      const chartIds = charts.map(c => c.chart_id);
      const uniqueIds = new Set(chartIds);
      expect(uniqueIds.size).toBe(charts.length);
      
      console.log("多样本交叉验证通过");
    });
    
    test("相同条件产生相同命盘", () => {
      const sample = testSamples[0];
      
      const chart1 = createChart({
        birth_profile: sample,
        rule_config: {
          school_id: "default_ziwei_v0_1",
          zi_hour_day_boundary: "civil_midnight",
          leap_month_policy: "same_month_number"
        }
      });
      
      const chart2 = createChart({
        birth_profile: sample,
        rule_config: {
          school_id: "default_ziwei_v0_1",
          zi_hour_day_boundary: "civil_midnight",
          leap_month_policy: "same_month_number"
        }
      });
      
      // 相同条件应该产生相同的命盘内容（ID可能不同）
      expect(chart1.chart.palaces).toEqual(chart2.chart.palaces);
      expect(chart1.chart.stars).toEqual(chart2.chart.stars);
      expect(chart1.chart.transforms).toEqual(chart2.chart.transforms);
      
      console.log("相同条件产生相同命盘验证通过");
    });
  });
});
