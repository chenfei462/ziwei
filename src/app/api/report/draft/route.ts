import { handleApiRequest } from "../../../../api.js";
import { jsonErrorResponse, readProtectedJson } from "../../../../apiRouteGuard.js";
import { assertCanReadChart, getRequestIdentity } from "../../../../auth.js";
import { productRepository } from "../../../../repositories/productRepository.js";
import { reportTypes, type ReportDraftRequest } from "../../../../types.js";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await readProtectedJson(request)) as ReportDraftRequest;
    // Reject malformed report requests before looking up a chart owner. This
    // keeps validation deterministic without weakening authorization for valid
    // requests that reference another user's chart.
    if (!reportTypes.includes(body.report_type as (typeof reportTypes)[number])) {
      const response = handleApiRequest("POST", "/api/report/draft", body);
      return Response.json(response.body, { status: response.status });
    }
    if (body.chart_id) {
      assertCanReadChart(await productRepository.getChartOwnerAsync(body.chart_id), getRequestIdentity(request));
    }
    const response = handleApiRequest("POST", "/api/report/draft", body);
    return Response.json(response.body, { status: response.status });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
