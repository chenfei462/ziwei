import { ApiError } from "./errors.js";
import { buildInterpretation } from "./phase3/interpretationEngine.js";
import { getChart } from "./store.js";
import type { InterpretRequest, InterpretResponse } from "./types.js";

export function interpret(request: InterpretRequest): InterpretResponse {
  const storedChart = getChart(request.chart_id);
  const chart = storedChart?.chart ?? request.chart;
  if (!chart) {
    throw new ApiError("CHART_NOT_FOUND", "chart not found.", { field: "chart_id", status: 404 });
  }

  const palace = chart.palaces.find((item) => item.palace_id === request.palace_id);
  if (!palace) {
    throw new ApiError("PALACE_NOT_FOUND", "palace not found.", { field: "palace_id", status: 404 });
  }

  return buildInterpretation({
    chart_id: request.chart_id,
    chart,
    palace,
    mode: request.mode,
    include_trace: request.include_trace,
    major_period_id: request.major_period_id
  });
}
