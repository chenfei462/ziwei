import { handleApiRequest } from "../../../api.js";
import { jsonErrorResponse, readProtectedJson } from "../../../apiRouteGuard.js";
import { assertCanReadChart, getRequestIdentity } from "../../../auth.js";
import { generateDeepSeekInterpretation } from "../../../phase3/deepseekClient.js";
import { productRepository } from "../../../repositories/productRepository.js";
import type { InterpretRequest, InterpretResponse } from "../../../types.js";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await readProtectedJson(request)) as InterpretRequest;
    if (body.chart_id) {
      assertCanReadChart(await productRepository.getChartOwnerAsync(body.chart_id), getRequestIdentity(request));
    }

    const response = handleApiRequest("POST", "/api/interpret", body);
    if (response.status !== 200) {
      return Response.json(response.body, { status: response.status });
    }

    const interpretation = response.body as unknown as InterpretResponse;
    if (interpretation.status !== "ready") {
      return Response.json(response.body, { status: response.status });
    }

    const generated = await generateDeepSeekInterpretation(interpretation);
    return Response.json(generated, { status: response.status });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
