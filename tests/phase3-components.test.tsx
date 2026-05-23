// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { createChart } from "../src/index.js";
import { PalaceCard } from "../src/components/phase2/PalaceCard.js";
import { buildChartViewModel } from "../src/phase2/chartViewModel.js";
import type { InterpretResponse } from "../src/types.js";

const chart = createChart({
  birth_profile: {
    display_name: "组件阶段3用户",
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
  }
});
const viewModel = buildChartViewModel(chart.chart);

const interpretation: InterpretResponse = {
  chart_id: chart.chart_id,
  palace_id: "life",
  mode: "professional",
  status: "ready",
  interpretation: {
    basis: "依据：命宫主题、紫微主星与本对合邻关系共同触发。",
    interpretation: "结构重心偏向统筹与自我定位，适合以阶段性目标整理行动。",
    scenario: "现实场景可落在角色定位、工作节奏和长期规划。",
    advice: "先做可验证的小决策，避免把单一星曜当成绝对结论。",
    confidence: "strong_structure",
    safety_flags: ["avoid_absolute_prediction"]
  },
  trace: [
    {
      rule_id: "phase3_palace_life_theme",
      palace_id: "life",
      layer: "palace_theme",
      weight: 35,
      confidence: "strong_structure",
      matched_conditions: [{ type: "palace", value: "life" }],
      source: {
        title: "斗数发微论",
        excerpt: "观其宫垣星曜",
        modern_translation: "先看宫位结构，再看星曜组合。"
      },
      safety_flags: ["avoid_absolute_prediction"]
    }
  ]
};

describe("phase 3 interpretation UI", () => {
  test("renders formal interpretation copy, mode controls, and expandable rule trace", () => {
    const onModeChange = vi.fn();
    render(
      <PalaceCard
        activeLayer="main"
        interpretation={interpretation}
        interpretationMode="professional"
        isInterpretationLoading={false}
        onInterpretationModeChange={onModeChange}
        palace={viewModel.palaceById.life}
      />
    );

    expect(screen.getByText(/依据：命宫主题/)).toBeInTheDocument();
    expect(screen.getByText(/结构重心偏向/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "专业" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "娱乐" }));
    expect(onModeChange).toHaveBeenCalledWith("entertainment");

    fireEvent.click(screen.getByRole("button", { name: /查看规则溯源/ }));
    expect(screen.getByText("phase3_palace_life_theme")).toBeInTheDocument();
    expect(screen.getByText("斗数发微论")).toBeInTheDocument();
    expect(screen.getByText(/先看宫位结构/)).toBeInTheDocument();
  });
});
