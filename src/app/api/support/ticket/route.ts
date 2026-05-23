import { handleApiRequest } from "../../../../api.js";
import { ApiError, toErrorEnvelope } from "../../../../errors.js";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const response = toErrorEnvelope(new ApiError("INVALID_JSON", "Request body must be valid JSON."));
    return Response.json(response.body, { status: response.status });
  }
  const response = handleApiRequest("POST", "/api/support/ticket", body);
  return Response.json(response.body, { status: response.status });
}
