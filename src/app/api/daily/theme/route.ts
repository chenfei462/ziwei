import { handleApiRequest } from "../../../../api.js";
import { jsonErrorResponse, readProtectedJson } from "../../../../apiRouteGuard.js";
import { assertCanReadChart, getRequestIdentity } from "../../../../auth.js";
import { productRepository } from "../../../../repositories/productRepository.js";
import type { DailyThemeRequest } from "../../../../types.js";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await readProtectedJson(request)) as DailyThemeRequest;
    if (body.chart_id) {
      const owner = await productRepository.getChartOwnerAsync(body.chart_id);
      // Preserve the public not-found envelope for unknown charts; only an
      // existing chart proceeds to ownership authorization.
      if (owner) assertCanReadChart(owner, getRequestIdentity(request));
    }
    const response = handleApiRequest("POST", "/api/daily/theme", body);
    return Response.json(response.body, { status: response.status });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
