import { recordProductEvent } from "../../../../analytics.js";
import { assertCanReadChart, getRequestIdentity } from "../../../../auth.js";
import { ApiError } from "../../../../errors.js";
import { toErrorEnvelope } from "../../../../errors.js";
import { productRepository } from "../../../../repositories/productRepository.js";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await context.params;
    const identity = getRequestIdentity(_request);
    assertCanReadChart(await productRepository.getChartOwnerAsync(id), identity);
    const chart = await productRepository.getChartAsync(id);
    if (!chart) {
      throw new ApiError("CHART_NOT_FOUND", "未找到指定命盘。", { field: "chart_id", status: 404 });
    }
    recordProductEvent("interpretation_viewed", { identity, chart_id: id });
    return Response.json(chart, { status: 200 });
  } catch (error) {
    const response = toErrorEnvelope(error);
    return Response.json(response.body, { status: response.status });
  }
}
