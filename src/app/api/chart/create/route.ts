import { handleApiRequest } from "../../../../api.js";
import { readProtectedJson } from "../../../../apiRouteGuard.js";
import { recordProductEvent } from "../../../../analytics.js";
import { buildVisitorCookieHeader, getOrCreateRequestIdentity } from "../../../../auth.js";
import { toErrorEnvelope } from "../../../../errors.js";
import { productRepository } from "../../../../repositories/productRepository.js";
import type { ChartCreateRequest, ChartCreateResponse } from "../../../../types.js";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readProtectedJson(request);
    const chartRequest = body as ChartCreateRequest;
    const { identity, shouldSetVisitorCookie } = getOrCreateRequestIdentity(request);
    recordProductEvent("chart_started", { identity });
    const response = handleApiRequest("POST", "/api/chart/create", body);
    if (response.status === 201) {
      const chart = response.body as unknown as ChartCreateResponse;
      await productRepository.saveChartAsync({
        chart,
        birth_profile: chartRequest.birth_profile,
        owner: {
          visitor_id: identity.visitorId,
          member_id: identity.memberId
        }
      });
      await productRepository.saveChartOwnerAsync({
        chart_id: chart.chart_id,
        visitor_id: identity.visitorId,
        member_id: identity.memberId,
        created_at: new Date().toISOString()
      });
      recordProductEvent("chart_completed", { identity, chart_id: chart.chart_id });
    }
    return Response.json(response.body, {
      status: response.status,
      headers: shouldSetVisitorCookie ? { "set-cookie": buildVisitorCookieHeader(identity.visitorId) } : undefined
    });
  } catch (error) {
    const response = toErrorEnvelope(error);
    return Response.json(response.body, { status: response.status });
  }
}
