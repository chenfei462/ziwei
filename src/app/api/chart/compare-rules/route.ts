import { handleApiRequest } from "../../../../api.js";
import { ApiError, toErrorEnvelope } from "../../../../errors.js";

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    const response = toErrorEnvelope(new ApiError("INVALID_JSON", "Request body must be valid JSON."));
    return Response.json(response.body, { status: response.status });
  }
  const response = handleApiRequest("POST", "/api/chart/compare-rules", body);
  return Response.json(response.body, { status: response.status });
}
