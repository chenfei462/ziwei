import { describe, expect, test } from "vitest";
import { createChart } from "../src/index.js";
import { buildChartViewModel, getPalaceRelationKind } from "../src/phase2/chartViewModel.js";

const chart = createChart({
  birth_profile: {
    display_name: "交互原型测试",
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

describe("phase 2 chart view model", () => {
  test("maps the phase 1 Chart into twelve stable 2D palace tiles", () => {
    const viewModel = buildChartViewModel(chart.chart);

    expect(viewModel.palaces).toHaveLength(12);
    expect(viewModel.palaces[0]).toMatchObject({
      palace_id: expect.any(String),
      label: expect.any(String),
      position: {
        x: expect.any(Number),
        y: expect.any(Number)
      }
    });
    expect(new Set(viewModel.palaces.map((palace) => `${palace.position.x}:${palace.position.y}`)).size).toBe(12);
  });

  test("classifies selected, opposite, triad, and neighbor palace relations", () => {
    const viewModel = buildChartViewModel(chart.chart);
    const selected = viewModel.palaces[0];

    expect(getPalaceRelationKind(selected, selected.palace_id)).toBe("selected");
    expect(getPalaceRelationKind(viewModel.palaceById[selected.relation_refs.opposite], selected.palace_id)).toBe("opposite");
    expect(getPalaceRelationKind(viewModel.palaceById[selected.relation_refs.triad[0]], selected.palace_id)).toBe("triad");
    expect(getPalaceRelationKind(viewModel.palaceById[selected.relation_refs.neighbors[0]], selected.palace_id)).toBe("neighbor");
  });

  test("exposes the active major period for the current index", () => {
    const viewModel = buildChartViewModel(chart.chart, { activeMajorPeriodIndex: 2 });

    expect(viewModel.activeMajorPeriod?.period_id).toBe(chart.chart.major_periods[2].period_id);
    expect(viewModel.activeMajorPeriod?.palace_id).toBe(chart.chart.major_periods[2].palace_id);
  });
});
